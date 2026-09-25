import type { CopyStatus } from '../shared/types';

export type ManualCopyAction = 'RESTORE' | 'DEACTIVATE' | 'REACTIVATE';

export const MANUAL_ACTION_LABELS: Record<ManualCopyAction, string> = {
  RESTORE: 'Pulihkan ke tersedia',
  DEACTIVATE: 'Tarik dari koleksi',
  REACTIVATE: 'Aktifkan kembali',
};

const TRANSITIONS: Record<ManualCopyAction, { from: CopyStatus[]; to: CopyStatus }> = {
  // Spec 4.3: eksemplar rusak/hilang kembali tersedia hanya lewat aksi eksplisit
  // (diperbaiki / ditemukan), tidak pernah otomatis (BR-07).
  RESTORE: { from: ['RUSAK', 'HILANG'], to: 'TERSEDIA' },
  DEACTIVATE: { from: ['TERSEDIA', 'RUSAK', 'HILANG'], to: 'NONAKTIF' },
  REACTIVATE: { from: ['NONAKTIF'], to: 'TERSEDIA' },
};

export type ManualChangePlan =
  | { ok: true; next: CopyStatus }
  | { ok: false; reason: 'ON_LOAN' | 'NOT_APPLICABLE' };

/**
 * Perubahan status eksemplar di luar alur pinjam-kembali.
 * Eksemplar DIPINJAM tidak pernah diubah manual: statusnya milik peminjaman
 * yang masih terbuka, dan hanya pengembalian yang boleh mengubahnya.
 */
export function planManualStatusChange(current: CopyStatus, action: ManualCopyAction): ManualChangePlan {
  if (current === 'DIPINJAM') return { ok: false, reason: 'ON_LOAN' };
  const transition = TRANSITIONS[action];
  if (!transition.from.includes(current)) return { ok: false, reason: 'NOT_APPLICABLE' };
  return { ok: true, next: transition.to };
}

/** Aksi yang berlaku untuk status ini, dalam urutan tampil di layar. */
export function availableManualActions(current: CopyStatus): ManualCopyAction[] {
  return (Object.keys(TRANSITIONS) as ManualCopyAction[]).filter(
    (action) => planManualStatusChange(current, action).ok,
  );
}

export function isManualCopyAction(value: unknown): value is ManualCopyAction {
  return value === 'RESTORE' || value === 'DEACTIVATE' || value === 'REACTIVATE';
}
