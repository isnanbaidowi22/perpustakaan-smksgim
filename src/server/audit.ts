import type { Executor } from '@/server/db/executor';
import { auditLogs } from '@/server/db/schema';

export interface AuditEntry {
  actorId: string;
  /** Format `<entitas>.<aksi>`, misalnya `category.create`. */
  action: string;
  /** Nama tabel yang berubah, misalnya `categories`. */
  entity: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

/**
 * Dipanggil dengan transaksi yang sama dengan perubahan datanya,
 * sehingga perubahan tanpa jejak audit tidak mungkin ter-commit.
 */
export async function writeAudit(executor: Executor, entry: AuditEntry): Promise<void> {
  await executor.insert(auditLogs).values({
    userId: entry.actorId,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    metadata: entry.metadata ?? null,
  });
}
