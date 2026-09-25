import { eq } from 'drizzle-orm';
import type { Actor } from '@/domain/shared/types';
import { writeAudit } from '@/server/audit';
import { db } from '@/server/db/client';
import type { Executor } from '@/server/db/executor';
import { librarySettings } from '@/server/db/schema';
import { SETTINGS_ID, settingsColumns, toSettings } from '@/server/queries/settings';
import type { SettingsInput } from '@/server/validation/settings';
import { ok, type ServiceResult } from './result';

export async function updateLibrarySettings(
  input: SettingsInput,
  actor: Actor,
  executor: Executor = db,
): Promise<ServiceResult> {
  return executor.transaction(async (tx) => {
    const [current] = await tx
      .select(settingsColumns)
      .from(librarySettings)
      .where(eq(librarySettings.id, SETTINGS_ID))
      .for('update');

    const values = {
      ...input,
      finePerDay: String(input.finePerDay),
      updatedBy: actor.id,
      updatedAt: new Date(),
    };
    // Upsert: baris dibuat bila skrip seed belum pernah dijalankan.
    await tx
      .insert(librarySettings)
      .values({ id: SETTINGS_ID, ...values })
      .onConflictDoUpdate({ target: librarySettings.id, set: values });

    await writeAudit(tx, {
      actorId: actor.id,
      action: 'settings.update',
      entity: 'library_settings',
      // Nilai sebelum dibaca lewat toSettings agar denda tercatat sebagai
      // bilangan di kedua sisi, bukan '1000.00' di satu sisi dan 1000 di sisi lain.
      metadata: { before: current ? toSettings(current) : null, after: { ...input } },
    });
    return ok(String(SETTINGS_ID));
  });
}
