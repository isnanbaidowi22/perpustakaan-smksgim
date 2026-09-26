import { describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { bookCopies, books, loanItems } from '@/server/db/schema';
import { getDashboardStats, listDueToday } from '@/server/queries/dashboard';
import { circulationFixture, seedLoan, TODAY } from './circulation-fixture';
import { withRollback } from './helpers';

describe('getDashboardStats', () => {
  it('menghitung eksemplar, pinjaman hari ini, dan keterlambatan', async () => {
    await withRollback(async (tx) => {
      const before = await getDashboardStats(TODAY, tx);
      const fx = await circulationFixture(tx, { copies: 5 });
      // Terlambat: 2 buku, jatuh tempo 2090-02-20.
      await seedLoan(tx, fx, { student: 0, copies: [0, 1], loanDate: '2090-02-17', dueDate: '2090-02-20' });
      // Dipinjam hari ini: 1 buku.
      await seedLoan(tx, fx, { student: 1, copies: [2], loanDate: TODAY, dueDate: '2090-03-05' });
      // Satu eksemplar dinonaktifkan: tidak dihitung sebagai koleksi.
      await tx.update(bookCopies).set({ status: 'NONAKTIF' }).where(eq(bookCopies.id, fx.copies[4].id));

      const after = await getDashboardStats(TODAY, tx);

      expect(after.totalCopies - before.totalCopies).toBe(4);
      expect(after.totalTitles - before.totalTitles).toBe(1);
      expect(after.availableCopies - before.availableCopies).toBe(1);
      expect(after.borrowedCopies - before.borrowedCopies).toBe(3);
      expect(after.overdueLoans - before.overdueLoans).toBe(1);
      expect(after.overdueCopies - before.overdueCopies).toBe(2);
      expect(after.loansToday).toBe(1);
      expect(after.copiesLentToday).toBe(1);
    });
  });

  it('tidak menghitung eksemplar dari judul nonaktif sebagai total maupun tersedia', async () => {
    await withRollback(async (tx) => {
      const before = await getDashboardStats(TODAY, tx);
      const fx = await circulationFixture(tx, { copies: 2 });
      await tx.update(books).set({ status: 'inactive' }).where(eq(books.id, fx.bookId));

      const after = await getDashboardStats(TODAY, tx);

      expect(after.totalCopies - before.totalCopies).toBe(0);
      expect(after.totalTitles - before.totalTitles).toBe(0);
      expect(after.availableCopies - before.availableCopies).toBe(0);
    });
  });

  it('menghitung pengembalian hari ini menurut tanggal WIB, bukan UTC', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx, { copies: 3 });
      const loan = await seedLoan(tx, fx, {
        student: 0, copies: [0, 1, 2], loanDate: '2090-02-27', dueDate: '2090-03-02', returned: [0, 1, 2],
      });
      const returnedAt = (copyIndex: number, iso: string) => tx
        .update(loanItems)
        .set({ returnedAt: new Date(iso) })
        .where(and(eq(loanItems.loanId, loan.id), eq(loanItems.bookCopyId, fx.copies[copyIndex].id)));
      await returnedAt(0, '2090-03-01T17:30:00Z'); // 02/03/2090 00.30 WIB — hari ini
      await returnedAt(1, '2090-03-02T16:59:00Z'); // 02/03/2090 23.59 WIB — hari ini
      await returnedAt(2, '2090-03-01T16:59:00Z'); // 01/03/2090 23.59 WIB — kemarin

      const stats = await getDashboardStats(TODAY, tx);

      expect(stats.copiesReturnedToday).toBe(2);
    });
  });
});

describe('listDueToday', () => {
  it('mendaftar pinjaman terbuka yang jatuh tempo hari ini beserta buku yang belum kembali', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx, { copies: 4 });
      const partial = await seedLoan(tx, fx, {
        student: 0, copies: [0, 1], loanDate: '2090-02-27', dueDate: TODAY, returned: [0],
      });
      // Sudah selesai: tidak perlu diantisipasi.
      await seedLoan(tx, fx, { student: 1, copies: [2], loanDate: '2090-02-27', dueDate: TODAY, returned: [2] });
      // Jatuh tempo lain hari.
      await seedLoan(tx, fx, { student: 1, copies: [3], loanDate: TODAY, dueDate: '2090-03-05' });

      expect(await listDueToday(TODAY, tx)).toEqual([{
        id: partial.id,
        transactionNumber: partial.transactionNumber,
        studentName: 'UJI Siswa Satu',
        studentNis: 'UJI-S1',
        studentClass: 'XI UJI 1',
        openCount: 1,
      }]);
    });
  });
});
