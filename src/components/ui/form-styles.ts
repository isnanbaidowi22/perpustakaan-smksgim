/**
 * Kotak isian dan pilihan. Lebarnya diatur pemakai (`w-full`, `flex-1`, …).
 * Fokus ditandai garis dan cincin teal, pengganti outline global.
 */
export const CONTROL =
  'min-h-10 rounded-lg border border-[var(--color-ink-300)] bg-white px-3 py-2 text-sm text-[var(--color-ink-900)] placeholder:text-[var(--color-ink-400)] focus:border-[var(--color-accent-600)] focus:ring-3 focus:ring-[var(--color-accent-600)]/20 focus-visible:outline-none aria-[invalid=true]:border-[var(--color-status-terlambat)]';

export const LABEL = 'mb-1.5 block text-sm font-medium text-[var(--color-ink-900)]';
