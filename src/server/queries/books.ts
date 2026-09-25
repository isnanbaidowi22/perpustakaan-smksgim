import { and, asc, eq, ilike, or, sql } from 'drizzle-orm';
import type { RecordStatus } from '@/domain/shared/types';
import { offsetOf, PAGE_SIZE } from '@/lib/pagination';
import type { StatusFilter } from '@/lib/search-params';
import { db } from '@/server/db/client';
import type { Executor } from '@/server/db/executor';
import { bookCopies, books, categories, racks } from '@/server/db/schema';
import { isUuid } from '@/server/validation/common';
import { containsPattern } from './like';

export interface Book {
  id: string;
  isbn: string | null;
  title: string;
  author: string;
  publisher: string | null;
  publishYear: number | null;
  categoryId: string | null;
  rackId: string | null;
  /** Nilai numeric dari Postgres, misalnya '85000.00'. */
  price: string;
  description: string | null;
  status: RecordStatus;
}

export interface BookRow {
  id: string;
  title: string;
  author: string;
  isbn: string | null;
  categoryName: string | null;
  rackCode: string | null;
  price: string;
  status: RecordStatus;
  totalCopies: number;
  availableCopies: number;
}

export interface BookFilter {
  q: string;
  /** Kosong berarti semua kategori. */
  categoryId: string;
  status: StatusFilter;
  page: number;
}

export async function listBooks(filter: BookFilter, executor: Executor = db): Promise<{ rows: BookRow[]; total: number }> {
  const pattern = containsPattern(filter.q);
  const where = and(
    filter.q
      ? or(ilike(books.title, pattern), ilike(books.author, pattern), ilike(books.isbn, pattern))
      : undefined,
    isUuid(filter.categoryId) ? eq(books.categoryId, filter.categoryId) : undefined,
    filter.status === 'all' ? undefined : eq(books.status, filter.status),
  );

  // Ketersediaan dihitung dari eksemplar setiap kali dibaca (spec 4.2):
  // penghitung tersimpan adalah sumber klasik data yang tidak sinkron.
  const copyCounts = executor
    .select({
      bookId: bookCopies.bookId,
      total: sql<number>`count(*)::int`.as('total'),
      available: sql<number>`(count(*) filter (where ${bookCopies.status} = 'TERSEDIA'))::int`.as('available'),
    })
    .from(bookCopies)
    .groupBy(bookCopies.bookId)
    .as('copy_counts');

  const rows = await executor
    .select({
      id: books.id,
      title: books.title,
      author: books.author,
      isbn: books.isbn,
      categoryName: categories.name,
      rackCode: racks.code,
      price: books.price,
      status: books.status,
      totalCopies: sql<number>`coalesce(${copyCounts.total}, 0)`,
      availableCopies: sql<number>`coalesce(${copyCounts.available}, 0)`,
    })
    .from(books)
    .leftJoin(categories, eq(categories.id, books.categoryId))
    .leftJoin(racks, eq(racks.id, books.rackId))
    .leftJoin(copyCounts, eq(copyCounts.bookId, books.id))
    .where(where)
    .orderBy(asc(books.title))
    .limit(PAGE_SIZE)
    .offset(offsetOf(filter.page));

  const [{ total }] = await executor.select({ total: sql<number>`count(*)::int` }).from(books).where(where);
  return { rows, total };
}

export async function getBook(id: string, executor: Executor = db): Promise<Book | null> {
  if (!isUuid(id)) return null;
  const [book] = await executor
    .select({
      id: books.id,
      isbn: books.isbn,
      title: books.title,
      author: books.author,
      publisher: books.publisher,
      publishYear: books.publishYear,
      categoryId: books.categoryId,
      rackId: books.rackId,
      price: books.price,
      description: books.description,
      status: books.status,
    })
    .from(books)
    .where(eq(books.id, id))
    .limit(1);
  return book ?? null;
}
