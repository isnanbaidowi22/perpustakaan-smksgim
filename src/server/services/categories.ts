import { eq } from 'drizzle-orm';
import type { Actor, RecordStatus } from '@/domain/shared/types';
import { writeAudit } from '@/server/audit';
import { db } from '@/server/db/client';
import { uniqueViolation } from '@/server/db/errors';
import type { Executor } from '@/server/db/executor';
import { categories } from '@/server/db/schema';
import type { CategoryInput } from '@/server/validation/category';
import { isUuid } from '@/server/validation/common';
import { fail, ok, type ServiceResult } from './result';

const NOT_FOUND = 'Kategori tidak ditemukan. Muat ulang halaman daftar kategori.';

function duplicate(name: string): ServiceResult {
  return fail(
    `Kategori "${name}" sudah ada. Gunakan nama lain, atau aktifkan kembali kategori lama bila nonaktif.`,
    'name',
  );
}

export async function createCategory(
  input: CategoryInput,
  actor: Actor,
  executor: Executor = db,
): Promise<ServiceResult> {
  try {
    // Transaksi bersarang menjadi savepoint bila `executor` sudah transaksi,
    // sehingga pelanggaran unik di sini tidak merusak transaksi pemanggil.
    return await executor.transaction(async (tx) => {
      const [created] = await tx.insert(categories).values({ name: input.name }).returning({ id: categories.id });
      await writeAudit(tx, {
        actorId: actor.id,
        action: 'category.create',
        entity: 'categories',
        entityId: created.id,
        metadata: { name: input.name },
      });
      return ok(created.id);
    });
  } catch (error) {
    if (uniqueViolation(error) === 'categories_name_unique') return duplicate(input.name);
    throw error;
  }
}

export async function updateCategory(
  id: string,
  input: CategoryInput,
  actor: Actor,
  executor: Executor = db,
): Promise<ServiceResult> {
  if (!isUuid(id)) return fail(NOT_FOUND);
  try {
    return await executor.transaction(async (tx) => {
      // Dibaca dengan kunci sebelum menulis: audit-nya membutuhkan nilai lama,
      // dan kunci ini mencegah pembaca lain melihat baris ini setengah jalan.
      const [current] = await tx
        .select({ name: categories.name })
        .from(categories)
        .where(eq(categories.id, id))
        .for('update');
      if (!current) return fail(NOT_FOUND);

      const [updated] = await tx
        .update(categories)
        .set({ name: input.name })
        .where(eq(categories.id, id))
        .returning({ id: categories.id });
      if (!updated) return fail(NOT_FOUND);

      await writeAudit(tx, {
        actorId: actor.id,
        action: 'category.update',
        entity: 'categories',
        entityId: id,
        metadata: { before: { name: current.name }, after: { name: input.name } },
      });
      return ok(id);
    });
  } catch (error) {
    if (uniqueViolation(error) === 'categories_name_unique') return duplicate(input.name);
    throw error;
  }
}

export async function setCategoryStatus(
  id: string,
  status: RecordStatus,
  actor: Actor,
  executor: Executor = db,
): Promise<ServiceResult> {
  if (!isUuid(id)) return fail(NOT_FOUND);
  return executor.transaction(async (tx) => {
    const [updated] = await tx
      .update(categories)
      .set({ status })
      .where(eq(categories.id, id))
      .returning({ id: categories.id, name: categories.name });
    if (!updated) return fail(NOT_FOUND);

    await writeAudit(tx, {
      actorId: actor.id,
      action: status === 'active' ? 'category.activate' : 'category.deactivate',
      entity: 'categories',
      entityId: id,
      metadata: { name: updated.name },
    });
    return ok(id);
  });
}
