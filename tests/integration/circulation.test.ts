import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { bookCopies, books, finePayments } from '@/server/db/schema';
import {
  findCopyByBarcode, getBorrowerCard, loadBorrowerLoans, searchBorrowers,
} from '@/server/queries/circulation';
import { circulationFixture, seedLoan, TODAY } from './circulation-fixture';
import { withRollback } from './helpers';

describe('searchBorrowers', () => {
  it('menaruh siswa dengan NIS yang cocok persis di urutan pertama', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);

      const result = await searchBorrowers('UJI-S2', tx);

      expect(result[0]).toEqual({
        id: fx.students[1].id, nis: 'UJI-S2', name: 'UJI Siswa Dua', className: 'XI UJI 2', status: 'active',
      });
    });
  });

  it('mencari sebagian nama tanpa memedulikan huruf besar-kecil', async () => {
    await withRollback(async (tx) => {
      await circulationFixture(tx);

      const names = (await searchBorrowers('uji siswa', tx)).map((row) => row.name);

      expect(names).toEqual(expect.arrayContaining(['UJI Siswa Dua', 'UJI Siswa Satu']));
    });
  });

  it('mengembalikan daftar kosong untuk kata kunci kosong', async () => {
    await withRollback(async (tx) => {
      expect(await searchBorrowers('   ', tx)).toEqual([]);
    });
  });
});

describe('loadBorrowerLoans', () => {
  it('memuat pinjaman terbuka dan pinjaman selesai yang dendanya belum lunas', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      const open = await seedLoan(tx, fx, { student: 0, copies: [0, 1], loanDate: '2090-02-20', dueDate: '2090-02-23', returned: [1] });
      const unpaid = await seedLoan(tx, fx, { student: 0, copies: [2], loanDate: '2090-02-01', dueDate: '2090-02-04', returned: [2], totalFine: 5000 });
      await tx.insert(finePayments).values({ loanId: unpaid.id, amount: '2000', receivedBy: fx.actor.id });
      const settled = await seedLoan(tx, fx, { student: 0, copies: [3], loanDate: '2090-01-01', dueDate: '2090-01-04', returned: [3], totalFine: 1000 });
      await tx.insert(finePayments).values({ loanId: settled.id, amount: '1000', receivedBy: fx.actor.id });

      const result = await loadBorrowerLoans(fx.students[0].id, tx);

      expect(result).toEqual([
        { id: unpaid.id, transactionNumber: unpaid.transactionNumber, dueDate: '2090-02-04', openItemCount: 0, unpaidFine: 3000 },
        { id: open.id, transactionNumber: open.transactionNumber, dueDate: '2090-02-23', openItemCount: 1, unpaidFine: 0 },
      ]);
    });
  });
});

describe('getBorrowerCard', () => {
  it('merangkum pinjaman aktif, keterlambatan, dan tunggakan', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      const late = await seedLoan(tx, fx, { student: 0, copies: [0], loanDate: '2090-02-20', dueDate: '2090-02-23' });
      await seedLoan(tx, fx, { student: 0, copies: [1], loanDate: '2090-01-01', dueDate: '2090-01-04', returned: [1], totalFine: 4000 });

      expect(await getBorrowerCard(fx.students[0].id, TODAY, tx)).toEqual({
        student: { id: fx.students[0].id, nis: 'UJI-S1', name: 'UJI Siswa Satu', className: 'XI UJI 1', status: 'active' },
        activeCount: 1,
        maxActiveLoans: 3,
        overdue: [{ transactionNumber: late.transactionNumber, daysLate: 7 }],
        unpaidFine: 4000,
        blockWhenOverdue: true,
        blockWhenUnpaidFine: false,
      });
    });
  });

  it('mengembalikan null untuk siswa yang tidak ada atau id yang bukan UUID', async () => {
    await withRollback(async (tx) => {
      expect(await getBorrowerCard(crypto.randomUUID(), TODAY, tx)).toBeNull();
      expect(await getBorrowerCard('bukan-uuid', TODAY, tx)).toBeNull();
    });
  });
});

describe('findCopyByBarcode', () => {
  it('menemukan eksemplar tanpa memedulikan huruf besar-kecil, lengkap dengan rak dan status bukunya', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);

      expect(await findCopyByBarcode(' uji-srk-01 ', tx)).toEqual({
        id: fx.copies[0].id,
        barcode: 'UJI-SRK-01',
        status: 'TERSEDIA',
        bookId: fx.bookId,
        bookTitle: 'UJI-Buku Sirkulasi',
        bookStatus: 'active',
        rackCode: 'UJI-R1',
      });
    });
  });

  it('menyertakan peminjam untuk eksemplar yang sedang dipinjam', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      await seedLoan(tx, fx, { student: 1, copies: [0], loanDate: TODAY, dueDate: '2090-03-05' });

      expect((await findCopyByBarcode('UJI-SRK-01', tx))?.borrowedBy).toEqual({
        name: 'UJI Siswa Dua', nis: 'UJI-S2', dueDate: '2090-03-05',
      });
    });
  });

  it('melaporkan status buku nonaktif dan mengembalikan null untuk barcode tak dikenal', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      await tx.update(books).set({ status: 'inactive' }).where(eq(books.id, fx.bookId));
      await tx.update(bookCopies).set({ status: 'RUSAK' }).where(eq(bookCopies.id, fx.copies[1].id));

      const copy = await findCopyByBarcode('UJI-SRK-02', tx);
      expect(copy).toMatchObject({ status: 'RUSAK', bookStatus: 'inactive' });
      expect(copy?.borrowedBy).toBeUndefined();
      expect(await findCopyByBarcode('UJI-TIDAK-ADA', tx)).toBeNull();
    });
  });
});
