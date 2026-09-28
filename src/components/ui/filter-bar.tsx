import { Search } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Option } from '@/lib/options';
import { buttonClass } from './button-styles';
import { CONTROL } from './form-styles';

export const STATUS_OPTIONS: Option[] = [
  { value: 'active', label: 'Aktif' },
  { value: 'inactive', label: 'Nonaktif' },
  { value: 'all', label: 'Semua status' },
];

/** Form GET: hasil pencarian dapat dibagikan dan di-bookmark lewat URL. */
export function FilterBar({
  q, placeholder, autoFocus, children,
}: { q: string; placeholder: string; autoFocus?: boolean; children?: ReactNode }) {
  return (
    <form role="search" className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative min-w-64 flex-1">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--color-ink-400)]"
        />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder={placeholder}
          aria-label={placeholder}
          autoFocus={autoFocus}
          className={`${CONTROL} w-full pl-9`}
        />
      </div>
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
