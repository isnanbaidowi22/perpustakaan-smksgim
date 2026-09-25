import { describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { academicYears } from '@/server/db/schema';
import { getActiveAcademicYear, listAcademicYearOptions } from '@/server/queries/academic-years';
import { withRollback } from './helpers';

describe('query tahun ajaran', () => {
  it('mengembalikan tahun ajaran aktif dan menandainya di daftar opsi', async () => {
    await withRollback(async (tx) => {
      await tx.execute(sql`update academic_years set is_active = false`);
      const [active] = await tx
        .insert(academicYears)
        .values({ name: 'UJI-2090/2091', startDate: '2090-07-01', endDate: '2091-06-30', isActive: true })
        .returning({ id: academicYears.id });

      expect(await getActiveAcademicYear(tx)).toEqual({ id: active.id, name: 'UJI-2090/2091' });

      const options = await listAcademicYearOptions(tx);
      expect(options[0]).toEqual({ value: active.id, label: 'UJI-2090/2091 (aktif)' });
    });
  });

  it('mengembalikan null bila tidak ada tahun ajaran aktif', async () => {
    await withRollback(async (tx) => {
      await tx.execute(sql`update academic_years set is_active = false`);
      expect(await getActiveAcademicYear(tx)).toBeNull();
    });
  });
});
