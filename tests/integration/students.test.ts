import { describe, expect, it } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import type { StudentInput } from '@/server/validation/student';
import { academicYears, auditLogs } from '@/server/db/schema';
import { getStudent, listClassNames, listStudents } from '@/server/queries/students';
import { createStudent, setStudentStatus, updateStudent } from '@/server/services/students';
import type { Transaction } from '@/server/db/executor';
import { testActor, withRollback } from './helpers';

const input: StudentInput = {
  nis: 'UJI-0001',
  name: 'UJI Ahmad Fauzi',
  className: 'UJI-XI RPL 1',
  major: 'RPL',
  gender: 'L',
  phone: null,
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
  it('memakai tahun ajaran aktif bila tidak dipilih, dan menulis audit log', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const yearId = await activeTestYear(tx);

      const result = await createStudent(input, actor, tx);

      if (!result.ok) throw new Error(result.message);
      expect(await getStudent(result.id, tx)).toMatchObject({ nis: 'UJI-0001', academicYearId: yearId, status: 'active' });
      const audit = await tx
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.entityId, result.id), eq(auditLogs.action, 'student.create')));
      expect(audit).toHaveLength(1);
    });
  });

  it('menolak NIS ganda dengan menyebut nama pemiliknya', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      await createStudent(input, actor, tx);

      const result = await createStudent({ ...input, name: 'UJI Orang Lain' }, actor, tx);

      expect(result).toEqual({
        ok: false,
        field: 'nis',
        message:
          'NIS UJI-0001 sudah terdaftar atas nama UJI Ahmad Fauzi. Periksa kembali NIS, atau cari siswa tersebut di daftar.',
      });
    });
  });
});

describe('updateStudent dan setStudentStatus', () => {
  it('memindahkan kelas lalu menonaktifkan siswa', async () => {
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
        before: { nis: input.nis, name: input.name, className: input.className },
        after: { nis: input.nis, name: input.name, className: 'UJI-XII RPL 1' },
      });

      expect((await setStudentStatus(created.id, 'inactive', actor, tx)).ok).toBe(true);
      expect((await getStudent(created.id, tx))?.status).toBe('inactive');
    });
  });

  it('melaporkan siswa yang tidak ada', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      expect(await updateStudent(crypto.randomUUID(), input, actor, tx)).toEqual({
        ok: false,
        message: 'Siswa tidak ditemukan. Muat ulang halaman daftar siswa.',
      });
    });
  });
});

describe('listStudents dan listClassNames', () => {
  it('mencari berdasarkan NIS atau nama, dan memfilter kelas', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      await activeTestYear(tx);
      await createStudent(input, actor, tx);
      await createStudent({ ...input, nis: 'UJI-0002', name: 'UJI Siti Aminah', className: 'UJI-X TKJ 2' }, actor, tx);

      const byNis = await listStudents({ q: 'uji-0001', className: '', status: 'active', page: 1 }, tx);
      expect(byNis.rows.map((row) => row.name)).toEqual(['UJI Ahmad Fauzi']);
      expect(byNis.rows[0]?.academicYearName).toBe('UJI-2090/2091');

      // "UJI Siti", bukan "Siti Aminah": data seed juga punya siswa bernama Siti Aminah.
      const byName = await listStudents({ q: 'uji siti', className: '', status: 'active', page: 1 }, tx);
      expect(byName.rows.map((row) => row.nis)).toEqual(['UJI-0002']);

      const byClass = await listStudents({ q: 'UJI', className: 'UJI-X TKJ 2', status: 'active', page: 1 }, tx);
      expect(byClass.total).toBe(1);

      const classes = await listClassNames(tx);
      expect(classes).toContain('UJI-XI RPL 1');
      expect(classes).toContain('UJI-X TKJ 2');
    });
  });
});
