import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { Transaction } from '@/server/db/executor';
import { bookCopies, books, loanItems, students } from '@/server/db/schema';
import {
  collectionReport, listReportClassOptions, loanReport, overdueReport, returnReport,
} from '@/server/queries/reports';
import { circulationFixture, seedLoan } from './circulation-fixture';
import { withRollback } from './helpers';

describe('listReportClassOptions', () => {
  it('mendaftar kelas saat meminjam, tanpa duplikat, urut abjad', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx, { copies: 3 });
      await seedLoan(tx, fx, { student: 1, copies: [0], loanDate: '2090-03-01', dueDate: '2090-03-04' });
      await seedLoan(tx, fx, { student: 0, copies: [1], loanDate: '2090-03-01', dueDate: '2090-03-04' });
      await seedLoan(tx, fx, { student: 0, copies: [2], loanDate: '2090-03-02', dueDate: '2090-03-05' });

      const options = await listReportClassOptions(tx);
      const uji = options.filter((option) => option.value.startsWith('XI UJI'));

      expect(uji).toEqual([
        { value: 'XI UJI 1', label: 'XI UJI 1' },
        { value: 'XI UJI 2', label: 'XI UJI 2' },
      ]);
    });
  });
});

describe('loanReport', () => {
  const march = { from: '2090-03-01', to: '2090-03-02', className: '' };

  it('mendaftar pinjaman dalam periode, urut tanggal, dengan jumlah buku dan keterlambatan', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx, { copies: 4 });
      const first = await seedLoan(tx, fx, { student: 0, copies: [0, 1], loanDate: '2090-03-01', dueDate: '2090-03-04', returned: [0] });
      const second = await seedLoan(tx, fx, { student: 1, copies: [2], loanDate: '2090-03-02', dueDate: '2090-03-05' });
      await seedLoan(tx, fx, { student: 0, copies: [3], loanDate: '2090-02-27', dueDate: '2090-03-02' });

      const report = await loanReport(march, '2090-03-06', tx);

      expect(report.truncated).toBe(false);
      expect(report.summary).toEqual({ loans: 2, copies: 3, students: 2 });
      expect(report.rows).toEqual([
        {
          id: first.id, transactionNumber: first.transactionNumber, loanDate: '2090-03-01', dueDate: '2090-03-04',
          status: 'SEBAGIAN_KEMBALI', studentName: 'UJI Siswa Satu', studentNis: 'UJI-S1', studentClass: 'XI UJI 1',
          itemCount: 2, openCount: 1, daysOverdue: 2,
        },
        {
          id: second.id, transactionNumber: second.transactionNumber, loanDate: '2090-03-02', dueDate: '2090-03-05',
          status: 'AKTIF', studentName: 'UJI Siswa Dua', studentNis: 'UJI-S2', studentClass: 'XI UJI 2',
          itemCount: 1, openCount: 1, daysOverdue: 1,
        },
      ]);
    });
  });

  it('menyaring per kelas saat meminjam, walau siswa sudah pindah kelas', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx, { copies: 2 });
      const loan = await seedLoan(tx, fx, { student: 0, copies: [0], loanDate: '2090-03-01', dueDate: '2090-03-04' });
      await seedLoan(tx, fx, { student: 1, copies: [1], loanDate: '2090-03-01', dueDate: '2090-03-04' });
      await tx.update(students).set({ className: 'XII UJI 1' }).where(eq(students.id, fx.students[0].id));

      const report = await loanReport({ ...march, className: 'XI UJI 1' }, '2090-03-02', tx);

      expect(report.rows.map((row) => row.id)).toEqual([loan.id]);
      expect(report.rows[0].studentClass).toBe('XI UJI 1');
      expect(report.summary).toEqual({ loans: 1, copies: 1, students: 1 });
    });
  });

  it('memotong baris di batas tetapi ringkasan tetap menghitung seluruhnya', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx, { copies: 2 });
      await seedLoan(tx, fx, { student: 0, copies: [0], loanDate: '2090-03-01', dueDate: '2090-03-04' });
      await seedLoan(tx, fx, { student: 1, copies: [1], loanDate: '2090-03-02', dueDate: '2090-03-05' });

      const report = await loanReport(march, '2090-03-02', tx, 1);

      expect(report.truncated).toBe(true);
      expect(report.rows).toHaveLength(1);
      expect(report.summary.loans).toBe(2);
    });
  });
});

