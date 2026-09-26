import { describe, expect, it } from 'vitest';
import { listReportClassOptions } from '@/server/queries/reports';
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
