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

const TRANSACTION_NUMBER = /^PJM-(\d{8})-(\d{4,})$/i;
/** Kode pindai digit-saja: tanggal (8 digit) + nomor urut (4 digit atau lebih). */
const SCAN_CODE = /^(\d{8})(\d{4,})$/;

/** Digit-saja dari nomor transaksi, dipakai sebagai muatan barcode Code128 subset C. */
export function transactionScanCode(transactionNumber: string): string {
  return transactionNumber.replace(/\D/g, '');
}

/**
 * Menormalkan masukan pencarian ke bentuk baku `PJM-YYYYMMDD-NNNN`.
 * Menerima format baku (huruf besar/kecil) atau kode pindai digit-saja
 * (hasil pindai barcode struk). Mengembalikan `null` bila tidak cocok.
 */
export function normalizeTransactionNumber(input: string): string | null {
  const trimmed = input.trim();
  const standard = TRANSACTION_NUMBER.exec(trimmed);
  if (standard) return `PJM-${standard[1]}-${standard[2]}`;
  const scanCode = SCAN_CODE.exec(trimmed);
  if (scanCode) return `PJM-${scanCode[1]}-${scanCode[2]}`;
  return null;
}
