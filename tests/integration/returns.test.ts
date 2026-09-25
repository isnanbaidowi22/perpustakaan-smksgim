import { describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { ReturnCondition } from '@/domain/shared/types';
import type { Transaction } from '@/server/db/executor';
import { auditLogs, bookCopies, loanItems, loans } from '@/server/db/schema';
import { getLoanDetail } from '@/server/queries/loans';
import { payFine } from '@/server/services/fines';
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

      expect(result).toEqual({ ok: true, id: loan.id, notice: 'Tidak ada denda baru.' });
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

      expect(result).toEqual({ ok: true, id: loan.id, notice: 'Denda pengembalian ini Rp54.000. Sisa tagihan transaksi Rp54.000.' });
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

  it('menyebut denda kali ini dan sisa tagihan transaksi, bukan denda kumulatif (I2)', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      const loan = await borrow(tx, fx, [0, 1]);

      const first = await processReturn({
        loanId: loan.id, items: [{ loanItemId: loan.items[0].id, condition: 'RUSAK', replacementFee: null, note: null }],
      }, fx.actor, '2090-03-09', tx);
      expect(first).toEqual({ ok: true, id: loan.id, notice: 'Denda pengembalian ini Rp54.000. Sisa tagihan transaksi Rp54.000.' });

      const payment = await payFine(loan.id, { amount: 30000, note: null }, fx.actor, tx);
      expect(payment).toEqual({ ok: true, id: loan.id, notice: 'Sisa tagihan Rp24.000.' });

      const second = await processReturn({
        loanId: loan.id, items: [item(loan.items[1].id)],
      }, fx.actor, '2090-03-09', tx);
      // Denda kali ini (Rp4.000, telat) + sisa dari pengembalian pertama yang belum lunas (Rp24.000).
      expect(second).toEqual({ ok: true, id: loan.id, notice: 'Denda pengembalian ini Rp4.000. Sisa tagihan transaksi Rp28.000.' });

      const [row] = await tx.select({ totalFine: loans.totalFine }).from(loans).where(eq(loans.id, loan.id));
      expect(row?.totalFine).toBe('58000.00');
    });
  });

  it('menyebut "Tidak ada denda baru." bila pengembalian kali ini tanpa denda dan tagihan sebelumnya sudah lunas', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      const loan = await borrow(tx, fx, [0, 1]);

      await processReturn({
        loanId: loan.id, items: [{ loanItemId: loan.items[0].id, condition: 'RUSAK', replacementFee: null, note: null }],
      }, fx.actor, '2090-03-09', tx);
      await payFine(loan.id, { amount: 54000, note: null }, fx.actor, tx);

      const result = await processReturn({ loanId: loan.id, items: [item(loan.items[1].id)] }, fx.actor, '2090-03-05', tx);

      expect(result).toEqual({ ok: true, id: loan.id, notice: 'Tidak ada denda baru.' });
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

  it('menolak buku yang dipilih dua kali tanpa menulis apa pun', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      const loan = await borrow(tx, fx, [0]);

      const result = await processReturn(
        { loanId: loan.id, items: [item(loan.items[0].id), item(loan.items[0].id)] }, fx.actor, TODAY, tx,
      );

      expect(result).toEqual({ ok: false, message: 'Setiap buku hanya boleh dipilih sekali. Muat ulang halaman.' });
      expect(await copyStatus(tx, fx.copies[0].id)).toBe('DIPINJAM');
    });
  });

  it('menolak buku milik transaksi lain tanpa menulis apa pun', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      const mine = await borrow(tx, fx, [0]);
      const other = await createLoan(
        { studentId: fx.students[1].id, copyIds: [fx.copies[1].id], notes: null }, fx.actor, TODAY, tx,
      );
      if (!other.ok) throw new Error(JSON.stringify(other));
      const otherDetail = await getLoanDetail(other.id, TODAY, tx);
      if (!otherDetail) throw new Error('detail pinjaman lain tidak terbaca');

      const result = await processReturn(
        { loanId: mine.id, items: [item(otherDetail.items[0].id)] }, fx.actor, TODAY, tx,
      );

      expect(result).toEqual({
        ok: false,
        message: 'Salah satu buku sudah dikembalikan atau bukan bagian dari transaksi ini. Muat ulang halaman lalu pilih lagi.',
      });
      expect(await copyStatus(tx, fx.copies[1].id)).toBe('DIPINJAM');
    });
  });

  it('mempertahankan denda pengembalian pertama saat pengembalian kedua juga didenda', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      const loan = await borrow(tx, fx, [0, 1]);
      const [first, second] = loan.items;

      // Jatuh tempo 2090-03-05. Kembali 03-07: telat 2 hari = Rp2.000.
      const firstResult = await processReturn({ loanId: loan.id, items: [item(first.id)] }, fx.actor, '2090-03-07', tx);
      expect(firstResult).toEqual({
        ok: true, id: loan.id, notice: 'Denda pengembalian ini Rp2.000. Sisa tagihan transaksi Rp2.000.',
      });

      // Kembali 03-08, rusak: telat 3 hari Rp3.000 + harga katalog Rp50.000.
      const secondResult = await processReturn(
        { loanId: loan.id, items: [item(second.id, 'RUSAK')] }, fx.actor, '2090-03-08', tx,
      );
      expect(secondResult).toEqual({
        ok: true, id: loan.id, notice: 'Denda pengembalian ini Rp53.000. Sisa tagihan transaksi Rp55.000.',
      });

      const [row] = await tx.select({ totalFine: loans.totalFine, status: loans.status }).from(loans).where(eq(loans.id, loan.id));
      expect(row).toEqual({ totalFine: '55000.00', status: 'SELESAI' });
    });
  });
});
