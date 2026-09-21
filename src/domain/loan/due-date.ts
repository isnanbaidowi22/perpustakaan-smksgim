import { addDays, type IsoDate } from '../shared/date';

export function calculateDueDate(loanDate: IsoDate, durationDays: number): IsoDate {
  if (!Number.isInteger(durationDays) || durationDays < 1) {
    throw new Error(`Durasi pinjam minimal 1 hari, diterima: ${durationDays}`);
  }
  return addDays(loanDate, durationDays);
}
