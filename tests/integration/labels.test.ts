import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { MAX_LABELS } from '@/lib/label-request';
import { bookCopies } from '@/server/db/schema';
import { findLabelCopies } from '@/server/queries/labels';
import { circulationFixture } from './circulation-fixture';
import { withRollback } from './helpers';

describe('findLabelCopies', () => {
  it('per judul: seluruh eksemplar yang tidak nonaktif, urut barcode, dengan judul dan rak', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx, { copies: 3 });
      await tx.update(bookCopies).set({ status: 'NONAKTIF' }).where(eq(bookCopies.id, fx.copies[1].id));

      const result = await findLabelCopies({ kind: 'book', bookId: fx.bookId }, tx);

      expect(result.total).toBe(2);
      expect(result.copies).toEqual([
        { id: fx.copies[0].id, barcode: 'UJI-SRK-01', bookTitle: 'UJI-Buku Sirkulasi', rackCode: 'UJI-R1' },
        { id: fx.copies[2].id, barcode: 'UJI-SRK-03', bookTitle: 'UJI-Buku Sirkulasi', rackCode: 'UJI-R1' },
      ]);
    });
  });

  it('per rentang: barcode di antara kedua ujung, termasuk ujungnya', async () => {
    await withRollback(async (tx) => {
      await circulationFixture(tx, { copies: 5 });

      const result = await findLabelCopies({ kind: 'range', from: 'UJI-SRK-02', to: 'UJI-SRK-04' }, tx);

      expect(result.total).toBe(3);
      expect(result.copies.map((copy) => copy.barcode)).toEqual(['UJI-SRK-02', 'UJI-SRK-03', 'UJI-SRK-04']);
    });
  });

  it('membatasi jumlah label tetapi melaporkan jumlah seluruhnya', async () => {
    await withRollback(async (tx) => {
      await circulationFixture(tx, { copies: MAX_LABELS + 5 });

      const result = await findLabelCopies({ kind: 'range', from: 'UJI-SRK-', to: 'UJI-SRK-~' }, tx);

      expect(result.total).toBe(MAX_LABELS + 5);
      expect(result.copies).toHaveLength(MAX_LABELS);
    });
  });

  it('mengembalikan kosong untuk id buku yang bukan UUID', async () => {
    await withRollback(async (tx) => {
      expect(await findLabelCopies({ kind: 'book', bookId: 'bukan-uuid' }, tx))
        .toEqual({ copies: [], total: 0, bookTitle: null });
    });
  });

  it('mengembalikan bookTitle null untuk id UUID yang tidak ada di tabel buku', async () => {
    await withRollback(async (tx) => {
      expect(await findLabelCopies({ kind: 'book', bookId: crypto.randomUUID() }, tx))
        .toEqual({ copies: [], total: 0, bookTitle: null });
    });
  });

  it('membedakan buku yang ada tetapi seluruh eksemplarnya nonaktif', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx, { copies: 2 });
      await tx.update(bookCopies).set({ status: 'NONAKTIF' }).where(eq(bookCopies.bookId, fx.bookId));

      expect(await findLabelCopies({ kind: 'book', bookId: fx.bookId }, tx))
        .toEqual({ copies: [], total: 0, bookTitle: 'UJI-Buku Sirkulasi' });
    });
  });
});
