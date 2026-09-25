import type { ReactNode } from 'react';
import type { Option } from '@/lib/options';
import { buttonClass } from './button-styles';

const CONTROL = 'rounded-md border border-[var(--color-ink-300)] bg-white px-3 py-2 text-sm';

export const STATUS_OPTIONS: Option[] = [
  { value: 'active', label: 'Aktif' },
  { value: 'inactive', label: 'Nonaktif' },
  { value: 'all', label: 'Semua status' },
];

/** Form GET: hasil pencarian dapat dibagikan dan di-bookmark lewat URL. */
export function FilterBar({ q, placeholder, children }: { q: string; placeholder: string; children?: ReactNode }) {
  return (
    <form role="search" className="mb-4 flex flex-wrap items-center gap-2">
      <input
        type="search"
        name="q"
        defaultValue={q}
        placeholder={placeholder}
        aria-label={placeholder}
        className={`${CONTROL} min-w-64 flex-1`}
      />
      {children}
      <button type="submit" className={buttonClass('secondary')}>Cari</button>
    </form>
  );
}

export function FilterSelect({
  name, label, value, options,
}: { name: string; label: string; value: string; options: Option[] }) {
  return (
    <select name={name} defaultValue={value} aria-label={label} className={CONTROL}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}
