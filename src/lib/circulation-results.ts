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
