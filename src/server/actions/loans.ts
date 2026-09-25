'use server';

import { revalidatePath } from 'next/cache';
import type { UserRole } from '@/domain/shared/types';
import { LOAN_SAVE_FAILED, type CreateLoanState, type LookupResult } from '@/lib/circulation-results';
import { schoolToday } from '@/lib/school-date';
import { authorize } from '@/server/auth/guard';
import {
  findCopyByBarcode, getBorrowerCard, searchBorrowers,
  type BorrowerCard, type BorrowerOption, type CopyLookup,
} from '@/server/queries/circulation';
import { createLoan, type LoanResult } from '@/server/services/loans';
import { createLoanSchema } from '@/server/validation/loan';

const ROLES: UserRole[] = ['admin', 'petugas'];

export async function searchBorrowersAction(query: string): Promise<LookupResult<BorrowerOption[]>> {
  const auth = await authorize(ROLES);
  if (!auth.ok) return { ok: false, message: auth.message };
  return { ok: true, data: await searchBorrowers(String(query ?? '')) };
}

export async function getBorrowerCardAction(studentId: string): Promise<LookupResult<BorrowerCard>> {
  const auth = await authorize(ROLES);
  if (!auth.ok) return { ok: false, message: auth.message };
  const card = await getBorrowerCard(String(studentId ?? ''), schoolToday());
  return card
    ? { ok: true, data: card }
    : { ok: false, message: 'Siswa tidak ditemukan. Cari ulang dengan NIS atau nama.' };
}

export async function lookupCopyAction(barcode: string): Promise<LookupResult<CopyLookup>> {
  const auth = await authorize(ROLES);
  if (!auth.ok) return { ok: false, message: auth.message };
  const code = String(barcode ?? '').trim().toUpperCase();
  if (!code) return { ok: false, message: 'Pindai atau ketik barcode buku terlebih dahulu.' };
  const copy = await findCopyByBarcode(code);
  return copy
    ? { ok: true, data: copy }
    : {
        ok: false,
        message: `Barcode ${code} tidak terdaftar. Periksa label buku, atau daftarkan eksemplarnya di Master Data → Buku.`,
      };
}

export async function createLoanAction(input: unknown): Promise<CreateLoanState> {
  const auth = await authorize(ROLES);
  if (!auth.ok) return { status: 'error', message: auth.message };

  const parsed = createLoanSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Data peminjaman tidak valid. Muat ulang halaman.' };
  }

  let result: LoanResult;
  try {
    result = await createLoan(parsed.data, auth.actor, schoolToday());
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
