'use server';

import type { RecordStatus } from '@/domain/shared/types';
import { formError, type FormState } from '@/lib/form-state';
import { supabaseAuthAdmin } from '@/server/auth/auth-admin';
import { runCommand, runFormAction } from '@/server/forms/run-action';
import { createUser, resetUserPassword, setUserStatus, updateUser } from '@/server/services/users';
import { isRecordStatus } from '@/server/validation/common';
import { newUserSchema, passwordSchema, userSchema } from '@/server/validation/user';

const LIST = '/pengaturan/pengguna';
const SECRET = ['password', 'passwordConfirm'];

export async function createUserAction(_state: FormState, formData: FormData): Promise<FormState> {
  return runFormAction({
    schema: newUserSchema,
    formData,
    invalidMessage: 'Pengguna belum dapat dibuat. Periksa kolom yang ditandai.',
    secretFields: SECRET,
    execute: (data, actor) => createUser(data, actor, supabaseAuthAdmin()),
    successMessage: 'Pengguna berhasil dibuat. Sampaikan username dan kata sandinya secara langsung.',
    revalidate: [LIST],
    redirectTo: LIST,
  });
}

export async function updateUserAction(id: string, _state: FormState, formData: FormData): Promise<FormState> {
  return runFormAction({
    schema: userSchema,
    formData,
    invalidMessage: 'Perubahan pengguna belum dapat disimpan. Periksa kolom yang ditandai.',
    execute: (data, actor) => updateUser(id, data, actor),
    successMessage: 'Perubahan pengguna tersimpan.',
    revalidate: [LIST],
    redirectTo: LIST,
  });
}

export async function resetUserPasswordAction(id: string, _state: FormState, formData: FormData): Promise<FormState> {
  return runFormAction({
    schema: passwordSchema,
    formData,
    invalidMessage: 'Kata sandi belum dapat diganti. Periksa kolom yang ditandai.',
    secretFields: SECRET,
    execute: (data, actor) => resetUserPassword(id, data, actor, supabaseAuthAdmin()),
    successMessage: 'Kata sandi diganti. Sampaikan kata sandi baru secara langsung kepada pemilik akun.',
    revalidate: [],
  });
}

export async function setUserStatusAction(
  id: string,
  status: RecordStatus,
  _state: FormState,
  _formData: FormData,
): Promise<FormState> {
  if (!isRecordStatus(status)) {
    return formError('Status pengguna tidak dikenal. Muat ulang halaman lalu coba lagi.');
  }
  return runCommand({
    execute: (actor) => setUserStatus(id, status, actor),
    successMessage: status === 'active' ? 'Pengguna diaktifkan.' : 'Pengguna dinonaktifkan.',
    revalidate: [LIST],
  });
}
