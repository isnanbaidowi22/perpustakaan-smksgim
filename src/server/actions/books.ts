'use server';

import type { RecordStatus, UserRole } from '@/domain/shared/types';
import { formError, type FormState } from '@/lib/form-state';
import { runCommand, runFormAction } from '@/server/forms/run-action';
import { createBook, setBookStatus, updateBook } from '@/server/services/books';
import { bookSchema } from '@/server/validation/book';
import { isRecordStatus } from '@/server/validation/common';

const ROLES: UserRole[] = ['admin', 'petugas'];
const LIST = '/master/buku';
const INVALID = 'Data buku belum dapat disimpan. Periksa kolom yang ditandai.';

function detail(id: string): string {
  return `${LIST}/${id}`;
}

export async function createBookAction(_state: FormState, formData: FormData): Promise<FormState> {
  return runFormAction({
    roles: ROLES,
    schema: bookSchema,
    formData,
    invalidMessage: INVALID,
    execute: (data, actor) => createBook(data, actor),
    successMessage: 'Buku berhasil ditambahkan.',
    revalidate: [LIST],
    // Buku tanpa eksemplar belum dapat dipinjam; langsung buka halamannya.
    redirectTo: detail,
  });
}

export async function updateBookAction(id: string, _state: FormState, formData: FormData): Promise<FormState> {
  return runFormAction({
    roles: ROLES,
    schema: bookSchema,
    formData,
    invalidMessage: INVALID,
    execute: (data, actor) => updateBook(id, data, actor),
    successMessage: 'Perubahan data buku tersimpan.',
    revalidate: [LIST, detail(id)],
    redirectTo: detail,
  });
}

export async function setBookStatusAction(
  id: string,
  status: RecordStatus,
  _state: FormState,
  _formData: FormData,
): Promise<FormState> {
  if (!isRecordStatus(status)) {
    return formError('Status buku tidak dikenal. Muat ulang halaman lalu coba lagi.');
  }
  return runCommand({
    roles: ROLES,
    execute: (actor) => setBookStatus(id, status, actor),
    successMessage: status === 'active' ? 'Buku diaktifkan.' : 'Buku dinonaktifkan.',
    revalidate: [LIST, detail(id)],
  });
}
