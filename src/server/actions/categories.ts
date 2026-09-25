'use server';

import type { RecordStatus, UserRole } from '@/domain/shared/types';
import { formError, type FormState } from '@/lib/form-state';
import { runCommand, runFormAction } from '@/server/forms/run-action';
import { createCategory, setCategoryStatus, updateCategory } from '@/server/services/categories';
import { categorySchema } from '@/server/validation/category';
import { isRecordStatus } from '@/server/validation/common';

const ROLES: UserRole[] = ['admin', 'petugas'];
const LIST = '/master/kategori';
const INVALID = 'Kategori belum dapat disimpan. Periksa kolom yang ditandai.';

export async function createCategoryAction(_state: FormState, formData: FormData): Promise<FormState> {
  return runFormAction({
    roles: ROLES,
    schema: categorySchema,
    formData,
    invalidMessage: INVALID,
    execute: (data, actor) => createCategory(data, actor),
    successMessage: 'Kategori berhasil ditambahkan.',
    revalidate: [LIST],
    redirectTo: LIST,
  });
}

export async function updateCategoryAction(id: string, _state: FormState, formData: FormData): Promise<FormState> {
  return runFormAction({
    roles: ROLES,
    schema: categorySchema,
    formData,
    invalidMessage: INVALID,
    execute: (data, actor) => updateCategory(id, data, actor),
    successMessage: 'Perubahan kategori tersimpan.',
    revalidate: [LIST],
    redirectTo: LIST,
  });
}

export async function setCategoryStatusAction(
  id: string,
  status: RecordStatus,
  _state: FormState,
  _formData: FormData,
): Promise<FormState> {
  // Argumen yang di-bind tetap dapat diubah dari peramban; periksa lagi di server.
  if (!isRecordStatus(status)) {
    return formError('Status kategori tidak dikenal. Muat ulang halaman lalu coba lagi.');
  }
  return runCommand({
    roles: ROLES,
    execute: (actor) => setCategoryStatus(id, status, actor),
    successMessage: status === 'active' ? 'Kategori diaktifkan.' : 'Kategori dinonaktifkan.',
    revalidate: [LIST],
  });
}
