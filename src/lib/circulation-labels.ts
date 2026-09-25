import type { ReturnCondition } from '@/domain/shared/types';
import type { Option } from './options';

export type HistoryStatus = 'all' | 'open' | 'overdue' | 'unpaid' | 'done';

export const HISTORY_STATUS_OPTIONS: Option[] = [
  { value: 'all', label: 'Semua status' },
  { value: 'open', label: 'Masih dipinjam' },
  { value: 'overdue', label: 'Terlambat' },
  { value: 'unpaid', label: 'Denda belum lunas' },
  { value: 'done', label: 'Selesai' },
];

const HISTORY_STATUSES = new Set(HISTORY_STATUS_OPTIONS.map((option) => option.value));

/** Nilai dari URL dapat diubah siapa saja; yang tidak dikenal berarti "semua". */
export function parseHistoryStatus(value: string): HistoryStatus {
  return HISTORY_STATUSES.has(value) ? (value as HistoryStatus) : 'all';
}

export const RETURN_CONDITION_LABELS: Record<ReturnCondition, string> = {
  BAIK: 'Baik',
  RUSAK: 'Rusak',
  HILANG: 'Hilang',
};

export const RETURN_CONDITION_OPTIONS: Option[] = (['BAIK', 'RUSAK', 'HILANG'] as const).map((value) => ({
  value,
  label: RETURN_CONDITION_LABELS[value],
}));
