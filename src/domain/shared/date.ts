/** Tanggal kalender tanpa zona waktu, selalu berformat 'YYYY-MM-DD'. */
export type IsoDate = string;

const MS_PER_DAY = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Mengubah tanggal kalender menjadi milidetik UTC tengah malam.
 * UTC dipakai secara sengaja: aritmetika menjadi bebas zona waktu dan
 * bebas perubahan waktu musim panas.
 */
function toUtcMillis(value: IsoDate): number {
  const parts = ISO_DATE.exec(value);
  if (!parts) {
    throw new Error(`Tanggal tidak valid: "${value}". Format yang benar YYYY-MM-DD.`);
  }
  const [, year, month, day] = parts;
  const millis = Date.UTC(Number(year), Number(month) - 1, Number(day));
  if (toIsoDate(millis) !== value) {
    throw new Error(`Tanggal tidak valid: "${value}" bukan tanggal yang ada dalam kalender.`);
  }
  return millis;
}

function toIsoDate(millis: number): IsoDate {
  return new Date(millis).toISOString().slice(0, 10);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return toIsoDate(toUtcMillis(date) + days * MS_PER_DAY);
}

/** Jumlah hari dari `from` ke `to`. Negatif bila `to` lebih awal. */
export function diffDays(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtcMillis(to) - toUtcMillis(from)) / MS_PER_DAY);
}
