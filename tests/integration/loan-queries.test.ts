import { describe, expect, it } from 'vitest';
import { finePayments } from '@/server/db/schema';
import { findLoansForReturn, getLoanDetail } from '@/server/queries/loans';
import { createLoan } from '@/server/services/loans';
import { processReturn } from '@/server/services/returns';
import { circulationFixture, TODAY } from './circulation-fixture';
import { withRollback } from './helpers';

describe('getLoanDetail', () => {
  it('memuat pinjaman, item, denda, dan pembayaran', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      const created = await createLoan({
        studentId: fx.students[0].id, copyIds: [fx.copies[0].id, fx.copies[1].id], notes: 'UJI catatan',
      }, fx.actor, TODAY, tx);
      if (!created.ok) throw new Error(JSON.stringify(created));
      const before = await getLoanDetail(created.id, TODAY, tx);
      await processReturn({
        loanId: created.id,
        items: [{ loanItemId: before!.items[0].id, condition: 'BAIK', replacementFee: null, note: null }],
      }, fx.actor, '2090-03-08', tx);
      await tx.insert(finePayments).values({ loanId: created.id, amount: '1000', receivedBy: fx.actor.id, note: 'UJI bayar' });

      const detail = await getLoanDetail(created.id, '2090-03-09', tx);

      expect(detail).toMatchObject({
        id: created.id,
        transactionNumber: 'PJM-20900302-0001',
        status: 'SEBAGIAN_KEMBALI',
        loanDate: TODAY,
        dueDate: '2090-03-05',
        notes: 'UJI catatan',
        studentId: fx.students[0].id,
        studentName: 'UJI Siswa Satu',
        studentNis: 'UJI-S1',
        studentClass: 'XI UJI 1',
        academicYearName: 'UJI-2089/2090',
        totalFine: 3000,
        paidTotal: 1000,
        unpaidFine: 2000,
        daysOverdue: 4,
      });
      expect(detail?.items.map((row) => [row.barcode, row.bookTitle, row.bookPrice, row.daysLate, row.lateFine])).toEqual([
        ['UJI-SRK-01', 'UJI-Buku Sirkulasi', 50000, 3, 3000],
        ['UJI-SRK-02', 'UJI-Buku Sirkulasi', 50000, 0, 0],
      ]);
      expect(detail?.items[0].returnedAt).toBeInstanceOf(Date);
      expect(detail?.items[1].returnedAt).toBeNull();
      expect(detail?.payments).toEqual([
        expect.objectContaining({ amount: 1000, note: 'UJI bayar', paidAt: expect.any(Date) }),
      ]);
    });
  });

  it('mengembalikan null untuk id yang tidak ada atau bukan UUID', async () => {
    await withRollback(async (tx) => {
      expect(await getLoanDetail(crypto.randomUUID(), TODAY, tx)).toBeNull();
      expect(await getLoanDetail('bukan-uuid', TODAY, tx)).toBeNull();
    });
  });
});

describe('findLoansForReturn', () => {
  it('menemukan pinjaman terbuka lewat nomor transaksi, NIS, nama, atau barcode', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      const created = await createLoan({
        studentId: fx.students[0].id, copyIds: [fx.copies[0].id, fx.copies[1].id], notes: null,
      }, fx.actor, TODAY, tx);
      if (!created.ok) throw new Error(JSON.stringify(created));

      const expected = {
        id: created.id,
        transactionNumber: 'PJM-20900302-0001',
        studentName: 'UJI Siswa Satu',
        studentNis: 'UJI-S1',
        studentClass: 'XI UJI 1',
        loanDate: TODAY,
        dueDate: '2090-03-05',
        openCount: 2,
        daysOverdue: 2,
      };
      for (const query of ['pjm-20900302-0001', 'UJI-S1', 'siswa satu', 'uji-srk-02']) {
        expect(await findLoansForReturn(query, '2090-03-07', tx)).toEqual([expected]);
      }
    });
  });

  it('tidak menampilkan pinjaman yang seluruh bukunya sudah kembali', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      const created = await createLoan({ studentId: fx.students[0].id, copyIds: [fx.copies[0].id], notes: null }, fx.actor, TODAY, tx);
      if (!created.ok) throw new Error(JSON.stringify(created));
      const detail = await getLoanDetail(created.id, TODAY, tx);
      await processReturn({
        loanId: created.id, items: [{ loanItemId: detail!.items[0].id, condition: 'BAIK', replacementFee: null, note: null }],
      }, fx.actor, TODAY, tx);

      expect(await findLoansForReturn('UJI-S1', TODAY, tx)).toEqual([]);
      expect(await findLoansForReturn('   ', TODAY, tx)).toEqual([]);
    });
  });
});
