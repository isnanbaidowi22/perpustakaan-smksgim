import { and, asc, eq, ilike, or, sql } from 'drizzle-orm';
import type { RecordStatus } from '@/domain/shared/types';
import type { Option } from '@/lib/options';
import { offsetOf, PAGE_SIZE } from '@/lib/pagination';
import type { StatusFilter } from '@/lib/search-params';
import { db } from '@/server/db/client';
import type { Executor } from '@/server/db/executor';
import { books, categories } from '@/server/db/schema';
import { isUuid } from '@/server/validation/common';
import { containsPattern } from './like';

export interface Category {
  id: string;
  name: string;
  status: RecordStatus;
}

export interface CategoryRow extends Category {
  bookCount: number;
}

export interface CategoryFilter {
  q: string;
  status: StatusFilter;
  page: number;
}

export async function listCategories(
  filter: CategoryFilter,
  executor: Executor = db,
): Promise<{ rows: CategoryRow[]; total: number }> {
  const where = and(
    filter.q ? ilike(categories.name, containsPattern(filter.q)) : undefined,
    filter.status === 'all' ? undefined : eq(categories.status, filter.status),
  );

  // LEFT JOIN + GROUP BY, bukan subquery ILIKE `${categories.id}` berkorelasi:
  // di drizzle-orm 0.45, `sql` template menulis nama kolom polos tanpa
  // menyebut tabelnya, sehingga "id" di dalam subquery ikut merujuk ke
  // "books"."id" alih-alih "categories"."id" dan jumlahnya selalu salah.
  const rows = await executor
    .select({
      id: categories.id,
      name: categories.name,
      status: categories.status,
      bookCount: sql<number>`count(${books.id})::int`,
    })
    .from(categories)
    .leftJoin(books, eq(books.categoryId, categories.id))
    .where(where)
    .groupBy(categories.id, categories.name, categories.status)
    .orderBy(asc(categories.name))
    .limit(PAGE_SIZE)
    .offset(offsetOf(filter.page));

  const [{ total }] = await executor
    .select({ total: sql<number>`count(*)::int` })
    .from(categories)
    .where(where);

  return { rows, total };
}

export async function getCategory(id: string, executor: Executor = db): Promise<Category | null> {
  if (!isUuid(id)) return null;
  const [category] = await executor
    .select({ id: categories.id, name: categories.name, status: categories.status })
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1);
  return category ?? null;
}

/**
 * Opsi kategori untuk form buku. Kategori nonaktif tidak ditawarkan,
 * kecuali kategori yang sedang dipakai buku yang diedit: tanpa itu,
 * menyimpan ulang buku lama akan diam-diam menghapus kategorinya.
 */
export async function listCategoryOptions(
  includeId: string | null = null,
  executor: Executor = db,
): Promise<Option[]> {
  const active = eq(categories.status, 'active');
  const rows = await executor
    .select({ id: categories.id, name: categories.name, status: categories.status })
    .from(categories)
    .where(includeId && isUuid(includeId) ? or(active, eq(categories.id, includeId)) : active)
    .orderBy(asc(categories.name));

  return rows.map((row) => ({
    value: row.id,
    label: row.status === 'active' ? row.name : `${row.name} (nonaktif)`,
  }));
}
