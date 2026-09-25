import { desc, eq } from 'drizzle-orm';
import type { Option } from '@/lib/options';
import { db } from '@/server/db/client';
import type { Executor } from '@/server/db/executor';
import { academicYears } from '@/server/db/schema';
import { isUuid } from '@/server/validation/common';

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

export interface AcademicYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

const yearColumns = {
  id: academicYears.id,
  name: academicYears.name,
  startDate: academicYears.startDate,
  endDate: academicYears.endDate,
  isActive: academicYears.isActive,
};

/** Terbaru lebih dulu. Jumlahnya satu baris per tahun, jadi tanpa paginasi. */
export async function listAcademicYears(executor: Executor = db): Promise<AcademicYear[]> {
  return executor.select(yearColumns).from(academicYears).orderBy(desc(academicYears.startDate));
}

export async function getAcademicYear(id: string, executor: Executor = db): Promise<AcademicYear | null> {
  if (!isUuid(id)) return null;
  const [year] = await executor.select(yearColumns).from(academicYears).where(eq(academicYears.id, id)).limit(1);
  return year ?? null;
}
