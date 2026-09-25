export const PAGE_SIZE = 25;

/** Batas atas nomor halaman: `offsetOf(MAX_PAGE + 1)` masih jauh di bawah batas OFFSET Postgres. */
const MAX_PAGE = 100_000;

export function parsePage(value: string): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 && page <= MAX_PAGE ? page : 1;
}

export function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

export function offsetOf(page: number): number {
  return (page - 1) * PAGE_SIZE;
}
