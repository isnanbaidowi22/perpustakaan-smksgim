import { describe, expect, it } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import type { Actor } from '@/domain/shared/types';
import type { Transaction } from '@/server/db/executor';
import { auditLogs, bookCopies } from '@/server/db/schema';
import { listCopiesOfBook } from '@/server/queries/copies';
import { createBook, setBookStatus } from '@/server/services/books';
import { addCopies, changeCopyStatus } from '@/server/services/copies';
import { testActor, withRollback } from './helpers';

async function testBook(tx: Transaction, actor: Actor): Promise<string> {
  const result = await createBook({
    isbn: null, title: 'UJI-Eksemplar', author: 'UJI-Penulis', publisher: null, publishYear: null,
    categoryId: null, rackId: null, price: 50_000, description: null,
  }, actor, tx);
  if (!result.ok) throw new Error(result.message);
  return result.id;
}

const auto = { count: 3, barcode: null, acquisitionDate: '2026-07-15', notes: null };

describe('addCopies', () => {
  it('membuat barcode otomatis yang berurutan dan mencatatnya', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const bookId = await testBook(tx, actor);

      const result = await addCopies(bookId, auto, actor, tx);

      if (!result.ok) throw new Error(result.message);
      const copies = await listCopiesOfBook(bookId, tx);
      expect(copies).toHaveLength(3);
      const numbers = copies.map((copy) => {
        expect(copy.barcode).toMatch(/^BK-\d{6,}$/);
        expect(copy.status).toBe('TERSEDIA');
        return Number(copy.barcode.slice(3));
      });
      expect(numbers).toEqual([numbers[0], numbers[0]! + 1, numbers[0]! + 2]);
      expect(result.notice).toBe(`Barcode: ${copies[0]?.barcode} s.d. ${copies[2]?.barcode}.`);

      const [audit] = await tx
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.entityId, bookId), eq(auditLogs.action, 'copy.create')));
      expect(audit?.metadata).toEqual({ barcodes: copies.map((copy) => copy.barcode) });
    });
  });

  it('melanjutkan nomor setelah barcode BK- terbesar saat penghitung belum pernah dipakai', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const bookId = await testBook(tx, actor);
      // Di dalam transaksi yang di-rollback: kondisikan seolah penghitung belum ada,
      // dan ada barcode lama BK-999990 yang dibuat di luar penghitung (misalnya oleh seed).
      await tx.execute(sql`delete from counters where scope = 'copy_barcode'`);
      await tx.insert(bookCopies).values({ bookId, barcode: 'BK-999990' });

      await addCopies(bookId, { ...auto, count: 1 }, actor, tx);

      const barcodes = (await listCopiesOfBook(bookId, tx)).map((copy) => copy.barcode);
      expect(barcodes).toEqual(['BK-999990', 'BK-999991']);
    });
  });

  it('menyimpan satu barcode manual untuk koleksi lama', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const bookId = await testBook(tx, actor);

      const result = await addCopies(bookId, { ...auto, count: 1, barcode: 'UJI-LAMA-01' }, actor, tx);

      expect(result).toEqual({ ok: true, id: expect.any(String), notice: 'Barcode: UJI-LAMA-01.' });
    });
  });

  it('menolak barcode manual yang sudah dipakai, pada kolom barcode', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const bookId = await testBook(tx, actor);
      await addCopies(bookId, { ...auto, count: 1, barcode: 'UJI-LAMA-01' }, actor, tx);

      const result = await addCopies(bookId, { ...auto, count: 1, barcode: 'UJI-LAMA-01' }, actor, tx);

      expect(result).toEqual({
        ok: false,
        field: 'barcode',
        message: 'Barcode UJI-LAMA-01 sudah dipakai eksemplar lain. Periksa label pada buku.',
      });
    });
  });

  it('menolak menambah eksemplar ke buku nonaktif', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const bookId = await testBook(tx, actor);
      await setBookStatus(bookId, 'inactive', actor, tx);

      expect(await addCopies(bookId, auto, actor, tx)).toEqual({
        ok: false,
        message: 'Buku "UJI-Eksemplar" nonaktif. Aktifkan bukunya terlebih dahulu sebelum menambah eksemplar.',
      });
    });
  });
});

describe('changeCopyStatus', () => {
  async function copyWithStatus(tx: Transaction, actor: Actor, status: 'RUSAK' | 'DIPINJAM' | 'TERSEDIA') {
    const bookId = await testBook(tx, actor);
    const [copy] = await tx
      .insert(bookCopies)
      .values({ bookId, barcode: `UJI-${status}`, status })
      .returning({ id: bookCopies.id });
    return copy.id;
  }

  it('memulihkan eksemplar rusak dan mencatat status sebelum dan sesudahnya', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const copyId = await copyWithStatus(tx, actor, 'RUSAK');

      const result = await changeCopyStatus(copyId, 'RESTORE', actor, tx);

      expect(result).toEqual({ ok: true, id: copyId });
      const [copy] = await tx.select().from(bookCopies).where(eq(bookCopies.id, copyId));
      expect(copy?.status).toBe('TERSEDIA');
      const [audit] = await tx
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.entityId, copyId), eq(auditLogs.action, 'copy.restore')));
      expect(audit?.metadata).toEqual({ barcode: 'UJI-RUSAK', from: 'RUSAK', to: 'TERSEDIA' });
    });
  });

  it('menolak mengubah eksemplar yang sedang dipinjam', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const copyId = await copyWithStatus(tx, actor, 'DIPINJAM');

      expect(await changeCopyStatus(copyId, 'DEACTIVATE', actor, tx)).toEqual({
        ok: false,
        message: 'Eksemplar UJI-DIPINJAM sedang dipinjam. Statusnya hanya dapat berubah melalui pengembalian.',
      });
    });
  });

  it('menolak aksi yang tidak berlaku untuk status saat ini', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const copyId = await copyWithStatus(tx, actor, 'TERSEDIA');

      expect(await changeCopyStatus(copyId, 'RESTORE', actor, tx)).toEqual({
        ok: false,
        message: 'Eksemplar UJI-TERSEDIA berstatus TERSEDIA, sehingga aksi "Pulihkan ke tersedia" tidak berlaku.',
      });
    });
  });
});
