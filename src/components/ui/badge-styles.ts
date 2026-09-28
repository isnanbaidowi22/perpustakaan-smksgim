/** Badge status. Ikonnya (spec 8.1) diberi kelas BADGE_ICON agar tetap kecil. */
export const BADGE = 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold';
export const BADGE_ICON = 'text-[0.75em] leading-none';

export const BADGE_TONES = {
  tersedia: 'bg-[var(--color-accent-100)] text-[var(--color-accent-700)]',
  dipinjam: 'bg-[var(--color-status-dipinjam)]/10 text-[var(--color-status-dipinjam)]',
  terlambat: 'bg-[var(--color-status-terlambat)]/10 text-[var(--color-status-terlambat)]',
  rusak: 'bg-[var(--color-status-rusak)]/10 text-[var(--color-status-rusak)]',
  hilang: 'bg-[var(--color-status-hilang)]/10 text-[var(--color-status-hilang)]',
  nonaktif: 'bg-[var(--color-ink-100)] text-[var(--color-ink-500)]',
} as const;
