type Variant = 'primary' | 'secondary' | 'danger';
type Size = 'md' | 'sm';

// Ikon lucide di dalam tombol mengikuti ukuran teksnya lewat [&_svg].
const BASE =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors disabled:opacity-60 [&_svg]:shrink-0';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-[var(--color-accent-600)] font-semibold text-white hover:bg-[var(--color-accent-700)]',
  secondary:
    'border border-[var(--color-ink-300)] bg-white text-[var(--color-ink-900)] hover:bg-[var(--color-ink-50)]',
  danger:
    'border border-[var(--color-status-terlambat)]/40 bg-white text-[var(--color-status-terlambat)] hover:bg-[var(--color-status-terlambat)]/5',
};

const SIZES: Record<Size, string> = {
  md: 'min-h-10 px-4 py-2 text-sm [&_svg]:size-4',
  sm: 'min-h-8 px-3 py-1 text-[13px] [&_svg]:size-3.5',
};

/** Satu sumber kelas tombol, dipakai `<button>` maupun `<Link>`. */
export function buttonClass(variant: Variant = 'primary', size: Size = 'md'): string {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]}`;
}
