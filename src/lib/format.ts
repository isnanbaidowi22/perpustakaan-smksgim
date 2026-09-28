/** `Rp85.000`, penulisan yang dipakai spec dan PRD. */
export function formatRupiah(amount: number | string): string {
  return `Rp${Math.round(Number(amount)).toLocaleString('id-ID')}`;
}

/** `'2026-09-24'` → `'24/09/2026'`. Tanpa objek Date, jadi tanpa geser zona waktu. */
export function formatDate(value: string | null): string {
  if (!value) return '—';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

const LONG_DATE = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
});

/** `'2026-09-28'` → `'Senin, 28 September 2026'`. Dibaca sebagai UTC agar harinya tidak bergeser. */
export function formatLongDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return LONG_DATE.format(Date.UTC(year, month - 1, day));
}

/** Huruf avatar: `'Siti Petugas'` → `'SP'`, `'Administrator'` → `'AD'`. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}
