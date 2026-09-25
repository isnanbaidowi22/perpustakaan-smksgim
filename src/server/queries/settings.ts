import { eq } from 'drizzle-orm';
import { DEFAULT_SETTINGS } from '@/domain/loan/rules';
import type { LibrarySettings } from '@/domain/shared/types';
import { db } from '@/server/db/client';
import type { Executor } from '@/server/db/executor';
import { librarySettings } from '@/server/db/schema';

/** Aturan peminjaman ditambah isi struk. */
export interface Settings extends LibrarySettings {
  schoolName: string | null;
  receiptFooter: string | null;
}

export const settingsColumns = {
  maxActiveLoans: librarySettings.maxActiveLoans,
  loanDurationDays: librarySettings.loanDurationDays,
  finePerDay: librarySettings.finePerDay,
  blockWhenOverdue: librarySettings.blockWhenOverdue,
  blockWhenUnpaidFine: librarySettings.blockWhenUnpaidFine,
  schoolName: librarySettings.schoolName,
  receiptFooter: librarySettings.receiptFooter,
};

/** Bentuk baris hasil `select(settingsColumns)`: sama dengan Settings, kecuali `numeric` yang dibaca sebagai untai. */
type SettingsRow = Omit<Settings, 'finePerDay'> & { finePerDay: string };

/** Konfigurasi hanya satu baris; `id` hasilnya tidak dipakai pemanggil. */
export const SETTINGS_ID = 1;

/** `numeric` dibaca Postgres sebagai untai ('1000.00'); aturan domain butuh bilangan. */
export function toSettings(row: SettingsRow): Settings {
  return { ...row, finePerDay: Number(row.finePerDay) };
}

/**
 * Satu-satunya pintu baca konfigurasi. Bila skrip seed belum pernah
 * dijalankan, aturan bawaan domain (spec 1.1) tetap berlaku, sehingga
 * peminjaman tidak gagal hanya karena barisnya belum ada.
 */
export async function getLibrarySettings(executor: Executor = db): Promise<Settings> {
  const [row] = await executor.select(settingsColumns).from(librarySettings).where(eq(librarySettings.id, SETTINGS_ID)).limit(1);
  if (!row) return { ...DEFAULT_SETTINGS, schoolName: null, receiptFooter: null };
  return toSettings(row);
}
