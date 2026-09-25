import { and, asc, eq, ilike, or, sql } from 'drizzle-orm';
import type { RecordStatus } from '@/domain/shared/types';
import type { Option } from '@/lib/options';
import { offsetOf, PAGE_SIZE } from '@/lib/pagination';
import type { StatusFilter } from '@/lib/search-params';
import { db } from '@/server/db/client';
import type { Executor } from '@/server/db/executor';
import { books, racks } from '@/server/db/schema';
import { isUuid } from '@/server/validation/common';
import { containsPattern } from './like';

export interface Rack {
  id: string;
  code: string;
  name: string;
  location: string | null;
  status: RecordStatus;
}

export interface RackRow extends Rack {
  bookCount: number;
}

export interface RackFilter {
  q: string;
  status: StatusFilter;
  page: number;
}

const rackColumns = {
  id: racks.id,
  code: racks.code,
  name: racks.name,
  location: racks.location,
  status: racks.status,
};

export async function listRacks(filter: RackFilter, executor: Executor = db): Promise<{ rows: RackRow[]; total: number }> {
  const pattern = containsPattern(filter.q);
  const where = and(
    filter.q ? or(ilike(racks.code, pattern), ilike(racks.name, pattern)) : undefined,
    filter.status === 'all' ? undefined : eq(racks.status, filter.status),
  );

  // LEFT JOIN + GROUP BY, bukan subquery ILIKE `${racks.id}` berkorelasi:
  // di drizzle-orm 0.45, `sql` template menulis nama kolom polos tanpa
  // menyebut tabelnya, sehingga "id" di dalam subquery ikut merujuk ke
  // "books"."id" alih-alih "racks"."id" dan jumlahnya selalu salah.
  const rows = await executor
    .select({
      ...rackColumns,
      bookCount: sql<number>`count(${books.id})::int`,
    })
    .from(racks)
    .leftJoin(books, eq(books.rackId, racks.id))
    .where(where)
    .groupBy(racks.id, racks.code, racks.name, racks.location, racks.status)
    .orderBy(asc(racks.code))
    .limit(PAGE_SIZE)
    .offset(offsetOf(filter.page));

  const [{ total }] = await executor.select({ total: sql<number>`count(*)::int` }).from(racks).where(where);
  return { rows, total };
}

export async function getRack(id: string, executor: Executor = db): Promise<Rack | null> {
  if (!isUuid(id)) return null;
  const [rack] = await executor.select(rackColumns).from(racks).where(eq(racks.id, id)).limit(1);
  return rack ?? null;
}

/** Sama seperti listCategoryOptions: rak nonaktif hanya muncul bila sedang dipakai. */
export async function listRackOptions(includeId: string | null = null, executor: Executor = db): Promise<Option[]> {
  const active = eq(racks.status, 'active');
  const rows = await executor
    .select(rackColumns)
    .from(racks)
    .where(includeId && isUuid(includeId) ? or(active, eq(racks.id, includeId)) : active)
    .orderBy(asc(racks.code));

  return rows.map((row) => ({
    value: row.id,
    label: `${row.code} — ${row.name}${row.status === 'active' ? '' : ' (nonaktif)'}`,
  }));
}
