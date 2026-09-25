import { and, asc, eq, ilike, or, sql } from 'drizzle-orm';
import type { RecordStatus } from '@/domain/shared/types';
import { offsetOf, PAGE_SIZE } from '@/lib/pagination';
import type { StatusFilter } from '@/lib/search-params';
import { db } from '@/server/db/client';
import type { Executor } from '@/server/db/executor';
import { academicYears, students } from '@/server/db/schema';
import { isUuid } from '@/server/validation/common';
import { containsPattern } from './like';

export interface Student {
  id: string;
  nis: string;
  name: string;
  className: string;
  major: string | null;
  gender: 'L' | 'P' | null;
  phone: string | null;
  academicYearId: string | null;
  status: RecordStatus;
}

export interface StudentRow {
  id: string;
  nis: string;
  name: string;
  className: string;
  major: string | null;
  academicYearName: string | null;
  status: RecordStatus;
}

export interface StudentFilter {
  q: string;
  /** Kosong berarti semua kelas. */
  className: string;
  status: StatusFilter;
  page: number;
}

export async function listStudents(
  filter: StudentFilter,
  executor: Executor = db,
): Promise<{ rows: StudentRow[]; total: number }> {
  const pattern = containsPattern(filter.q);
  const where = and(
    filter.q ? or(ilike(students.nis, pattern), ilike(students.name, pattern)) : undefined,
    filter.className ? eq(students.className, filter.className) : undefined,
    filter.status === 'all' ? undefined : eq(students.status, filter.status),
  );

  const rows = await executor
    .select({
      id: students.id,
      nis: students.nis,
      name: students.name,
      className: students.className,
      major: students.major,
      academicYearName: academicYears.name,
      status: students.status,
    })
    .from(students)
    .leftJoin(academicYears, eq(academicYears.id, students.academicYearId))
    .where(where)
    .orderBy(asc(students.className), asc(students.name))
    .limit(PAGE_SIZE)
    .offset(offsetOf(filter.page));

  const [{ total }] = await executor.select({ total: sql<number>`count(*)::int` }).from(students).where(where);
  return { rows, total };
}

/** Kelas yang pernah dipakai, untuk filter daftar siswa. */
export async function listClassNames(executor: Executor = db): Promise<string[]> {
  const rows = await executor
    .selectDistinct({ className: students.className })
    .from(students)
    .orderBy(asc(students.className));
  return rows.map((row) => row.className);
}

export async function getStudent(id: string, executor: Executor = db): Promise<Student | null> {
  if (!isUuid(id)) return null;
  const [student] = await executor
    .select({
      id: students.id,
      nis: students.nis,
      name: students.name,
      className: students.className,
      major: students.major,
      gender: students.gender,
      phone: students.phone,
      academicYearId: students.academicYearId,
      status: students.status,
    })
    .from(students)
    .where(eq(students.id, id))
    .limit(1);
  return student ?? null;
}
