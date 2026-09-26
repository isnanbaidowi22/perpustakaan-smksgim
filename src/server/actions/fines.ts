'use server';

import type { FormState } from '@/lib/form-state';
import { runFormAction } from '@/server/forms/run-action';
import { payFine } from '@/server/services/fines';
import { finePaymentSchema } from '@/server/validation/fine';

export async function payFineAction(loanId: string, _state: FormState, formData: FormData): Promise<FormState> {
  const detail = `/transaksi/riwayat/${loanId}`;
  return runFormAction({
    schema: finePaymentSchema,
    formData,
    invalidMessage: 'Pembayaran denda belum dapat dicatat. Periksa kolom yang ditandai.',
    execute: (data, actor) => payFine(loanId, data, actor),
    successMessage: 'Pembayaran denda tercatat.',
    revalidate: ['/transaksi/riwayat', detail],
    redirectTo: detail,
  });
}
