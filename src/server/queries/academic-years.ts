import { desc, eq } from 'drizzle-orm';
import type { Option } from '@/lib/options';
import { db } from '@/server/db/client';
import type { Executor } from '@/server/db/executor';
import { academicYears } from '@/server/db/schema';

export interface AcademicYearSummary {
  id: string;
  name: string;
}

export async function getActiveAcademicYear(executor: Executor = db): Promise<AcademicYearSummary | null> {
  const [year] = await executor
    .select({ id: academicYears.id, name: academicYears.name })
    .from(academicYears)
    .where(eq(academicYears.isActive, true))
    .limit(1);
  return year ?? null;
}

/** Terbaru lebih dulu; tahun ajaran aktif diberi tanda agar mudah dipilih. */
export async function listAcademicYearOptions(executor: Executor = db): Promise<Option[]> {
  const rows = await executor
    .select({ id: academicYears.id, name: academicYears.name, isActive: academicYears.isActive })
    .from(academicYears)
    .orderBy(desc(academicYears.startDate));

  return rows.map((row) => ({ value: row.id, label: row.isActive ? `${row.name} (aktif)` : row.name }));
}
