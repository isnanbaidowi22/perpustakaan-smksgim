import type { ReactNode } from 'react';

export function PageHeader({
  title, description, actions,
}: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        <h1 className="page-title text-[28px] font-bold leading-tight tracking-tight text-[var(--color-ink-900)] sm:text-3xl">
          {title}
        </h1>
        {description && <p className="mt-1 text-[15px] text-[var(--color-ink-500)]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
    </div>
  );
}
