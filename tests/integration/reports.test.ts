import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { students } from '@/server/db/schema';
import { listReportClassOptions, loanReport } from '@/server/queries/reports';
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
