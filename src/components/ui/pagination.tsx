import Link from 'next/link';
import { pageCount } from '@/lib/pagination';
import { withQuery } from '@/lib/search-params';
import { buttonClass } from './button-styles';

export function Pagination({
  path, page, total, query,
}: { path: string; page: number; total: number; query: Record<string, string> }) {
  const pages = pageCount(total);
  if (pages <= 1) return null;

  return (
    <nav aria-label="Halaman" className="mt-4 flex items-center justify-between text-sm">
      <span className="text-[var(--color-ink-500)]">
        Halaman {page} dari {pages} · {total} data
      </span>
      <div className="flex gap-2">
        {page > 1 && (
          <Link href={withQuery(path, { ...query, hal: page - 1 })} className={buttonClass('secondary', 'sm')}>
            ← Sebelumnya
          </Link>
        )}
        {page < pages && (
          <Link href={withQuery(path, { ...query, hal: page + 1 })} className={buttonClass('secondary', 'sm')}>
            Berikutnya →
          </Link>
        )}
      </div>
    </nav>
  );
}
