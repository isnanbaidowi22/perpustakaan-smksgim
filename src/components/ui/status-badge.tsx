import type { CopyStatus } from '@/domain/shared/types';
import { BADGE, BADGE_ICON, BADGE_TONES } from './badge-styles';

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
  TERSEDIA: BADGE_TONES.tersedia,
  DIPINJAM: BADGE_TONES.dipinjam,
  RUSAK: BADGE_TONES.rusak,
  HILANG: BADGE_TONES.hilang,
  NONAKTIF: BADGE_TONES.nonaktif,
};

export function statusLabel(status: CopyStatus): string {
  return LABELS[status];
}

export function statusIcon(status: CopyStatus): string {
  return ICONS[status];
}

export function StatusBadge({ status }: { status: CopyStatus }) {
  return (
    <span className={`${BADGE} ${COLORS[status]}`}>
      <span aria-hidden="true" className={BADGE_ICON}>{ICONS[status]}</span>
      {LABELS[status]}
    </span>
  );
}
