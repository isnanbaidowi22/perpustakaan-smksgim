import { describe, expect, it } from 'vitest';
import {
  HISTORY_STATUS_OPTIONS, parseHistoryStatus, RETURN_CONDITION_LABELS, RETURN_CONDITION_OPTIONS,
} from './circulation-labels';

describe('filter status riwayat', () => {
  it('menawarkan semua status dengan "Semua" sebagai bawaan', () => {
    expect(HISTORY_STATUS_OPTIONS.map((option) => option.value)).toEqual(['all', 'open', 'overdue', 'unpaid', 'done']);
    expect(parseHistoryStatus('overdue')).toBe('overdue');
    expect(parseHistoryStatus('')).toBe('all');
    expect(parseHistoryStatus('hapus-semua')).toBe('all');
  });
});

describe('kondisi pengembalian', () => {
  it('memberi label Indonesia dengan urutan Baik, Rusak, Hilang', () => {
    expect(RETURN_CONDITION_LABELS.HILANG).toBe('Hilang');
    expect(RETURN_CONDITION_OPTIONS).toEqual([
      { value: 'BAIK', label: 'Baik' },
      { value: 'RUSAK', label: 'Rusak' },
      { value: 'HILANG', label: 'Hilang' },
    ]);
  });
});
