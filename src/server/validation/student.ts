import { z } from 'zod';
import { optionalText, optionalUuid, requiredText } from './common';

export const studentSchema = z.object({
  nis: requiredText('NIS wajib diisi.', 30).pipe(
    z.string().regex(/^[0-9A-Za-z.-]+$/, 'NIS hanya boleh berisi angka, huruf, titik, dan tanda hubung.'),
  ),
  name: requiredText('Nama siswa wajib diisi.', 150),
  className: requiredText('Kelas wajib diisi, misalnya XI RPL 1.', 30),
  major: optionalText(50),
  gender: z
    .string()
    .optional()
    .transform((value) => (value ?? '') || null)
    .pipe(z.enum(['L', 'P'], 'Jenis kelamin harus L atau P.').nullable()),
  phone: optionalText(20).pipe(
    z.string()
      .regex(/^[0-9+\-\s]+$/, 'Nomor telepon hanya boleh berisi angka, spasi, +, dan tanda hubung.')
      .nullable(),
  ),
  academicYearId: optionalUuid('Tahun ajaran tidak valid. Pilih dari daftar.'),
});

export type StudentInput = z.output<typeof studentSchema>;
