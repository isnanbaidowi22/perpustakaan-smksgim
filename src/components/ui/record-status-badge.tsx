import type { RecordStatus } from '@/domain/shared/types';
import { BADGE, BADGE_ICON, BADGE_TONES } from './badge-styles';

/** Seperti StatusBadge eksemplar: ikon menyertai warna agar terbaca tanpa membedakan warna. */
export function RecordStatusBadge({ status }: { status: RecordStatus }) {
  if (status === 'active') {
    return (
      <span className={`${BADGE} ${BADGE_TONES.tersedia}`}>
        <span aria-hidden="true" className={BADGE_ICON}>●</span>Aktif
      </span>
    );
  }
  return (
    <span className={`${BADGE} ${BADGE_TONES.nonaktif}`}>
      <span aria-hidden="true" className={BADGE_ICON}>—</span>Nonaktif
    </span>
  );
}
