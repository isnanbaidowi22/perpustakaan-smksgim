import { diffDays, type IsoDate } from '../shared/date';
import type { ReturnCondition } from '../shared/types';

export interface FineInput {
  dueDate: IsoDate;
  returnDate: IsoDate;
  condition: ReturnCondition;
  finePerDay: number;
  /** Harga katalog dari books.price, dipakai bila petugas tidak menimpanya. */
  bookPrice: number;
  /** Nominal ganti yang diisi petugas. Nol adalah nilai yang sah. */
  replacementFeeOverride?: number;
}

export interface FineResult {
  daysLate: number;
  lateFine: number;
  replacementFee: number;
  total: number;
}

export function calculateItemFine(input: FineInput): FineResult {
  const daysLate = Math.max(0, diffDays(input.dueDate, input.returnDate));
  const lateFine = daysLate * input.finePerDay;

  const needsReplacement = input.condition === 'RUSAK' || input.condition === 'HILANG';
  const replacementFee = needsReplacement
    ? input.replacementFeeOverride ?? input.bookPrice
    : 0;

  return { daysLate, lateFine, replacementFee, total: lateFine + replacementFee };
}
