import type { CopyStatus, LoanStatus, ReturnCondition } from '../shared/types';

/**
 * Menegakkan BR-07: eksemplar rusak atau hilang tidak pernah kembali
 * tersedia secara otomatis. Pemulihannya adalah aksi admin eksplisit
 * yang ditangani terpisah dan tercatat di audit log.
 */
export function nextCopyStatus(condition: ReturnCondition): CopyStatus {
  switch (condition) {
    case 'BAIK':
      return 'TERSEDIA';
    case 'RUSAK':
      return 'RUSAK';
    case 'HILANG':
      return 'HILANG';
  }
}

export interface LoanItemState {
  returned: boolean;
}

export function resolveLoanStatus(items: LoanItemState[]): LoanStatus {
  if (items.length === 0) {
    throw new Error('Peminjaman harus memiliki minimal satu eksemplar.');
  }
  if (items.every((item) => item.returned)) return 'SELESAI';
  if (items.some((item) => item.returned)) return 'SEBAGIAN_KEMBALI';
  return 'AKTIF';
}