describe('returnReport', () => {
  /** Mengatur waktu kembali dan hasil pengembalian satu eksemplar yang sudah ditandai kembali oleh seedLoan. */
  async function setReturn(
    tx: Transaction,
    loanId: string,
    copyId: string,
    values: { at: string; condition: 'BAIK' | 'RUSAK' | 'HILANG'; daysLate?: number; lateFine?: number; replacementFee?: number },
  ) {
    await tx.update(loanItems).set({
      returnedAt: new Date(values.at),
      returnCondition: values.condition,
      daysLate: values.daysLate ?? 0,
      lateFine: String(values.lateFine ?? 0),
      replacementFee: String(values.replacementFee ?? 0),
    }).where(and(eq(loanItems.loanId, loanId), eq(loanItems.bookCopyId, copyId)));
  }

  it('mendaftar eksemplar yang kembali pada periode menurut tanggal WIB, dengan denda dan ringkasan kondisi', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx, { copies: 3 });
      const loan = await seedLoan(tx, fx, {
        student: 0, copies: [0, 1, 2], loanDate: '2090-02-25', dueDate: '2090-02-28', returned: [0, 1, 2],
      });
      // 02/03 00.30 WIB — masuk
      await setReturn(tx, loan.id, fx.copies[0].id, { at: '2090-03-01T17:30:00Z', condition: 'RUSAK', daysLate: 2, lateFine: 2000, replacementFee: 50000 });
      // 02/03 09.00 WIB — masuk
      await setReturn(tx, loan.id, fx.copies[1].id, { at: '2090-03-02T02:00:00Z', condition: 'BAIK', daysLate: 2, lateFine: 2000 });
      // 01/03 23.59 WIB — tidak masuk
      await setReturn(tx, loan.id, fx.copies[2].id, { at: '2090-03-01T16:59:00Z', condition: 'HILANG', replacementFee: 50000 });

      const report = await returnReport({ from: '2090-03-02', to: '2090-03-02', className: '' }, tx);

      expect(report.truncated).toBe(false);
      expect(report.rows.map((row) => [row.barcode, row.condition, row.lateFine, row.replacementFee])).toEqual([
        ['UJI-SRK-01', 'RUSAK', 2000, 50000],
        ['UJI-SRK-02', 'BAIK', 2000, 0],
      ]);
      expect(report.rows[0]).toMatchObject({
        loanId: loan.id, transactionNumber: loan.transactionNumber, studentName: 'UJI Siswa Satu',
        studentNis: 'UJI-S1', studentClass: 'XI UJI 1', bookTitle: 'UJI-Buku Sirkulasi', daysLate: 2,
      });
      expect(report.rows[0].returnedAt).toBeInstanceOf(Date);
      expect(report.summary).toEqual({ copies: 2, good: 1, damaged: 1, lost: 0, lateFines: 4000, replacementFees: 50000 });
    });
  });

  it('menyaring per kelas saat meminjam dan memotong baris di batas', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx, { copies: 3 });
      const mine = await seedLoan(tx, fx, { student: 0, copies: [0, 1], loanDate: '2090-02-25', dueDate: '2090-02-28', returned: [0, 1] });
      const other = await seedLoan(tx, fx, { student: 1, copies: [2], loanDate: '2090-02-25', dueDate: '2090-02-28', returned: [2] });
      await setReturn(tx, mine.id, fx.copies[0].id, { at: '2090-03-02T02:00:00Z', condition: 'BAIK' });
      await setReturn(tx, mine.id, fx.copies[1].id, { at: '2090-03-02T03:00:00Z', condition: 'BAIK' });
      await setReturn(tx, other.id, fx.copies[2].id, { at: '2090-03-02T04:00:00Z', condition: 'BAIK' });

      const report = await returnReport({ from: '2090-03-02', to: '2090-03-02', className: 'XI UJI 1' }, tx, 1);

      expect(report.truncated).toBe(true);
      expect(report.rows).toHaveLength(1);
      expect(report.summary.copies).toBe(2);
    });
  });
});

