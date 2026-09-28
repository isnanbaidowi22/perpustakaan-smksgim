import type { LoanStatus } from '@/domain/shared/types';
import { BADGE, BADGE_ICON, BADGE_TONES } from './badge-styles';

const STYLES: Record<LoanStatus, { label: string; icon: string; className: string }> = {
  AKTIF: { label: 'Dipinjam', icon: '◐', className: BADGE_TONES.dipinjam },
  SEBAGIAN_KEMBALI: { label: 'Sebagian kembali', icon: '◑', className: BADGE_TONES.dipinjam },
  SELESAI: { label: 'Selesai', icon: '●', className: BADGE_TONES.tersedia },
};

/** Terlambat bukan status tersimpan (spec 4.2); badge menghitungnya dari `daysOverdue`. */
export function LoanStatusBadge({ status, daysOverdue }: { status: LoanStatus; daysOverdue: number }) {
  if (status !== 'SELESAI' && daysOverdue > 0) {
    return (
      <span className={`${BADGE} ${BADGE_TONES.terlambat}`}>
        <span aria-hidden="true" className={BADGE_ICON}>!</span>Terlambat {daysOverdue} hari
      </span>
    );
  }
  const style = STYLES[status];
  return (
    <span className={`${BADGE} ${style.className}`}>
      <span aria-hidden="true" className={BADGE_ICON}>{style.icon}</span>
      {style.label}
    </span>
  );
}
