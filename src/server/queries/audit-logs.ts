import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import type { IsoDate } from '@/domain/shared/date';
import { AUDIT_KIND_ENTITIES, type AuditKind } from '@/lib/audit-labels';
import { offsetOf, PAGE_SIZE } from '@/lib/pagination';
import { SCHOOL_TIME_ZONE } from '@/lib/school-date';
import { db } from '@/server/db/client';
import type { Executor } from '@/server/db/executor';
import { auditLogs, profiles } from '@/server/db/schema';
import { containsPattern } from './like';

export interface AuditRow {
  id: string;
  createdAt: Date;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: unknown;
  /** null bila pelakunya sudah tidak ada atau catatan dibuat sistem. */
  username: string | null;
  fullName: string | null;
}

export interface AuditFilter {
  q: string;
  kind: AuditKind;
  /** Tanggal sekolah (WIB) saat catatan dibuat. */
  date: IsoDate | null;
  page: number;
}

/**
 * Kata kunci dicari di isi catatan (`metadata::text`: nomor transaksi,
 * barcode, NIS, judul) dan di username pelaku.
 */
export async function listAuditLogs(
  filter: AuditFilter,
  executor: Executor = db,
): Promise<{ rows: AuditRow[]; total: number }> {
  const keyword = filter.q.trim();
  const where = and(
    filter.kind === 'all' ? undefined : inArray(auditLogs.entity, AUDIT_KIND_ENTITIES[filter.kind]),
    filter.date
      ? sql`(${auditLogs.createdAt} at time zone ${SCHOOL_TIME_ZONE})::date = ${filter.date}::date`
      : undefined,
    keyword
      ? or(
          ilike(sql`${auditLogs.metadata}::text`, containsPattern(keyword)),
          ilike(profiles.username, containsPattern(keyword)),
        )
      : undefined,
  );

  const rows = await executor
    .select({
      id: auditLogs.id,
      createdAt: auditLogs.createdAt,
      action: auditLogs.action,
      entity: auditLogs.entity,
      entityId: auditLogs.entityId,
      metadata: auditLogs.metadata,
      username: profiles.username,
      fullName: profiles.fullName,
    })
    .from(auditLogs)
    .leftJoin(profiles, eq(profiles.id, auditLogs.userId))
    .where(where)
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(PAGE_SIZE)
    .offset(offsetOf(filter.page));

  const [{ total }] = await executor
    .select({ total: sql<number>`count(*)::int` })
    .from(auditLogs)
    .leftJoin(profiles, eq(profiles.id, auditLogs.userId))
    .where(where);

  return { rows, total: Number(total) };
}