describe('overdueReport', () => {
  it('mendaftar eksemplar belum kembali yang lewat jatuh tempo, paling lama di atas, dengan perkiraan denda', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx, { copies: 5 });
      const old = await seedLoan(tx, fx, { student: 0, copies: [0, 1], loanDate: '2090-02-20', dueDate: '2090-02-23', returned: [1] });
      const recent = await seedLoan(tx, fx, { student: 0, copies: [2], loanDate: '2090-02-27', dueDate: '2090-03-02' });
      // Jatuh tempo hari ini: belum terlambat.
      await seedLoan(tx, fx, { student: 0, copies: [3], loanDate: '2090-03-03', dueDate: '2090-03-06' });
      // Kelas lain: tersaring.
      await seedLoan(tx, fx, { student: 1, copies: [4], loanDate: '2090-02-20', dueDate: '2090-02-23' });

      const report = await overdueReport({ className: 'XI UJI 1' }, '2090-03-06', 1000, tx);

      expect(report.truncated).toBe(false);
      expect(report.rows).toEqual([
        {
          id: expect.any(String), loanId: old.id, transactionNumber: old.transactionNumber, studentName: 'UJI Siswa Satu',
          studentNis: 'UJI-S1', studentClass: 'XI UJI 1', barcode: 'UJI-SRK-01', bookTitle: 'UJI-Buku Sirkulasi',
          dueDate: '2090-02-23', daysLate: 11, estimatedFine: 11000,
        },
        {
          id: expect.any(String), loanId: recent.id, transactionNumber: recent.transactionNumber, studentName: 'UJI Siswa Satu',
          studentNis: 'UJI-S1', studentClass: 'XI UJI 1', barcode: 'UJI-SRK-03', bookTitle: 'UJI-Buku Sirkulasi',
          dueDate: '2090-03-02', daysLate: 4, estimatedFine: 4000,
        },
      ]);
      expect(report.summary).toEqual({ students: 1, copies: 2, estimatedFines: 15000 });
    });
  });

  it('memotong baris di batas tetapi ringkasan tetap menghitung seluruhnya', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx, { copies: 2 });
      await seedLoan(tx, fx, { student: 0, copies: [0, 1], loanDate: '2090-02-20', dueDate: '2090-02-23' });

      const report = await overdueReport({ className: 'XI UJI 1' }, '2090-03-06', 500, tx, 1);

      expect(report.truncated).toBe(true);
      expect(report.rows).toHaveLength(1);
      expect(report.summary).toEqual({ students: 1, copies: 2, estimatedFines: 11000 });
    });
  });
});

describe('collectionReport', () => {
  it('menghitung eksemplar per status untuk tiap judul aktif; total tanpa yang nonaktif', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx, { copies: 5 });
      const statuses = ['TERSEDIA', 'DIPINJAM', 'RUSAK', 'HILANG', 'NONAKTIF'] as const;
      for (const [index, status] of statuses.entries()) {
        await tx.update(bookCopies).set({ status }).where(eq(bookCopies.id, fx.copies[index].id));
      }

      const report = await collectionReport({ q: 'UJI-Buku', categoryId: '' }, tx);

      expect(report.truncated).toBe(false);
      expect(report.rows).toEqual([{
        id: fx.bookId, title: 'UJI-Buku Sirkulasi', author: 'UJI-Penulis', categoryName: null, rackCode: 'UJI-R1',
        available: 1, borrowed: 1, damaged: 1, lost: 1, inactive: 1, total: 4,
      }]);
      expect(report.summary).toEqual({ titles: 1, total: 4, available: 1, borrowed: 1, damaged: 1, lost: 1 });
    });
  });

  it('melewatkan judul nonaktif, mencari penulis juga, dan memotong baris di batas', async () => {
    await withRollback(async (tx) => {
      await circulationFixture(tx, { copies: 1 });
      await tx.insert(books).values([
        { title: 'UJI-Buku Kedua', author: 'UJI-Penulis', price: '0' },
        { title: 'UJI-Buku Nonaktif', author: 'UJI-Penulis', price: '0', status: 'inactive' },
      ]);

      const report = await collectionReport({ q: 'UJI-Penulis', categoryId: '' }, tx, 1);

      expect(report.truncated).toBe(true);
      expect(report.rows.map((row) => row.title)).toEqual(['UJI-Buku Kedua']);
      expect(report.summary.titles).toBe(2);
      expect(report.summary.total).toBe(1);
    });
  });
});
