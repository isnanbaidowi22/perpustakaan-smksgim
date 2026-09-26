import type { IsoDate } from './date';

export type CopyStatus = 'TERSEDIA' | 'DIPINJAM' | 'RUSAK' | 'HILANG' | 'NONAKTIF';
export type ReturnCondition = 'BAIK' | 'RUSAK' | 'HILANG';
export type LoanStatus = 'AKTIF' | 'SEBAGIAN_KEMBALI' | 'SELESAI';
/** Satu peran sejak revisi 26 September 2026 (spec §7): setiap akun adalah admin. */
export type UserRole = 'admin';
export type RecordStatus = 'active' | 'inactive';

export interface LibrarySettings {
  maxActiveLoans: number;
  loanDurationDays: number;
  finePerDay: number;
  blockWhenOverdue: boolean;
  blockWhenUnpaidFine: boolean;
}

export interface StudentSnapshot {
  id: string;
  nis: string;
  name: string;
  className: string;
  status: RecordStatus;
}

/**
 * Peminjaman yang masih berpengaruh pada peminjaman baru: masih memiliki
 * eksemplar belum kembali, atau semua bukunya sudah kembali tetapi dendanya
 * belum lunas (openItemCount = 0).
 */
export interface OpenLoanSnapshot {
  id: string;
  transactionNumber: string;
  dueDate: IsoDate;
  /** Jumlah eksemplar dalam peminjaman ini yang belum dikembalikan. */
  openItemCount: number;
  /** total_fine dikurangi jumlah pembayaran. Nol berarti lunas. */
  unpaidFine: number;
}

export interface BorrowerSnapshot {
  name: string;
  nis: string;
  dueDate: IsoDate;
}

export interface CopySnapshot {
  id: string;
  barcode: string;
  status: CopyStatus;
  bookTitle: string;
  /** Eksemplar milik buku nonaktif tidak boleh dipinjam (spec 5.2, BOOK_INACTIVE). */
  bookStatus: RecordStatus;
  /** Terisi hanya bila status DIPINJAM, untuk menyusun pesan galat. */
  borrowedBy?: BorrowerSnapshot;
}

/** Pengguna yang sedang melakukan aksi, sebagaimana dilihat aturan bisnis dan audit log. */
export interface Actor {
  id: string;
  role: UserRole;
}
