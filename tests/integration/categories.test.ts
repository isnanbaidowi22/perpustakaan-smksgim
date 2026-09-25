import { describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { auditLogs, books } from '@/server/db/schema';
import { getCategory, listCategories, listCategoryOptions } from '@/server/queries/categories';
import { createCategory, setCategoryStatus, updateCategory } from '@/server/services/categories';
import { testActor, withRollback } from './helpers';

describe('createCategory', () => {
  it('menyimpan kategori dan menulis audit log di transaksi yang sama', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);

      const result = await createCategory({ name: 'UJI-Fiksi' }, actor, tx);

      if (!result.ok) throw new Error(result.message);
      expect(await getCategory(result.id, tx)).toEqual({ id: result.id, name: 'UJI-Fiksi', status: 'active' });
      const audit = await tx
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.entityId, result.id), eq(auditLogs.action, 'category.create')));
      expect(audit).toHaveLength(1);
      expect(audit[0]?.userId).toBe(actor.id);
    });
  });

  it('menolak nama ganda dengan pesan pada kolom nama', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      await createCategory({ name: 'UJI-Fiksi' }, actor, tx);

      const result = await createCategory({ name: 'UJI-Fiksi' }, actor, tx);

      expect(result).toEqual({
        ok: false,
        field: 'name',
        message: 'Kategori "UJI-Fiksi" sudah ada. Gunakan nama lain, atau aktifkan kembali kategori lama bila nonaktif.',
      });
    });
  });
});

describe('updateCategory', () => {
  it('mengganti nama kategori dan mencatatnya', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const created = await createCategory({ name: 'UJI-Fiksi' }, actor, tx);
      if (!created.ok) throw new Error(created.message);

      const result = await updateCategory(created.id, { name: 'UJI-Fiksi Remaja' }, actor, tx);

      expect(result).toEqual({ ok: true, id: created.id });
      expect((await getCategory(created.id, tx))?.name).toBe('UJI-Fiksi Remaja');
      const audit = await tx
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.entityId, created.id), eq(auditLogs.action, 'category.update')));
      expect(audit).toHaveLength(1);
    });
  });

  it('melaporkan kategori yang tidak ada', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);

      const result = await updateCategory(crypto.randomUUID(), { name: 'UJI-X' }, actor, tx);

      expect(result).toEqual({ ok: false, message: 'Kategori tidak ditemukan. Muat ulang halaman daftar kategori.' });
    });
  });

  it('memperlakukan id yang bukan UUID sebagai tidak ditemukan, bukan galat database', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);

      const result = await updateCategory('bukan-uuid', { name: 'UJI-X' }, actor, tx);

      expect(result.ok).toBe(false);
    });
  });
});

describe('setCategoryStatus', () => {
  it('menonaktifkan kategori dan mencatatnya di audit log', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const created = await createCategory({ name: 'UJI-Fiksi' }, actor, tx);
      if (!created.ok) throw new Error(created.message);

      const result = await setCategoryStatus(created.id, 'inactive', actor, tx);

      expect(result.ok).toBe(true);
      expect((await getCategory(created.id, tx))?.status).toBe('inactive');
      const audit = await tx
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.entityId, created.id), eq(auditLogs.action, 'category.deactivate')));
      expect(audit).toHaveLength(1);
    });
  });
});

describe('listCategories', () => {
  it('mencari tanpa membedakan huruf besar dan memfilter status', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      await createCategory({ name: 'UJI-Fiksi Remaja' }, actor, tx);
      const old = await createCategory({ name: 'UJI-Fiksi Lama' }, actor, tx);
      if (!old.ok) throw new Error(old.message);
      await setCategoryStatus(old.id, 'inactive', actor, tx);

      const active = await listCategories({ q: 'uji-fiksi', status: 'active', page: 1 }, tx);
      expect(active.rows.map((row) => row.name)).toEqual(['UJI-Fiksi Remaja']);
      expect(active.total).toBe(1);

      const all = await listCategories({ q: 'uji-fiksi', status: 'all', page: 1 }, tx);
      expect(all.rows.map((row) => row.name)).toEqual(['UJI-Fiksi Lama', 'UJI-Fiksi Remaja']);
      expect(all.total).toBe(2);
    });
  });

  it('menghitung jumlah judul buku di setiap kategori', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const created = await createCategory({ name: 'UJI-Sains' }, actor, tx);
      if (!created.ok) throw new Error(created.message);
      await tx.insert(books).values([
        { title: 'UJI-Fisika', author: 'UJI-Penulis', categoryId: created.id },
        { title: 'UJI-Kimia', author: 'UJI-Penulis', categoryId: created.id },
      ]);

      const { rows } = await listCategories({ q: 'UJI-Sains', status: 'active', page: 1 }, tx);

      expect(rows[0]?.bookCount).toBe(2);
    });
  });
});

describe('listCategoryOptions', () => {
  it('hanya menawarkan kategori aktif, kecuali kategori yang sedang dipakai', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const used = await createCategory({ name: 'UJI-Lama' }, actor, tx);
      if (!used.ok) throw new Error(used.message);
      await setCategoryStatus(used.id, 'inactive', actor, tx);

      const withoutCurrent = await listCategoryOptions(null, tx);
      expect(withoutCurrent.some((option) => option.value === used.id)).toBe(false);

      const withCurrent = await listCategoryOptions(used.id, tx);
      expect(withCurrent).toContainEqual({ value: used.id, label: 'UJI-Lama (nonaktif)' });
    });
  });
});
