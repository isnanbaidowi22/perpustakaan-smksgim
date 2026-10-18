import { describe, expect, it } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import type { StudentInput } from '@/server/validation/student';
import { academicYears, auditLogs } from '@/server/db/schema';
import { getStudent } from '@/server/queries/students';
import { createStudent, updateStudent } from '@/server/services/students';
import type { Transaction } from '@/server/db/executor';
import { testActor, withRollback } from './helpers';

const input: StudentInput = {
  name: 'UJI Ahmad Fauzi',
  className: 'UJI-XI RPL 1',
  major: 'RPL',
  gender: 'L',
  academicYearId: null,
};

async function activeTestYear(tx: Transaction): Promise<string> {
  await tx.execute(sql`update academic_years set is_active = false`);
  const [year] = await tx
    .insert(academicYears)
    .values({ name: 'UJI-2090/2091', startDate: '2090-07-01', endDate: '2091-06-30', isActive: true })
    .returning({ id: academicYears.id });
  return year.id;
}

describe('createStudent', () => {
  it('mencatat siswa tanpa NIS, memakai tahun ajaran aktif, dan menulis audit log', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const yearId = await activeTestYear(tx);

      const result = await createStudent(input, actor, tx);

      if (!result.ok) throw new Error(result.message);
      expect(await getStudent(result.id, tx)).toMatchObject({
        name: 'UJI Ahmad Fauzi', academicYearId: yearId, status: 'active',
      });
      const audit = await tx
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.entityId, result.id), eq(auditLogs.action, 'student.create')));
      expect(audit).toHaveLength(1);
    });
  });

  it('membolehkan dua siswa bernama sama (tidak ada lagi kunci NIS)', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      expect((await createStudent(input, actor, tx)).ok).toBe(true);
      expect((await createStudent(input, actor, tx)).ok).toBe(true);
    });
  });
});

describe('updateStudent', () => {
  it('memindahkan kelas dan mencatat perubahannya', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const created = await createStudent(input, actor, tx);
      if (!created.ok) throw new Error(created.message);

      const moved = await updateStudent(created.id, { ...input, className: 'UJI-XII RPL 1' }, actor, tx);
      expect(moved).toEqual({ ok: true, id: created.id });
      expect((await getStudent(created.id, tx))?.className).toBe('UJI-XII RPL 1');

      const audit = await tx
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.entityId, created.id), eq(auditLogs.action, 'student.update')));
      expect(audit).toHaveLength(1);
      expect(audit[0]?.metadata).toEqual({
        before: { name: input.name, className: input.className },
        after: { name: input.name, className: 'UJI-XII RPL 1' },
      });
    });
  });

  it('melaporkan siswa yang tidak ada', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      expect(await updateStudent(crypto.randomUUID(), input, actor, tx)).toEqual({
        ok: false,
        message: 'Siswa tidak ditemukan. Cari ulang siswa di halaman Peminjaman.',
      });
    });
  });
});
