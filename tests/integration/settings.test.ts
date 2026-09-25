import { describe, expect, it } from 'vitest';
import { desc, eq } from 'drizzle-orm';
import { DEFAULT_SETTINGS } from '@/domain/loan/rules';
import { auditLogs, librarySettings } from '@/server/db/schema';
import { getLibrarySettings } from '@/server/queries/settings';
import { updateLibrarySettings } from '@/server/services/settings';
import { testActor, withRollback } from './helpers';

const input = {
  maxActiveLoans: 2,
  loanDurationDays: 7,
  finePerDay: 1500,
  blockWhenOverdue: false,
  blockWhenUnpaidFine: true,
  schoolName: 'UJI-SMK Negeri 1 Contoh',
  receiptFooter: 'UJI-Terima kasih.',
};

describe('getLibrarySettings', () => {
  it('memakai nilai bawaan domain bila baris konfigurasi belum ada', async () => {
    await withRollback(async (tx) => {
      await tx.delete(librarySettings).where(eq(librarySettings.id, 1));

      expect(await getLibrarySettings(tx)).toEqual({ ...DEFAULT_SETTINGS, schoolName: null, receiptFooter: null });
    });
  });
});

describe('updateLibrarySettings', () => {
  it('menyimpan konfigurasi, mencatat pengubahnya, dan menulis audit sebelum-sesudah', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const before = await getLibrarySettings(tx);

      expect((await updateLibrarySettings(input, actor, tx)).ok).toBe(true);

      expect(await getLibrarySettings(tx)).toEqual(input);
      const [row] = await tx.select({ updatedBy: librarySettings.updatedBy }).from(librarySettings);
      expect(row?.updatedBy).toBe(actor.id);

      const [audit] = await tx
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.action, 'settings.update'))
        .orderBy(desc(auditLogs.createdAt))
        .limit(1);
      expect(audit).toMatchObject({ userId: actor.id, entity: 'library_settings', entityId: null });
      expect(audit?.metadata).toEqual({ before, after: input });
    });
  });

  it('membuat baris konfigurasi bila belum ada', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      await tx.delete(librarySettings).where(eq(librarySettings.id, 1));

      expect((await updateLibrarySettings(input, actor, tx)).ok).toBe(true);

      expect(await getLibrarySettings(tx)).toEqual(input);
      const [audit] = await tx
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.action, 'settings.update'))
        .orderBy(desc(auditLogs.createdAt))
        .limit(1);
      expect(audit?.metadata).toEqual({ before: null, after: input });
    });
  });
});
