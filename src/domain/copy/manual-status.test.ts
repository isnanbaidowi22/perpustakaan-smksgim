import { describe, expect, it } from 'vitest';
import type { CopyStatus } from '../shared/types';
import { availableManualActions, isManualCopyAction, planManualStatusChange } from './manual-status';

describe('planManualStatusChange', () => {
  it.each(['RUSAK', 'HILANG'] as const)('memulihkan eksemplar %s menjadi tersedia', (status) => {
    expect(planManualStatusChange(status, 'RESTORE')).toEqual({ ok: true, next: 'TERSEDIA' });
  });

  it.each(['TERSEDIA', 'RUSAK', 'HILANG'] as const)('menarik eksemplar %s dari koleksi', (status) => {
    expect(planManualStatusChange(status, 'DEACTIVATE')).toEqual({ ok: true, next: 'NONAKTIF' });
  });

  it('mengaktifkan kembali eksemplar nonaktif menjadi tersedia', () => {
    expect(planManualStatusChange('NONAKTIF', 'REACTIVATE')).toEqual({ ok: true, next: 'TERSEDIA' });
  });

  it.each(['RESTORE', 'DEACTIVATE', 'REACTIVATE'] as const)(
    'tidak pernah mengubah eksemplar yang sedang dipinjam lewat aksi %s',
    (action) => {
      expect(planManualStatusChange('DIPINJAM', action)).toEqual({ ok: false, reason: 'ON_LOAN' });
    },
  );

  it('menolak aksi yang tidak berlaku untuk status saat ini', () => {
    expect(planManualStatusChange('TERSEDIA', 'RESTORE')).toEqual({ ok: false, reason: 'NOT_APPLICABLE' });
    expect(planManualStatusChange('NONAKTIF', 'DEACTIVATE')).toEqual({ ok: false, reason: 'NOT_APPLICABLE' });
  });
});

describe('availableManualActions', () => {
  const cases: [CopyStatus, string[]][] = [
    ['TERSEDIA', ['DEACTIVATE']],
    ['DIPINJAM', []],
    ['RUSAK', ['RESTORE', 'DEACTIVATE']],
    ['HILANG', ['RESTORE', 'DEACTIVATE']],
    ['NONAKTIF', ['REACTIVATE']],
  ];

  it.each(cases)('status %s menawarkan %j', (status, actions) => {
    expect(availableManualActions(status)).toEqual(actions);
  });
});

describe('isManualCopyAction', () => {
  it('hanya menerima tiga aksi yang dikenal', () => {
    expect(isManualCopyAction('RESTORE')).toBe(true);
    expect(isManualCopyAction('DELETE')).toBe(false);
  });
});
