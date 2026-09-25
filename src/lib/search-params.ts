/** Bentuk prop `searchParams` halaman Next.js 16 — sebuah Promise. */
export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export type StatusFilter = 'active' | 'inactive' | 'all';

export function firstValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

/** Daftar data master menampilkan yang aktif kecuali diminta lain. */
export function parseStatusFilter(value: string): StatusFilter {
  return value === 'inactive' || value === 'all' ? value : 'active';
}

export function withQuery(path: string, params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}
