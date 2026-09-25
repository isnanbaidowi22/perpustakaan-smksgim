import type { IsoDate } from '../shared/date';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function compact(date: IsoDate): string {
  if (!ISO_DATE.test(date)) {
    throw new Error(`Tanggal tidak valid: "${date}". Format yang benar YYYY-MM-DD.`);
  }
  return date.split('-').join('');
}

/** Cakupan penghitung harian di tabel `counters`, misalnya 'loan:20260921' (spec 6.3). */
export function loanCounterScope(date: IsoDate): string {
  return `loan:${compact(date)}`;
}

/** 'PJM-20260921-0001'. Nomor urut di atas 9999 tidak dipotong. */
export function formatTransactionNumber(date: IsoDate, sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error(`Nomor urut transaksi harus bilangan bulat positif, diterima: ${sequence}`);
  }
  return `PJM-${compact(date)}-${String(sequence).padStart(4, '0')}`;
}
