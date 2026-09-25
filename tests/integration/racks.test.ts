import { describe, expect, it } from 'vitest';
import { and, desc, eq } from 'drizzle-orm';
import { auditLogs, books } from '@/server/db/schema';
import { getRack, listRackOptions, listRacks } from '@/server/queries/racks';
import { createRack, setRackStatus, updateRack } from '@/server/services/racks';
import { testActor, withRollback } from './helpers';

const input = { code: 'UJI-A1', name: 'UJI Rak A Baris 1', location: 'Ruang Utama' };

describe('createRack', () => {
  it('menyimpan rak dan menulis audit log', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);

      const result = await createRack(input, actor, tx);

      if (!result.ok) throw new Error(result.message);
      expect(await getRack(result.id, tx)).toEqual({ id: result.id, ...input, status: 'active' });
      const audit = await tx
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.entityId, result.id), eq(auditLogs.action, 'rack.create')));
      expect(audit).toHaveLength(1);
    });
  });

  it('menolak kode ganda dengan pesan pada kolom kode', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      await createRack(input, actor, tx);

      const result = await createRack({ ...input, name: 'UJI Rak lain' }, actor, tx);

      expect(result).toEqual({
        ok: false,
        field: 'code',
        message: 'Kode rak "UJI-A1" sudah dipakai rak lain. Gunakan kode yang berbeda.',
      });
    });
  });
});

describe('updateRack dan setRackStatus', () => {
  it('mengubah data rak lalu menonaktifkannya', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const created = await createRack(input, actor, tx);
      if (!created.ok) throw new Error(created.message);

      expect(await updateRack(created.id, { ...input, location: null }, actor, tx)).toEqual({ ok: true, id: created.id });
      expect((await getRack(created.id, tx))?.location).toBeNull();

      const audit = await tx
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.entityId, created.id), eq(auditLogs.action, 'rack.update')))
        .orderBy(desc(auditLogs.createdAt));
      expect(audit[0]?.metadata).toEqual({
        before: { code: input.code, name: input.name, location: input.location },
        after: { code: input.code, name: input.name, location: null },
      });

      expect((await setRackStatus(created.id, 'inactive', actor, tx)).ok).toBe(true);
      expect((await getRack(created.id, tx))?.status).toBe('inactive');
    });
  });

  it('melaporkan rak yang tidak ada', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      expect(await setRackStatus(crypto.randomUUID(), 'inactive', actor, tx)).toEqual({
        ok: false,
        message: 'Rak tidak ditemukan. Muat ulang halaman daftar rak.',
      });
    });
  });
});

describe('listRacks', () => {
  it('mencari berdasarkan kode atau nama dan menghitung judul buku', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const created = await createRack(input, actor, tx);
      if (!created.ok) throw new Error(created.message);
      await tx.insert(books).values({ title: 'UJI-Judul', author: 'UJI-Penulis', rackId: created.id });

      const byCode = await listRacks({ q: 'uji-a1', status: 'active', page: 1 }, tx);
      expect(byCode.rows).toEqual([{ id: created.id, ...input, status: 'active', bookCount: 1 }]);

      const byName = await listRacks({ q: 'Rak A Baris', status: 'all', page: 1 }, tx);
      expect(byName.rows.some((row) => row.id === created.id)).toBe(true);
    });
  });
});

describe('listRackOptions', () => {
  it('memberi label kode dan nama, dan menyertakan rak nonaktif yang sedang dipakai', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const created = await createRack(input, actor, tx);
      if (!created.ok) throw new Error(created.message);
      await setRackStatus(created.id, 'inactive', actor, tx);

      expect((await listRackOptions(null, tx)).some((option) => option.value === created.id)).toBe(false);
      expect(await listRackOptions(created.id, tx)).toContainEqual({
        value: created.id,
        label: 'UJI-A1 — UJI Rak A Baris 1 (nonaktif)',
      });
    });
  });
});
