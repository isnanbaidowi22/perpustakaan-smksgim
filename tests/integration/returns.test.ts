import { describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { ReturnCondition } from '@/domain/shared/types';
import type { Transaction } from '@/server/db/executor';
import { auditLogs, bookCopies, loanItems, loans } from '@/server/db/schema';
import { getLoanDetail } from '@/server/queries/loans';
import { createLoan } from '@/server/services/loans';
import { processReturn } from '@/server/services/returns';
import { circulationFixture, TODAY, type CirculationFixture } from './circulation-fixture';
import { withRollback } from './helpers';

/** Pinjaman TODAY (jatuh tempo 2090-03-05) untuk siswa pertama. */
async function borrow(tx: Transaction, fx: CirculationFixture, copyIndexes: number[]) {
  const result = await createLoan({
    studentId: fx.students[0].id, copyIds: copyIndexes.map((index) => fx.copies[index].id), notes: null,
  }, fx.actor, TODAY, tx);
  if (!result.ok) throw new Error(JSON.stringify(result));
  const detail = await getLoanDetail(result.id, TODAY, tx);
  if (!detail) throw new Error('detail pinjaman tidak terbaca');
  return detail;
}

function item(loanItemId: string, condition: ReturnCondition = 'BAIK', replacementFee: number | null = null) {
  return { loanItemId, condition, replacementFee, note: null };
}

async function copyStatus(tx: Transaction, copyId: string) {
  const [copy] = await tx.select({ status: bookCopies.status }).from(bookCopies).where(eq(bookCopies.id, copyId));
  return copy?.status;
}

describe('processReturn', () => {
  it('menyelesaikan pinjaman yang kembali tepat waktu tanpa denda', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      const loan = await borrow(tx, fx, [0]);

      const result = await processReturn({ loanId: loan.id, items: [item(loan.items[0].id)] }, fx.actor, '2090-03-05', tx);

      expect(result).toEqual({ ok: true, id: loan.id, notice: 'Tidak ada denda.' });
      const [row] = await tx.select({ status: loans.status, totalFine: loans.totalFine }).from(loans).where(eq(loans.id, loan.id));
      expect(row).toEqual({ status: 'SELESAI', totalFine: '0.00' });
      expect(await copyStatus(tx, fx.copies[0].id)).toBe('TERSEDIA');
      const [returned] = await tx.select().from(loanItems).where(eq(loanItems.id, loan.items[0].id));
      expect(returned).toMatchObject({ returnCondition: 'BAIK', daysLate: 0, returnedBy: fx.actor.id });
      expect(returned?.returnedAt).toBeInstanceOf(Date);
    });
  });

  it('mendukung pengembalian sebagian lalu menyelesaikannya', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      const loan = await borrow(tx, fx, [0, 1]);
      const [first, second] = loan.items;

      await processReturn({ loanId: loan.id, items: [item(first.id)] }, fx.actor, TODAY, tx);
      let [row] = await tx.select({ status: loans.status }).from(loans).where(eq(loans.id, loan.id));
      expect(row?.status).toBe('SEBAGIAN_KEMBALI');
      expect(await copyStatus(tx, second.bookCopyId)).toBe('DIPINJAM');

      await processReturn({ loanId: loan.id, items: [item(second.id)] }, fx.actor, TODAY, tx);
      [row] = await tx.select({ status: loans.status }).from(loans).where(eq(loans.id, loan.id));
      expect(row?.status).toBe('SELESAI');
    });
  });

  it('menumpuk denda telat dan biaya ganti untuk buku rusak yang terlambat (spec 5.3)', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      const loan = await borrow(tx, fx, [0]);

      const result = await processReturn({
        loanId: loan.id,
        items: [{ loanItemId: loan.items[0].id, condition: 'RUSAK', replacementFee: null, note: 'UJI sampul sobek' }],
      }, fx.actor, '2090-03-09', tx);

      expect(result).toEqual({ ok: true, id: loan.id, notice: 'Total denda transaksi ini Rp54.000.' });
      const [returned] = await tx.select().from(loanItems).where(eq(loanItems.id, loan.items[0].id));
      expect(returned).toMatchObject({
        returnCondition: 'RUSAK', daysLate: 4, lateFine: '4000.00', replacementFee: '50000.00', conditionNote: 'UJI sampul sobek',
      });
      const [row] = await tx.select({ totalFine: loans.totalFine }).from(loans).where(eq(loans.id, loan.id));
      expect(row?.totalFine).toBe('54000.00');
      // BR-07: eksemplar rusak tidak kembali TERSEDIA secara otomatis.
      expect(await copyStatus(tx, fx.copies[0].id)).toBe('RUSAK');

      const [audit] = await tx
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.entityId, loan.id), eq(auditLogs.action, 'return.process')));
      expect(audit?.metadata).toEqual({
        transactionNumber: loan.transactionNumber,
        items: [{ barcode: 'UJI-SRK-01', condition: 'RUSAK', daysLate: 4, lateFine: 4000, replacementFee: 50000 }],
        totalFine: 54000,
        status: 'SELESAI',
      });
    });
  });

  it('memakai biaya ganti yang ditimpa petugas untuk buku hilang', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      const loan = await borrow(tx, fx, [0]);

      await processReturn({ loanId: loan.id, items: [item(loan.items[0].id, 'HILANG', 30000)] }, fx.actor, '2090-03-05', tx);

      const [returned] = await tx.select({ replacementFee: loanItems.replacementFee }).from(loanItems).where(eq(loanItems.id, loan.items[0].id));
      expect(returned?.replacementFee).toBe('30000.00');
      expect(await copyStatus(tx, fx.copies[0].id)).toBe('HILANG');
    });
  });

  it('menolak item yang sudah kembali atau bukan milik transaksi ini, tanpa mengubah apa pun', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      const loan = await borrow(tx, fx, [0, 1]);
      await processReturn({ loanId: loan.id, items: [item(loan.items[0].id)] }, fx.actor, TODAY, tx);

      const result = await processReturn({
        loanId: loan.id, items: [item(loan.items[0].id), item(loan.items[1].id)],
      }, fx.actor, TODAY, tx);

      expect(result).toEqual({
        ok: false,
        message: 'Salah satu buku sudah dikembalikan atau bukan bagian dari transaksi ini. Muat ulang halaman lalu pilih lagi.',
      });
      expect(await copyStatus(tx, loan.items[1].bookCopyId)).toBe('DIPINJAM');
    });
  });

  it('menolak transaksi yang sudah selesai, transaksi tak dikenal, dan pilihan kosong', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      const loan = await borrow(tx, fx, [0]);
      await processReturn({ loanId: loan.id, items: [item(loan.items[0].id)] }, fx.actor, TODAY, tx);

      expect(await processReturn({ loanId: loan.id, items: [item(loan.items[0].id)] }, fx.actor, TODAY, tx)).toEqual({
        ok: false, message: `Transaksi ${loan.transactionNumber} sudah selesai; seluruh bukunya sudah kembali.`,
      });
      expect(await processReturn({ loanId: crypto.randomUUID(), items: [item(loan.items[0].id)] }, fx.actor, TODAY, tx)).toEqual({
        ok: false, message: 'Transaksi tidak ditemukan. Cari ulang dengan nomor transaksi, NIS, atau barcode buku.',
      });
      expect(await processReturn({ loanId: loan.id, items: [] }, fx.actor, TODAY, tx)).toEqual({
        ok: false, message: 'Centang minimal satu buku yang dikembalikan.',
      });
    });
  });
});
