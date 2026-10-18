import { eq } from 'drizzle-orm';
import type { Actor } from '@/domain/shared/types';
import { writeAudit } from '@/server/audit';
import { db } from '@/server/db/client';
import type { Executor } from '@/server/db/executor';
import { students } from '@/server/db/schema';
import { getActiveAcademicYear } from '@/server/queries/academic-years';
import { isUuid } from '@/server/validation/common';
import type { StudentInput } from '@/server/validation/student';
import { fail, ok, type ServiceResult } from './result';

const NOT_FOUND = 'Siswa tidak ditemukan. Cari ulang siswa di halaman Peminjaman.';

export async function createStudent(
  input: StudentInput,
  actor: Actor,
  executor: Executor = db,
): Promise<ServiceResult> {
  return executor.transaction(async (tx) => {
    const academicYearId = input.academicYearId ?? (await getActiveAcademicYear(tx))?.id ?? null;
    const [created] = await tx
      .insert(students)
      .values({ ...input, academicYearId })
      .returning({ id: students.id });

    await writeAudit(tx, {
      actorId: actor.id,
      action: 'student.create',
      entity: 'students',
      entityId: created.id,
      metadata: { name: input.name, className: input.className },
    });
    return ok(created.id);
  });
}

export async function updateStudent(
  id: string,
  input: StudentInput,
  actor: Actor,
  executor: Executor = db,
): Promise<ServiceResult> {
  if (!isUuid(id)) return fail(NOT_FOUND);
  return executor.transaction(async (tx) => {
    const [current] = await tx
      .select({ name: students.name, className: students.className })
      .from(students)
      .where(eq(students.id, id))
      .for('update');
    if (!current) return fail(NOT_FOUND);

    await tx
      .update(students)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(students.id, id));

    await writeAudit(tx, {
      actorId: actor.id,
      action: 'student.update',
      entity: 'students',
      entityId: id,
      metadata: {
        before: current,
        after: { name: input.name, className: input.className },
      },
    });
    return ok(id);
  });
}
