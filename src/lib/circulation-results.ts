import type { Violation } from '@/domain/shared/violations';

/**
 * Hasil Server Action baca di meja sirkulasi. Galat dikembalikan, tidak
 * dilempar: Next.js menyamarkan galat yang dilempar Server Action di produksi.
 */
export type LookupResult<T> = { ok: true; data: T } | { ok: false; message: string };

export type CreateLoanState =
  | { status: 'success'; loanId: string; transactionNumber: string; dueDate: string }
  | { status: 'rejected'; violations: Violation[] }
  | { status: 'error'; message: string };

/**
 * Galat tak terduga saat menyimpan (koneksi pooler putus, batas waktu kunci).
 * Petugas tidak dapat tahu apakah transaksinya sempat ter-commit, jadi
 * pesannya meminta pemeriksaan sebelum menyimpan ulang.
 */
export const LOAN_SAVE_FAILED =
  'Peminjaman belum tersimpan karena gangguan koneksi ke database. Periksa Riwayat Transaksi sebelum menyimpan ulang.';

export const RETURN_SAVE_FAILED =
  'Pengembalian belum tersimpan karena gangguan koneksi ke database. Buka ulang transaksi ini untuk memeriksa sebelum menyimpan ulang.';
