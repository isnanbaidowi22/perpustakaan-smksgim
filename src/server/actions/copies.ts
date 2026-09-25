'use server';

import { isManualCopyAction, type ManualCopyAction } from '@/domain/copy/manual-status';
import { formError, type FormState } from '@/lib/form-state';
import { runCommand, runFormAction } from '@/server/forms/run-action';
import { addCopies, changeCopyStatus } from '@/server/services/copies';
import { addCopiesSchema } from '@/server/validation/copy';

function affectedPages(bookId: string): string[] {
  return ['/master/buku', `/master/buku/${bookId}`];
}

export async function addCopiesAction(bookId: string, _state: FormState, formData: FormData): Promise<FormState> {
  return runFormAction({
    roles: ['admin', 'petugas'],
    schema: addCopiesSchema,
    formData,
    invalidMessage: 'Eksemplar belum dapat ditambahkan. Periksa kolom yang ditandai.',
    execute: (data, actor) => addCopies(bookId, data, actor),
    successMessage: 'Eksemplar berhasil ditambahkan.',
    revalidate: affectedPages(bookId),
  });
}

/** Spec Section 7: memulihkan eksemplar rusak/hilang hanya boleh dilakukan admin. */
export async function changeCopyStatusAction(
  bookId: string,
  copyId: string,
  action: ManualCopyAction,
  _state: FormState,
  _formData: FormData,
): Promise<FormState> {
  if (!isManualCopyAction(action)) {
    return formError('Aksi eksemplar tidak dikenal. Muat ulang halaman lalu coba lagi.');
  }
  return runCommand({
    roles: ['admin'],
    execute: (actor) => changeCopyStatus(copyId, action, actor),
    successMessage: 'Status eksemplar diperbarui.',
    revalidate: affectedPages(bookId),
  });
}
