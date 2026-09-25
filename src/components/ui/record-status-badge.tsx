import type { RecordStatus } from '@/domain/shared/types';

const BASE = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium';

/** Seperti StatusBadge eksemplar: ikon menyertai warna agar terbaca tanpa membedakan warna. */
export function RecordStatusBadge({ status }: { status: RecordStatus }) {
  if (status === 'active') {
    return (
      <span className={`${BASE} bg-[var(--color-status-tersedia)]/10 text-[var(--color-status-tersedia)]`}>
        <span aria-hidden="true">●</span>Aktif
      </span>
    );
  }
  return (
    <span className={`${BASE} bg-[var(--color-ink-100)] text-[var(--color-ink-500)]`}>
      <span aria-hidden="true">—</span>Nonaktif
    </span>
  );
}
