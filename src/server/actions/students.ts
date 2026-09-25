'use server';

import type { RecordStatus, UserRole } from '@/domain/shared/types';
import { formError, type FormState } from '@/lib/form-state';
import { runCommand, runFormAction } from '@/server/forms/run-action';
import { createStudent, setStudentStatus, updateStudent } from '@/server/services/students';
import { isRecordStatus } from '@/server/validation/common';
import { studentSchema } from '@/server/validation/student';

const ROLES: UserRole[] = ['admin', 'petugas'];
const LIST = '/master/siswa';
const INVALID = 'Data siswa belum dapat disimpan. Periksa kolom yang ditandai.';

export async function createStudentAction(_state: FormState, formData: FormData): Promise<FormState> {
  return runFormAction({
    roles: ROLES,
    schema: studentSchema,
    formData,
    invalidMessage: INVALID,
    execute: (data, actor) => createStudent(data, actor),
    successMessage: 'Siswa berhasil ditambahkan.',
    revalidate: [LIST],
    redirectTo: LIST,
  });
}

export async function updateStudentAction(id: string, _state: FormState, formData: FormData): Promise<FormState> {
  return runFormAction({
    roles: ROLES,
    schema: studentSchema,
    formData,
    invalidMessage: INVALID,
    execute: (data, actor) => updateStudent(id, data, actor),
    successMessage: 'Perubahan data siswa tersimpan.',
    revalidate: [LIST],
    redirectTo: LIST,
  });
}

export async function setStudentStatusAction(
  id: string,
  status: RecordStatus,
  _state: FormState,
  _formData: FormData,
): Promise<FormState> {
  if (!isRecordStatus(status)) {
    return formError('Status siswa tidak dikenal. Muat ulang halaman lalu coba lagi.');
  }
  return runCommand({
    roles: ROLES,
    execute: (actor) => setStudentStatus(id, status, actor),
    successMessage: status === 'active' ? 'Siswa diaktifkan.' : 'Siswa dinonaktifkan.',
    revalidate: [LIST],
  });
}
