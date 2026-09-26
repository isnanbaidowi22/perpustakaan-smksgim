import type { IsoDate } from '@/domain/shared/date';

/** '2026-02-30' ditolak: tanggal harus ada di kalender, bukan hanya berpola benar. */
export function parseIsoDate(value: string): IsoDate | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}
