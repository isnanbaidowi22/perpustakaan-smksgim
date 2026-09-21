import type { CopyStatus } from '@/domain/shared/types';

const LABELS: Record<CopyStatus, string> = {
  TERSEDIA: 'Tersedia',
  DIPINJAM: 'Dipinjam',
  RUSAK: 'Rusak',
  HILANG: 'Hilang',
  NONAKTIF: 'Nonaktif',
};

const ICONS: Record<CopyStatus, string> = {
  TERSEDIA: '●',
  DIPINJAM: '◐',
  RUSAK: '▲',
  HILANG: '✕',
  NONAKTIF: '—',
};

const COLORS: Record<CopyStatus, string> = {
  TERSEDIA: 'text-[var(--color-status-tersedia)] bg-[var(--color-status-tersedia)]/10',
  DIPINJAM: 'text-[var(--color-status-dipinjam)] bg-[var(--color-status-dipinjam)]/10',
  RUSAK: 'text-[var(--color-status-rusak)] bg-[var(--color-status-rusak)]/10',
  HILANG: 'text-[var(--color-status-hilang)] bg-[var(--color-status-hilang)]/10',
  NONAKTIF: 'text-[var(--color-ink-500)] bg-[var(--color-ink-100)]',
};

export function statusLabel(status: CopyStatus): string {
  return LABELS[status];
}

export function statusIcon(status: CopyStatus): string {
  return ICONS[status];
}

export function StatusBadge({ status }: { status: CopyStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-medium ${COLORS[status]}`}
    >
      <span aria-hidden="true">{ICONS[status]}</span>
      {LABELS[status]}
    </span>
  );
}
