import { eq } from 'drizzle-orm';
import type { Actor, RecordStatus } from '@/domain/shared/types';
import { writeAudit } from '@/server/audit';
import { db } from '@/server/db/client';
import { uniqueViolation } from '@/server/db/errors';
import type { Executor } from '@/server/db/executor';
import { racks } from '@/server/db/schema';
import { isUuid } from '@/server/validation/common';
import type { RackInput } from '@/server/validation/rack';
import { fail, ok, type ServiceResult } from './result';

const NOT_FOUND = 'Rak tidak ditemukan. Muat ulang halaman daftar rak.';

function duplicate(code: string): ServiceResult {
  return fail(`Kode rak "${code}" sudah dipakai rak lain. Gunakan kode yang berbeda.`, 'code');
}

export async function createRack(input: RackInput, actor: Actor, executor: Executor = db): Promise<ServiceResult> {
  try {
    return await executor.transaction(async (tx) => {
      const [created] = await tx.insert(racks).values(input).returning({ id: racks.id });
      await writeAudit(tx, {
        actorId: actor.id,
        action: 'rack.create',
        entity: 'racks',
        entityId: created.id,
        metadata: { ...input },
      });
      return ok(created.id);
    });
  } catch (error) {
    if (uniqueViolation(error) === 'racks_code_unique') return duplicate(input.code);
    throw error;
  }
}

export async function updateRack(
  id: string,
  input: RackInput,
  actor: Actor,
  executor: Executor = db,
): Promise<ServiceResult> {
  if (!isUuid(id)) return fail(NOT_FOUND);
  try {
    return await executor.transaction(async (tx) => {
      const [current] = await tx
        .select({ code: racks.code, name: racks.name, location: racks.location })
        .from(racks)
        .where(eq(racks.id, id))
        .for('update');
      if (!current) return fail(NOT_FOUND);

      const [updated] = await tx.update(racks).set(input).where(eq(racks.id, id)).returning({ id: racks.id });
      if (!updated) return fail(NOT_FOUND);

      await writeAudit(tx, {
        actorId: actor.id,
        action: 'rack.update',
        entity: 'racks',
        entityId: id,
        metadata: { before: current, after: { ...input } },
      });
      return ok(id);
    });
  } catch (error) {
    if (uniqueViolation(error) === 'racks_code_unique') return duplicate(input.code);
    throw error;
  }
}

export async function setRackStatus(
  id: string,
  status: RecordStatus,
  actor: Actor,
  executor: Executor = db,
): Promise<ServiceResult> {
  if (!isUuid(id)) return fail(NOT_FOUND);
  return executor.transaction(async (tx) => {
    const [updated] = await tx
      .update(racks)
      .set({ status })
      .where(eq(racks.id, id))
      .returning({ id: racks.id, code: racks.code });
    if (!updated) return fail(NOT_FOUND);

    await writeAudit(tx, {
      actorId: actor.id,
      action: status === 'active' ? 'rack.activate' : 'rack.deactivate',
      entity: 'racks',
      entityId: id,
      metadata: { code: updated.code },
    });
    return ok(id);
  });
}
