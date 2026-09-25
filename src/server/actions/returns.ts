'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { RETURN_SAVE_FAILED } from '@/lib/circulation-results';
import { formError, type FormState } from '@/lib/form-state';
import { schoolToday } from '@/lib/school-date';
import { authorize } from '@/server/auth/guard';
import { processReturn } from '@/server/services/returns';
import type { ServiceResult } from '@/server/services/result';
import { returnSchema } from '@/server/validation/return';

/**
 * Masukan berbentuk objek (bukan FormData) karena satu pengembalian memuat
 * beberapa buku, masing-masing dengan kondisi dan biaya gantinya.
 */
export async function processReturnAction(input: unknown): Promise<FormState> {
  const auth = await authorize(['admin', 'petugas']);
  if (!auth.ok) return formError(auth.message);

  const parsed = returnSchema.safeParse(input);
  if (!parsed.success) {
    return formError(parsed.error.issues[0]?.message ?? 'Data pengembalian tidak valid. Muat ulang halaman.');
  }

  let result: ServiceResult;
  try {
    result = await processReturn(parsed.data, auth.actor, schoolToday());
  } catch (error) {
    console.error('processReturn gagal', error);
    return formError(RETURN_SAVE_FAILED);
  }
  if (!result.ok) return formError(result.message);

  for (const path of ['/transaksi/riwayat', '/transaksi/pengembalian', '/master/buku']) revalidatePath(path);
  const message = result.notice ? `Pengembalian tersimpan. ${result.notice}` : 'Pengembalian tersimpan.';
  // redirect() melempar; sengaja di luar try/catch.
  redirect(`/transaksi/riwayat/${result.id}?pesan=${encodeURIComponent(message)}`);
}
