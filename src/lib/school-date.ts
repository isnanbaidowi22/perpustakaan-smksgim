import type { IsoDate } from '@/domain/shared/date';

/** Zona waktu sekolah (keputusan pemilik produk, 25 September 2026). */
export const SCHOOL_TIME_ZONE = 'Asia/Jakarta';

const DATE_PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: SCHOOL_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function partsOf(value: Date): Record<string, string> {
  return Object.fromEntries(DATE_PARTS.formatToParts(value).map((part) => [part.type, part.value]));
}

/**
 * Tanggal kalender hari ini di sekolah. Server Vercel berjalan dalam UTC,
 * sehingga `new Date().toISOString()` menghasilkan tanggal kemarin untuk
 * transaksi pukul 00.00–07.00 WIB.
 */
export function schoolToday(now: Date = new Date()): IsoDate {
  const parts = partsOf(now);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** '25/09/2026 14.03', untuk waktu pengembalian dan pembayaran. */
export function formatSchoolDateTime(value: Date): string {
  const parts = partsOf(value);
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}.${parts.minute}`;
}
