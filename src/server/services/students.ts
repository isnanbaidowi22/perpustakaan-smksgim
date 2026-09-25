import { eq } from 'drizzle-orm';
import type { Actor, RecordStatus } from '@/domain/shared/types';
import { writeAudit } from '@/server/audit';
import { db } from '@/server/db/client';
import { uniqueViolation } from '@/server/db/errors';
import type { Executor } from '@/server/db/executor';
import { students } from '@/server/db/schema';
import { getActiveAcademicYear } from '@/server/queries/academic-years';
import { isUuid } from '@/server/validation/common';
import type { StudentInput } from '@/server/validation/student';
import { fail, ok, type ServiceResult } from './result';

const NOT_FOUND = 'Siswa tidak ditemukan. Muat ulang halaman daftar siswa.';

/**
 * NIS ganda paling sering berarti siswa itu sudah terdaftar. Menyebut
 * namanya membantu petugas memutuskan: salah ketik, atau data lama.
 */
async function duplicateNis(nis: string, executor: Executor): Promise<ServiceResult> {
  const [owner] = await executor
    .select({ name: students.name })
    .from(students)
    .where(eq(students.nis, nis))
    .limit(1);
  const who = owner ? ` atas nama ${owner.name}` : '';
  return fail(`NIS ${nis} sudah terdaftar${who}. Periksa kembali NIS, atau cari siswa tersebut di daftar.`, 'nis');
}

export async function createStudent(
  input: StudentInput,
  actor: Actor,
  executor: Executor = db,
): Promise<ServiceResult> {
  try {
    return await executor.transaction(async (tx) => {
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
        metadata: { nis: input.nis, name: input.name, className: input.className },
      });
      return ok(created.id);
    });
  } catch (error) {
    // Savepoint sudah di-rollback; `executor` masih dapat dipakai untuk mencari pemilik NIS.
    if (uniqueViolation(error) === 'students_nis_unique') return duplicateNis(input.nis, executor);
    throw error;
  }
}

export async function updateStudent(
  id: string,
  input: StudentInput,
  actor: Actor,
  executor: Executor = db,
): Promise<ServiceResult> {
  if (!isUuid(id)) return fail(NOT_FOUND);
  try {
    return await executor.transaction(async (tx) => {
      const [current] = await tx
        .select({ nis: students.nis, name: students.name, className: students.className })
        .from(students)
        .where(eq(students.id, id))
        .for('update');
      if (!current) return fail(NOT_FOUND);

      const [updated] = await tx
        .update(students)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(students.id, id))
        .returning({ id: students.id });
      if (!updated) return fail(NOT_FOUND);

      await writeAudit(tx, {
        actorId: actor.id,
        action: 'student.update',
        entity: 'students',
        entityId: id,
        metadata: {
          before: current,
          after: { nis: input.nis, name: input.name, className: input.className },
        },
      });
      return ok(id);
    });
  } catch (error) {
    if (uniqueViolation(error) === 'students_nis_unique') return duplicateNis(input.nis, executor);
    throw error;
  }
}

export async function setStudentStatus(
  id: string,
  status: RecordStatus,
  actor: Actor,
  executor: Executor = db,
): Promise<ServiceResult> {
  if (!isUuid(id)) return fail(NOT_FOUND);
  return executor.transaction(async (tx) => {
    const [updated] = await tx
      .update(students)
      .set({ status, updatedAt: new Date() })
      .where(eq(students.id, id))
      .returning({ id: students.id, nis: students.nis });
    if (!updated) return fail(NOT_FOUND);

    await writeAudit(tx, {
      actorId: actor.id,
      action: status === 'active' ? 'student.activate' : 'student.deactivate',
      entity: 'students',
      entityId: id,
      metadata: { nis: updated.nis },
    });
    return ok(id);
  });
}
