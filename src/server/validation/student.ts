import { z } from 'zod';
import { optionalText, optionalUuid, requiredText } from './common';

/** Sejak revisi 28 September 2026 siswa dicatat tanpa NIS dan nomor telepon. */
export const studentSchema = z.object({
  name: requiredText('Nama siswa wajib diisi.', 150),
  className: requiredText('Kelas wajib diisi, misalnya XI RPL 1.', 30),
  major: optionalText(50),
  gender: z
    .string()
    .optional()
    .transform((value) => (value ?? '') || null)
    .pipe(z.enum(['L', 'P'], 'Jenis kelamin harus L atau P.').nullable()),
  academicYearId: optionalUuid('Tahun ajaran tidak valid. Pilih dari daftar.'),
});

export type StudentInput = z.output<typeof studentSchema>;
