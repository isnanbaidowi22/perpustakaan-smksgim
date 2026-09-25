type Variant = 'primary' | 'secondary' | 'danger';
type Size = 'md' | 'sm';

const BASE = 'inline-flex items-center justify-center rounded-md font-medium disabled:opacity-60';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-[var(--color-accent-600)] text-white hover:bg-[var(--color-accent-500)]',
  secondary:
    'border border-[var(--color-ink-300)] bg-white text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)]',
  danger:
    'border border-[var(--color-status-terlambat)] bg-white text-[var(--color-status-terlambat)] hover:bg-[var(--color-status-terlambat)]/10',
};

const SIZES: Record<Size, string> = {
  md: 'px-4 py-2 text-sm',
  sm: 'px-2.5 py-1 text-xs',
};

/** Satu sumber kelas tombol, dipakai `<button>` maupun `<Link>`. */
export function buttonClass(variant: Variant = 'primary', size: Size = 'md'): string {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]}`;
}
