'use server';

import { revalidatePath } from 'next/cache';
import {
  LOAN_SAVE_FAILED, SUGGEST_MIN_LENGTH, type CreateBorrowerResult, type CreateLoanState, type LookupResult,
} from '@/lib/circulation-results';
import { formError, formToObject } from '@/lib/form-state';
import { schoolToday } from '@/lib/school-date';
import { requireActor } from '@/server/auth/guard';
import { fieldErrorsOf } from '@/server/forms/run-action';
import {
  findCopyByBarcode, getBorrowerCard, pickAvailableCopy, searchBorrowers, searchLoanableBooks,
  type BorrowerCard, type BorrowerOption, type CopyLookup, type LoanableBook,
} from '@/server/queries/circulation';
import { createLoan, type LoanResult } from '@/server/services/loans';
import { createStudent } from '@/server/services/students';
import { createLoanSchema } from '@/server/validation/loan';
import { studentSchema } from '@/server/validation/student';

export type CopyOrBooks = { kind: 'copy'; copy: CopyLookup } | { kind: 'books'; books: LoanableBook[] };

export async function searchBorrowersAction(query: string): Promise<LookupResult<BorrowerOption[]>> {
  await requireActor();
  return { ok: true, data: await searchBorrowers(String(query ?? '')) };
}

export async function getBorrowerCardAction(studentId: string): Promise<LookupResult<BorrowerCard>> {
  await requireActor();
  const card = await getBorrowerCard(String(studentId ?? ''), schoolToday());
  return card
    ? { ok: true, data: card }
    : { ok: false, message: 'Siswa tidak ditemukan. Cari ulang dengan nama siswa.' };
}

/**
 * Kolom buku di meja peminjaman menerima barcode, judul, atau ISBN. Barcode
 * dicoba lebih dulu agar scan tetap satu langkah; bila bukan barcode, judul
 * yang cocok dikembalikan untuk dipilih — kecuali hanya satu judul dengan
 * eksemplar tersedia, yang langsung diambilkan eksemplarnya.
 */
export async function lookupCopyAction(
  query: string,
  excludeCopyIds: string[] = [],
): Promise<LookupResult<CopyOrBooks>> {
  await requireActor();
  const text = String(query ?? '').trim();
  if (!text) return { ok: false, message: 'Pindai barcode, atau ketik judul atau ISBN buku terlebih dahulu.' };

  const copy = await findCopyByBarcode(text);
  if (copy) return { ok: true, data: { kind: 'copy', copy } };

  const found = await searchLoanableBooks(text);
  if (found.length === 0) {
    return {
      ok: false,
      message: `Buku "${text}" tidak ditemukan. Periksa barcode, judul, atau ISBN, atau daftarkan bukunya di Master Data → Buku.`,
    };
  }
  if (found.length === 1 && found[0].availableCount > 0) {
    const picked = await pickAvailableCopy(found[0].bookId, idsOf(excludeCopyIds));
    if (picked) return { ok: true, data: { kind: 'copy', copy: picked } };
  }
  return { ok: true, data: { kind: 'books', books: found } };
}

/** Saran di bawah kolom buku selagi petugas mengetik judul atau ISBN. */
export async function suggestBooksAction(query: string): Promise<LookupResult<LoanableBook[]>> {
  await requireActor();
  const text = String(query ?? '').trim();
  if (text.length < SUGGEST_MIN_LENGTH) return { ok: true, data: [] };
  return { ok: true, data: await searchLoanableBooks(text) };
}

/** Mengambil satu eksemplar tersedia dari judul yang dipilih petugas. */
export async function pickCopyAction(bookId: string, excludeCopyIds: string[]): Promise<LookupResult<CopyLookup>> {
  await requireActor();
  const copy = await pickAvailableCopy(String(bookId ?? ''), idsOf(excludeCopyIds));
  return copy
    ? { ok: true, data: copy }
    : { ok: false, message: 'Tidak ada lagi eksemplar tersedia untuk judul ini.' };
}

export async function createLoanAction(input: unknown): Promise<CreateLoanState> {
  const actor = await requireActor();

  const parsed = createLoanSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Data peminjaman tidak valid. Muat ulang halaman.' };
  }

  let result: LoanResult;
  try {
    result = await createLoan(parsed.data, actor, schoolToday());
  } catch (error) {
    // Pelanggaran aturan sudah dikembalikan sebagai nilai; yang sampai ke
    // sini hanya galat infrastruktur. Tanpa tangkapan ini, layar meja
    // peminjaman diganti error boundary dan daftar bukunya hilang.
    console.error('createLoan gagal', error);
    return { status: 'error', message: LOAN_SAVE_FAILED };
  }
  if (!result.ok) {
    return 'violations' in result
      ? { status: 'rejected', violations: result.violations }
      : { status: 'error', message: result.message };
  }

  revalidatePath('/transaksi/riwayat');
  revalidatePath('/master/buku');
  return { status: 'success', loanId: result.id, transactionNumber: result.transactionNumber, dueDate: result.dueDate };
}

/**
 * Siswa hanya didaftarkan dari meja peminjaman: siswa yang belum ada dicatat
 * di sini lalu langsung terpilih sebagai peminjam.
 */
export async function createBorrowerAction(formData: FormData): Promise<CreateBorrowerResult<BorrowerCard>> {
  const actor = await requireActor();
  const values = formToObject(formData);
  const parsed = studentSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      state: formError('Data siswa belum dapat disimpan. Periksa kolom yang ditandai.', fieldErrorsOf(parsed.error), values),
    };
  }

  try {
    const result = await createStudent(parsed.data, actor);
    if (!result.ok) {
      const fieldErrors = result.field ? { [result.field]: [result.message] } : {};
      return { ok: false, state: formError(result.message, fieldErrors, values) };
    }
    const card = await getBorrowerCard(result.id, schoolToday());
    if (card) return { ok: true, data: card };
  } catch (error) {
    console.error('createBorrower gagal', error);
  }
  return {
    ok: false,
    state: formError('Siswa belum tersimpan karena gangguan koneksi ke database. Cari namanya dulu sebelum mengisi ulang.', {}, values),
  };
}

/** Eksemplar yang sudah ada di daftar meja; diabaikan saat mengambil eksemplar tersedia. */
function idsOf(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}
