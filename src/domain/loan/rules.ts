import { diffDays, type IsoDate } from '../shared/date';
import type {
  CopySnapshot,
  LibrarySettings,
  OpenLoanSnapshot,
  StudentSnapshot,
} from '../shared/types';
import type { ValidationResult, Violation } from '../shared/violations';

export const DEFAULT_SETTINGS: LibrarySettings = {
  maxActiveLoans: 3,
  loanDurationDays: 3,
  finePerDay: 1000,
  blockWhenOverdue: true,
  blockWhenUnpaidFine: false,
};

export interface LoanRequestInput {
  student: StudentSnapshot;
  /** Peminjaman yang belum selesai atau dendanya belum lunas (lihat OpenLoanSnapshot). */
  openLoans: OpenLoanSnapshot[];
  requestedCopies: CopySnapshot[];
  settings: LibrarySettings;
  hasActiveAcademicYear: boolean;
  today: IsoDate;
}

/**
 * Mengumpulkan SELURUH pelanggaran, tidak berhenti pada yang pertama.
 * Petugas harus melihat semua masalah dalam satu tampilan, bukan
 * menemukannya satu per satu setiap kali menekan simpan.
 */
export function validateLoanRequest(input: LoanRequestInput): ValidationResult {
  const violations: Violation[] = [];
  const { student, openLoans, requestedCopies, settings, today } = input;

  if (!input.hasActiveAcademicYear) {
    violations.push({ code: 'NO_ACTIVE_YEAR' });
  }

  if (requestedCopies.length === 0) {
    violations.push({ code: 'NO_COPY_SELECTED' });
  }

  if (student.status !== 'active') {
    violations.push({ code: 'STUDENT_INACTIVE', studentName: student.name });
  }

  // Eksemplar ganda dilaporkan sekali per barcode, lalu diabaikan dari
  // perhitungan kuota supaya tidak menghasilkan dua pelanggaran untuk satu kesalahan.
  const seen = new Set<string>();
  const uniqueCopies: CopySnapshot[] = [];
  for (const copy of requestedCopies) {
    if (seen.has(copy.id)) {
      violations.push({
        code: 'DUPLICATE_COPY',
        barcode: copy.barcode,
        bookTitle: copy.bookTitle,
      });
      continue;
    }
    seen.add(copy.id);
    uniqueCopies.push(copy);
  }

  const activeCount = openLoans.reduce((sum, loan) => sum + loan.openItemCount, 0);
  if (activeCount + uniqueCopies.length > settings.maxActiveLoans) {
    violations.push({
      code: 'QUOTA_EXCEEDED',
      studentName: student.name,
      activeCount,
      requestedCount: uniqueCopies.length,
      maxActiveLoans: settings.maxActiveLoans,
    });
  }

  if (settings.blockWhenOverdue) {
    for (const loan of openLoans) {
      // Pinjaman yang semua bukunya sudah kembali hanya menyisakan denda;
      // tidak ada buku yang terlambat dikembalikan.
      if (loan.openItemCount === 0) continue;
      const daysLate = diffDays(loan.dueDate, today);
      if (daysLate > 0) {
        violations.push({
          code: 'HAS_OVERDUE',
          studentName: student.name,
          transactionNumber: loan.transactionNumber,
          daysLate,
        });
      }
    }
  }

  if (settings.blockWhenUnpaidFine) {
    const amount = openLoans.reduce((sum, loan) => sum + loan.unpaidFine, 0);
    if (amount > 0) {
      violations.push({ code: 'UNPAID_FINE', studentName: student.name, amount });
    }
  }

  for (const copy of uniqueCopies) {
    if (copy.bookStatus !== 'active') {
      violations.push({ code: 'BOOK_INACTIVE', barcode: copy.barcode, bookTitle: copy.bookTitle });
    } else if (copy.status !== 'TERSEDIA') {
      violations.push({
        code: 'COPY_UNAVAILABLE',
        barcode: copy.barcode,
        bookTitle: copy.bookTitle,
        status: copy.status,
        ...(copy.borrowedBy ? { borrowedBy: copy.borrowedBy } : {}),
      });
    }
  }

  return violations.length > 0 ? { ok: false, violations } : { ok: true };
}
