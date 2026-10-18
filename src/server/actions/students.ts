'use server';

import type { FormState } from '@/lib/form-state';
import { runFormAction } from '@/server/forms/run-action';
import { updateStudent } from '@/server/services/students';
import { studentSchema } from '@/server/validation/student';

/** Siswa didaftarkan dan diubah dari meja peminjaman, jadi ke sanalah petugas kembali. */
const DESK = '/transaksi/peminjaman';

export async function updateStudentAction(id: string, _state: FormState, formData: FormData): Promise<FormState> {
  return runFormAction({
    schema: studentSchema,
    formData,
    invalidMessage: 'Data siswa belum dapat disimpan. Periksa kolom yang ditandai.',
    execute: (data, actor) => updateStudent(id, data, actor),
    successMessage: 'Perubahan data siswa tersimpan.',
    revalidate: [DESK],
    redirectTo: DESK,
  });
}
