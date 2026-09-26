import { and, eq, ne, sql } from 'drizzle-orm';
import { MAX_LABELS } from '@/lib/label-request';
import { db } from '@/server/db/client';
import type { Executor } from '@/server/db/executor';
import { bookCopies, books, racks } from '@/server/db/schema';
import { isUuid } from '@/server/validation/common';

export interface LabelCopy {
  id: string;
  barcode: string;
  bookTitle: string;
  rackCode: string | null;
}

export type LabelQuery = { kind: 'book'; bookId: string } | { kind: 'range'; from: string; to: string };

/**
 * Eksemplar untuk dicetak labelnya, maksimal MAX_LABELS. Rentang dibandingkan
 * dengan `collate "C"` (urutan byte) agar sama dengan pemeriksaan rentang
 * terbalik di `parseLabelRequest`; collation bawaan database dapat
 * mengabaikan tanda baca seperti "-". `bookTitle` (untuk permintaan per
 * judul) membedakan "buku tidak ditemukan" dari "buku ada tapi tidak
 * punya eksemplar aktif" (spec F6): `null` berarti id bukan UUID atau
 * bukunya tidak ada.
 */
export async function findLabelCopies(
  query: LabelQuery,
  executor: Executor = db,
): Promise<{ copies: LabelCopy[]; total: number; bookTitle: string | null }> {
  if (query.kind === 'book' && !isUuid(query.bookId)) return { copies: [], total: 0, bookTitle: null };

  const where = and(
    ne(bookCopies.status, 'NONAKTIF'),
    query.kind === 'book'
      ? eq(bookCopies.bookId, query.bookId)
      : sql`${bookCopies.barcode} collate "C" between ${query.from} and ${query.to}`,
  );

  const [copies, [totalRow], bookRows] = await Promise.all([
    executor
      .select({
        id: bookCopies.id,
        barcode: bookCopies.barcode,
        bookTitle: books.title,
        rackCode: racks.code,
      })
      .from(bookCopies)
      .innerJoin(books, eq(books.id, bookCopies.bookId))
      .leftJoin(racks, eq(racks.id, books.rackId))
      .where(where)
      .orderBy(sql`${bookCopies.barcode} collate "C"`)
      .limit(MAX_LABELS),
    executor
      .select({ total: sql<number>`count(*)::int` })
      .from(bookCopies)
      .where(where),
    query.kind === 'book'
      ? executor.select({ title: books.title }).from(books).where(eq(books.id, query.bookId)).limit(1)
      : Promise.resolve([]),
  ]);

  return {
    copies,
    total: Number(totalRow.total),
    bookTitle: query.kind === 'book' ? bookRows[0]?.title ?? null : null,
  };
}
