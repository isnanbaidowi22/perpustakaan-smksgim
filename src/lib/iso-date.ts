import type { IsoDate } from '@/domain/shared/date';

/**
 * '2026-02-30' ditolak: tanggal harus ada di kalender, bukan hanya berpola
 * benar. Tahun di bawah 1000 juga ditolak: `new Date('0026-…Z')` mem-parse
 * tahunnya apa adanya, tapi aritmetika tanggal lain di aplikasi ini
 * (`Date.UTC` dengan tahun < 100) menafsirkannya sebagai 1900-an, sehingga
 * nilai seperti itu harus gagal di sini, bukan melempar galat di kemudian hari.
 */
export function parseIsoDate(value: string): IsoDate | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  if (Number(value.slice(0, 4)) < 1000) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}
