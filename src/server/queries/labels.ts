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
 * mengabaikan tanda baca seperti "-".
 */
export async function findLabelCopies(
  query: LabelQuery,
  executor: Executor = db,
): Promise<{ copies: LabelCopy[]; total: number }> {
  if (query.kind === 'book' && !isUuid(query.bookId)) return { copies: [], total: 0 };

  const where = and(
    ne(bookCopies.status, 'NONAKTIF'),
    query.kind === 'book'
      ? eq(bookCopies.bookId, query.bookId)
      : sql`${bookCopies.barcode} collate "C" between ${query.from} and ${query.to}`,
  );

  const copies = await executor
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
    .limit(MAX_LABELS);

  const [{ total }] = await executor
    .select({ total: sql<number>`count(*)::int` })
    .from(bookCopies)
    .where(where);

  return { copies, total: Number(total) };
}
