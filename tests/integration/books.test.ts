import { describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { auditLogs, bookCopies } from '@/server/db/schema';
import { getBook, listBooks } from '@/server/queries/books';
import { createCategory } from '@/server/services/categories';
import { createBook, setBookStatus, updateBook, ZERO_PRICE_NOTICE } from '@/server/services/books';
import type { BookInput } from '@/server/validation/book';
import { testActor, withRollback } from './helpers';

const input: BookInput = {
  isbn: '9786021234567',
  title: 'UJI-Pemrograman Web',
  author: 'UJI Budi Raharjo',
  publisher: 'Informatika',
  publishYear: 2024,
  categoryId: null,
  rackId: null,
  price: 85_000,
  description: null,
};

describe('createBook', () => {
  it('menyimpan buku beserta harganya dan menulis audit log', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);

      const result = await createBook(input, actor, tx);

      expect(result).toEqual({ ok: true, id: expect.any(String) });
      if (!result.ok) return;
      expect(await getBook(result.id, tx)).toMatchObject({ title: 'UJI-Pemrograman Web', price: '85000.00', status: 'active' });
      const audit = await tx
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.entityId, result.id), eq(auditLogs.action, 'book.create')));
      expect(audit).toHaveLength(1);
    });
  });

  it('memperingatkan bila harga nol karena biaya ganti ikut nol', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const result = await createBook({ ...input, price: 0 }, actor, tx);
      expect(result).toEqual({ ok: true, id: expect.any(String), notice: ZERO_PRICE_NOTICE });
    });
  });
});

describe('updateBook', () => {
  it('mengubah data buku', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const created = await createBook(input, actor, tx);
      if (!created.ok) throw new Error(created.message);

      const result = await updateBook(created.id, { ...input, price: 92_000, publishYear: 2025 }, actor, tx);

      expect(result).toEqual({ ok: true, id: created.id });
      expect(await getBook(created.id, tx)).toMatchObject({ price: '92000.00', publishYear: 2025 });
    });
  });

  it('melaporkan buku yang tidak ada', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      expect(await updateBook(crypto.randomUUID(), input, actor, tx)).toEqual({
        ok: false,
        message: 'Buku tidak ditemukan. Muat ulang halaman daftar buku.',
      });
    });
  });
});

describe('setBookStatus', () => {
  it('menolak menonaktifkan buku yang eksemplarnya sedang dipinjam', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const created = await createBook(input, actor, tx);
      if (!created.ok) throw new Error(created.message);
      await tx.insert(bookCopies).values([
        { bookId: created.id, barcode: 'UJI-000001', status: 'DIPINJAM' },
        { bookId: created.id, barcode: 'UJI-000002', status: 'TERSEDIA' },
      ]);

      const result = await setBookStatus(created.id, 'inactive', actor, tx);

      expect(result).toEqual({
        ok: false,
        message:
          'Buku "UJI-Pemrograman Web" masih memiliki 1 eksemplar yang sedang dipinjam. Nonaktifkan setelah semuanya kembali.',
      });
      expect((await getBook(created.id, tx))?.status).toBe('active');
    });
  });

  it('menonaktifkan buku tanpa eksemplar yang dipinjam', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const created = await createBook(input, actor, tx);
      if (!created.ok) throw new Error(created.message);

      expect((await setBookStatus(created.id, 'inactive', actor, tx)).ok).toBe(true);
      expect((await getBook(created.id, tx))?.status).toBe('inactive');
    });
  });
});

describe('listBooks', () => {
  it('menghitung eksemplar tersedia dari book_copies, bukan dari kolom tersimpan', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const created = await createBook(input, actor, tx);
      if (!created.ok) throw new Error(created.message);
      await tx.insert(bookCopies).values([
        { bookId: created.id, barcode: 'UJI-000001', status: 'TERSEDIA' },
        { bookId: created.id, barcode: 'UJI-000002', status: 'DIPINJAM' },
        { bookId: created.id, barcode: 'UJI-000003', status: 'RUSAK' },
      ]);

      const { rows } = await listBooks({ q: 'UJI-Pemrograman', categoryId: '', status: 'active', page: 1 }, tx);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ totalCopies: 3, availableCopies: 1 });
    });
  });

  it('mencari berdasarkan penulis atau ISBN dan memfilter kategori', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const category = await createCategory({ name: 'UJI-Informatika' }, actor, tx);
      if (!category.ok) throw new Error(category.message);
      await createBook({ ...input, categoryId: category.id }, actor, tx);
      await createBook({ ...input, title: 'UJI-Basis Data', isbn: null }, actor, tx);

      const byAuthor = await listBooks({ q: 'uji budi', categoryId: '', status: 'active', page: 1 }, tx);
      expect(byAuthor.total).toBe(2);

      const byIsbn = await listBooks({ q: '9786021234567', categoryId: '', status: 'active', page: 1 }, tx);
      expect(byIsbn.rows.map((row) => row.title)).toContain('UJI-Pemrograman Web');

      const byCategory = await listBooks({ q: 'UJI', categoryId: category.id, status: 'active', page: 1 }, tx);
      expect(byCategory.rows.map((row) => [row.title, row.categoryName])).toEqual([
        ['UJI-Pemrograman Web', 'UJI-Informatika'],
      ]);
    });
  });
});
