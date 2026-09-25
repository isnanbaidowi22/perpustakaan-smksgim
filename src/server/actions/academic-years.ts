'use server';

import type { UserRole } from '@/domain/shared/types';
import type { FormState } from '@/lib/form-state';
import { runCommand, runFormAction } from '@/server/forms/run-action';
import {
  activateAcademicYear, createAcademicYear, updateAcademicYear,
} from '@/server/services/academic-years';
import { academicYearSchema, newAcademicYearSchema } from '@/server/validation/academic-year';

const ROLES: UserRole[] = ['admin'];
const LIST = '/pengaturan/tahun-ajaran';
const INVALID = 'Tahun ajaran belum dapat disimpan. Periksa kolom yang ditandai.';

export async function createAcademicYearAction(_state: FormState, formData: FormData): Promise<FormState> {
  return runFormAction({
    roles: ROLES,
    schema: newAcademicYearSchema,
    formData,
    invalidMessage: INVALID,
    execute: (data, actor) => createAcademicYear(data, actor),
    successMessage: 'Tahun ajaran berhasil ditambahkan.',
    revalidate: [LIST],
    redirectTo: LIST,
  });
}

export async function updateAcademicYearAction(id: string, _state: FormState, formData: FormData): Promise<FormState> {
  return runFormAction({
    roles: ROLES,
    schema: academicYearSchema,
    formData,
    invalidMessage: INVALID,
    execute: (data, actor) => updateAcademicYear(id, data, actor),
    successMessage: 'Perubahan tahun ajaran tersimpan.',
    revalidate: [LIST],
    redirectTo: LIST,
  });
}

/**
 * Top bar menampilkan tahun aktif di setiap halaman. revalidatePath dari
 * Server Action menyegarkan halaman yang sedang dibuka sekaligus halaman
 * lain saat dikunjungi lagi (revalidatePath.md § Good to know).
 */
export async function activateAcademicYearAction(
  id: string,
  _state: FormState,
  _formData: FormData,
): Promise<FormState> {
  return runCommand({
    roles: ROLES,
    execute: (actor) => activateAcademicYear(id, actor),
    successMessage: 'Tahun ajaran aktif diganti. Peminjaman baru tercatat di tahun ini.',
    revalidate: [LIST],
  });
}
