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
