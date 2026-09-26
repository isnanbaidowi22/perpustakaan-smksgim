import { asc } from 'drizzle-orm';
import type { Option } from '@/lib/options';
import { db } from '@/server/db/client';
import type { Executor } from '@/server/db/executor';
import { loans } from '@/server/db/schema';

/**
 * Kelas untuk filter laporan, dari kelas SAAT MEMINJAM (`loans.student_class`),
 * bukan kelas siswa sekarang: laporan per kelas tetap akurat setelah siswa
 * naik kelas (spec §13).
 */
export async function listReportClassOptions(executor: Executor = db): Promise<Option[]> {
  const rows = await executor
    .selectDistinct({ className: loans.studentClass })
    .from(loans)
    .orderBy(asc(loans.studentClass));
  return rows.map((row) => ({ value: row.className, label: row.className }));
}
