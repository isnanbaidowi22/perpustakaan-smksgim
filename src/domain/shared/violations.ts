import type { BorrowerSnapshot, CopyStatus } from './types';

/**
 * Pelanggaran aturan selalu berupa objek, tidak pernah untai teks.
 * Antarmuka menyusun kalimatnya sendiri agar dapat menyebut entitas
 * dan tindakan yang harus diambil petugas.
 */
export type Violation =
  | { code: 'NO_ACTIVE_YEAR' }
  | { code: 'NO_COPY_SELECTED' }
  | { code: 'STUDENT_INACTIVE'; studentName: string }
  | { code: 'DUPLICATE_COPY'; barcode: string; bookTitle: string }
  | {
      code: 'QUOTA_EXCEEDED';
      studentName: string;
      activeCount: number;
      requestedCount: number;
      maxActiveLoans: number;
    }
  | {
      code: 'HAS_OVERDUE';
      studentName: string;
      transactionNumber: string;
      daysLate: number;
    }
  | {
      code: 'COPY_UNAVAILABLE';
      barcode: string;
      bookTitle: string;
      status: CopyStatus;
      borrowedBy?: BorrowerSnapshot;
    }
  | { code: 'BOOK_INACTIVE'; barcode: string; bookTitle: string }
  | { code: 'UNPAID_FINE'; studentName: string; amount: number };

export type ViolationCode = Violation['code'];

export type ValidationResult =
  | { ok: true }
  | { ok: false; violations: Violation[] };
