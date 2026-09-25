import { formatRupiah } from '@/lib/format';
import { describeViolation, type ViolationMessage } from '@/lib/violation-message';
import type { BorrowerCard, CopyLookup } from '@/server/queries/circulation';

export interface DeskCopy {
  id: string;
  barcode: string;
  bookTitle: string;
  rackCode: string | null;
}

export interface DeskState {
  student: BorrowerCard | null;
  copies: DeskCopy[];
  /** Alasan pindaian terakhir ditolak, atau pesan pencarian. */
  notice: string | null;
}

export type DeskAction =
  | { type: 'selectStudent'; card: BorrowerCard }
  | { type: 'clearStudent' }
  | { type: 'addCopy'; copy: CopyLookup }
  | { type: 'removeCopy'; id: string }
  | { type: 'notice'; message: string }
  | { type: 'reset' };

export const INITIAL_DESK: DeskState = { student: null, copies: [], notice: null };

/** Sisa slot setelah buku di daftar ikut dihitung; null bila siswa belum dipilih. */
export function remainingSlots(state: DeskState): number | null {
  if (!state.student) return null;
  return Math.max(0, state.student.maxActiveLoans - state.student.activeCount - state.copies.length);
}

function sentence(message: ViolationMessage): string {
  return `${message.title} — ${message.detail}`;
}

/**
 * Alasan eksemplar tidak boleh masuk daftar, atau null. Menolak saat dipindai
 * lebih baik daripada menampilkan galat setelah tombol simpan (spec 8.2).
 * Server tetap memeriksa ulang semuanya saat menyimpan.
 */
function rejectionOf(state: DeskState, copy: CopyLookup): string | null {
  if (state.copies.some((listed) => listed.id === copy.id)) {
    return `Eksemplar ${copy.barcode} sudah ada di daftar.`;
  }
  if (copy.bookStatus !== 'active') {
    return sentence(describeViolation({ code: 'BOOK_INACTIVE', barcode: copy.barcode, bookTitle: copy.bookTitle }));
  }
  if (copy.status !== 'TERSEDIA') {
    return sentence(describeViolation({
      code: 'COPY_UNAVAILABLE',
      barcode: copy.barcode,
      bookTitle: copy.bookTitle,
      status: copy.status,
      ...(copy.borrowedBy ? { borrowedBy: copy.borrowedBy } : {}),
    }));
  }
  if (state.student && remainingSlots(state) === 0) {
    return `Kuota penuh: ${state.student.student.name} hanya boleh meminjam ${state.student.maxActiveLoans} buku sekaligus.`;
  }
  return null;
}

export function deskReducer(state: DeskState, action: DeskAction): DeskState {
  switch (action.type) {
    case 'selectStudent':
      return { ...state, student: action.card, notice: null };
    case 'clearStudent':
      return { ...state, student: null, notice: null };
    case 'addCopy': {
      const reason = rejectionOf(state, action.copy);
      if (reason) return { ...state, notice: reason };
      const { id, barcode, bookTitle, rackCode } = action.copy;
      return { ...state, copies: [...state.copies, { id, barcode, bookTitle, rackCode }], notice: null };
    }
    case 'removeCopy':
      return { ...state, copies: state.copies.filter((listed) => listed.id !== action.id), notice: null };
    case 'notice':
      return { ...state, notice: action.message };
    case 'reset':
      return INITIAL_DESK;
  }
}

export interface CardWarning {
  /** block: peminjaman akan ditolak; warn: dicatat tetapi tidak menghalangi. */
  tone: 'block' | 'warn' | 'ok';
  text: string;
}

/** Peringatan di kartu siswa, ditampilkan sebelum petugas menambahkan buku (spec 8.2). */
export function cardWarnings(card: BorrowerCard): CardWarning[] {
  const warnings: CardWarning[] = [];
  if (card.student.status !== 'active') {
    warnings.push({ tone: 'block', text: `${card.student.name} berstatus nonaktif; peminjaman akan ditolak.` });
  }
  if (card.activeCount >= card.maxActiveLoans) {
    warnings.push({ tone: 'block', text: 'Kuota penuh. Kembalikan salah satu buku terlebih dahulu.' });
  }
  for (const late of card.overdue) {
    warnings.push(card.blockWhenOverdue
      ? { tone: 'block', text: `${late.transactionNumber} terlambat ${late.daysLate} hari. Selesaikan dahulu sebelum meminjam.` }
      : { tone: 'warn', text: `${late.transactionNumber} terlambat ${late.daysLate} hari.` });
  }
  if (card.unpaidFine > 0) {
    warnings.push(card.blockWhenUnpaidFine
      ? { tone: 'block', text: `Tunggakan denda ${formatRupiah(card.unpaidFine)}. Lunasi dahulu sebelum meminjam.` }
      : { tone: 'warn', text: `Tunggakan denda ${formatRupiah(card.unpaidFine)}.` });
  }
  return warnings.length > 0 ? warnings : [{ tone: 'ok', text: 'Tidak ada keterlambatan atau tunggakan denda.' }];
}
