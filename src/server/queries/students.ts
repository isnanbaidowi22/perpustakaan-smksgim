import { eq } from 'drizzle-orm';
import type { RecordStatus } from '@/domain/shared/types';
import { db } from '@/server/db/client';
import type { Executor } from '@/server/db/executor';
import { students } from '@/server/db/schema';
import { isUuid } from '@/server/validation/common';

export interface Student {
  id: string;
  name: string;
  className: string;
  major: string | null;
  gender: 'L' | 'P' | null;
  academicYearId: string | null;
  status: RecordStatus;
}

export async function getStudent(id: string, executor: Executor = db): Promise<Student | null> {
  if (!isUuid(id)) return null;
  const [student] = await executor
    .select({
      id: students.id,
      name: students.name,
      className: students.className,
      major: students.major,
      gender: students.gender,
      academicYearId: students.academicYearId,
      status: students.status,
    })
    .from(students)
    .where(eq(students.id, id))
    .limit(1);
  return student ?? null;
}
