import { describe, expect, it } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import { academicYears, auditLogs } from '@/server/db/schema';
import {
  getAcademicYear, getActiveAcademicYear, listAcademicYearOptions, listAcademicYears,
} from '@/server/queries/academic-years';
import { activateAcademicYear, createAcademicYear, updateAcademicYear } from '@/server/services/academic-years';
import { testActor, withRollback } from './helpers';

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

const input = { name: '2091/2092', startDate: '2091-07-01', endDate: '2092-06-30' };

async function activeIds(tx: Parameters<Parameters<typeof withRollback>[0]>[0]): Promise<string[]> {
  const rows = await tx.select({ id: academicYears.id }).from(academicYears).where(eq(academicYears.isActive, true));
  return rows.map((row) => row.id);
}

describe('createAcademicYear', () => {
  it('menyimpan tahun ajaran tanpa menyentuh tahun aktif bila tidak diminta', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const before = await activeIds(tx);

      const result = await createAcademicYear({ ...input, activate: false }, actor, tx);

      if (!result.ok) throw new Error(result.message);
      expect(await getAcademicYear(result.id, tx)).toEqual({ id: result.id, ...input, isActive: false });
      expect(await activeIds(tx)).toEqual(before);
      const [audit] = await tx
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.entityId, result.id), eq(auditLogs.action, 'academic_year.create')));
      expect(audit?.metadata).toEqual({ ...input, activated: false });
    });
  });

  it('menjadikan tahun baru satu-satunya yang aktif bila diminta', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);

      const result = await createAcademicYear({ ...input, activate: true }, actor, tx);

      if (!result.ok) throw new Error(result.message);
      expect(await activeIds(tx)).toEqual([result.id]);
    });
  });

  it('menolak nama ganda dengan pesan pada kolom nama', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      await createAcademicYear({ ...input, activate: false }, actor, tx);

      expect(await createAcademicYear({ ...input, activate: false }, actor, tx)).toEqual({
        ok: false,
        field: 'name',
        message: 'Tahun ajaran 2091/2092 sudah ada. Ubah data yang lama bila tanggalnya perlu diperbaiki.',
      });
    });
  });
});

describe('updateAcademicYear', () => {
  it('mengubah tanggal dan mencatat nilai sebelum dan sesudah', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const created = await createAcademicYear({ ...input, activate: false }, actor, tx);
      if (!created.ok) throw new Error(created.message);
      const changed = { ...input, startDate: '2091-07-15' };

      expect(await updateAcademicYear(created.id, changed, actor, tx)).toEqual({ ok: true, id: created.id });

      expect((await getAcademicYear(created.id, tx))?.startDate).toBe('2091-07-15');
      const [audit] = await tx
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.entityId, created.id), eq(auditLogs.action, 'academic_year.update')));
      expect(audit?.metadata).toEqual({ before: input, after: changed });
    });
  });

  it('melaporkan tahun ajaran yang tidak ada', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      expect(await updateAcademicYear(crypto.randomUUID(), input, actor, tx)).toEqual({
        ok: false,
        message: 'Tahun ajaran tidak ditemukan. Muat ulang halaman daftar tahun ajaran.',
      });
    });
  });
});

describe('activateAcademicYear', () => {
  it('memindahkan tanda aktif dan mencatat tahun aktif sebelumnya', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const previous = await getActiveAcademicYear(tx);
      const created = await createAcademicYear({ ...input, activate: false }, actor, tx);
      if (!created.ok) throw new Error(created.message);

      expect(await activateAcademicYear(created.id, actor, tx)).toEqual({ ok: true, id: created.id });

      expect(await activeIds(tx)).toEqual([created.id]);
      const [audit] = await tx
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.entityId, created.id), eq(auditLogs.action, 'academic_year.activate')));
      expect(audit?.metadata).toEqual({ name: '2091/2092', previous: previous?.name ?? null });
    });
  });

  it('tidak menulis audit bila tahun itu sudah aktif', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const created = await createAcademicYear({ ...input, activate: true }, actor, tx);
      if (!created.ok) throw new Error(created.message);

      expect(await activateAcademicYear(created.id, actor, tx)).toEqual({ ok: true, id: created.id });

      const audit = await tx
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.entityId, created.id), eq(auditLogs.action, 'academic_year.activate')));
      expect(audit).toHaveLength(0);
    });
  });

  it('dapat mengaktifkan tahun ajaran saat belum ada yang aktif', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const created = await createAcademicYear({ ...input, activate: false }, actor, tx);
      if (!created.ok) throw new Error(created.message);
      await tx.execute(sql`update academic_years set is_active = false`);

      expect(await activateAcademicYear(created.id, actor, tx)).toEqual({ ok: true, id: created.id });
      expect(await activeIds(tx)).toEqual([created.id]);
    });
  });
});

describe('listAcademicYears dan getAcademicYear', () => {
  it('mengembalikan tanggal sebagai untai dan menolak id bukan UUID', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const created = await createAcademicYear({ ...input, activate: false }, actor, tx);
      if (!created.ok) throw new Error(created.message);

      expect(await listAcademicYears(tx)).toContainEqual({ id: created.id, ...input, isActive: false });
      expect(await getAcademicYear('bukan-uuid', tx)).toBeNull();
    });
  });
});
