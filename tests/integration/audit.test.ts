import { describe, expect, it } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import { writeAudit } from '@/server/audit';
import { auditLogs } from '@/server/db/schema';
import { testActor, withRollback } from './helpers';

describe('writeAudit', () => {
  it('menyimpan pelaku, aksi, entitas, dan metadata', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const entityId = crypto.randomUUID();

      await writeAudit(tx, {
        actorId: actor.id,
        action: 'category.create',
        entity: 'categories',
        entityId,
        metadata: { name: 'UJI-Fiksi' },
      });

      const [row] = await tx
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.entity, 'categories'), eq(auditLogs.entityId, entityId)));
      expect(row).toMatchObject({
        userId: actor.id,
        action: 'category.create',
        metadata: { name: 'UJI-Fiksi' },
      });
    });
  });

  it('menyimpan entity_id kosong untuk tabel tanpa id UUID', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);

      await writeAudit(tx, {
        actorId: actor.id,
        action: 'settings.update',
        entity: 'library_settings',
        metadata: { marker: 'UJI-audit-tanpa-id' },
      });

      const [row] = await tx
        .select()
        .from(auditLogs)
        .where(sql`${auditLogs.metadata} ->> 'marker' = 'UJI-audit-tanpa-id'`);
      expect(row?.entityId).toBeNull();
    });
  });
});
