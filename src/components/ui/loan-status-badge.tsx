import type { LoanStatus } from '@/domain/shared/types';

const BASE = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium';
const LATE = 'bg-[var(--color-status-terlambat)]/10 text-[var(--color-status-terlambat)]';

const STYLES: Record<LoanStatus, { label: string; icon: string; className: string }> = {
  AKTIF: {
    label: 'Dipinjam',
    icon: '◐',
    className: 'bg-[var(--color-status-dipinjam)]/10 text-[var(--color-status-dipinjam)]',
  },
  SEBAGIAN_KEMBALI: {
    label: 'Sebagian kembali',
    icon: '◑',
    className: 'bg-[var(--color-status-dipinjam)]/10 text-[var(--color-status-dipinjam)]',
  },
  SELESAI: {
    label: 'Selesai',
    icon: '●',
    className: 'bg-[var(--color-status-tersedia)]/10 text-[var(--color-status-tersedia)]',
  },
};

/** Terlambat bukan status tersimpan (spec 4.2); badge menghitungnya dari `daysOverdue`. */
export function LoanStatusBadge({ status, daysOverdue }: { status: LoanStatus; daysOverdue: number }) {
  if (status !== 'SELESAI' && daysOverdue > 0) {
    return (
      <span className={`${BASE} ${LATE}`}>
        <span aria-hidden="true">!</span>Terlambat {daysOverdue} hari
      </span>
    );
  }
  const style = STYLES[status];
  return (
    <span className={`${BASE} ${style.className}`}>
      <span aria-hidden="true">{style.icon}</span>
      {style.label}
    </span>
  );
}
