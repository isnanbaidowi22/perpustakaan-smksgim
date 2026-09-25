import { z } from 'zod';
import { isReservedBarcode } from '@/domain/copy/barcode';
import { optionalInteger, optionalText } from './common';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const addCopiesSchema = z
  .object({
    count: optionalInteger('Jumlah eksemplar harus antara 1 dan 50.', 1, 50).transform((value) => value ?? 1),
    barcode: optionalText(30)
      .transform((value) => value?.toUpperCase() ?? null)
      .pipe(
        z.string()
          .regex(/^[A-Z0-9-]+$/, 'Barcode hanya boleh berisi huruf, angka, dan tanda hubung.')
          .refine(
            (value) => !isReservedBarcode(value),
            'Awalan BK- dicadangkan untuk barcode otomatis. Kosongkan kolom ini agar sistem membuatkannya.',
          )
          .nullable(),
      ),
    // <input type="date"> selalu mengirim YYYY-MM-DD, sesuai konvensi tanggal proyek.
    acquisitionDate: optionalText(10).pipe(
      z.string().regex(ISO_DATE, 'Tanggal pengadaan harus berformat YYYY-MM-DD.').nullable(),
    ),
    notes: optionalText(500),
  })
  .refine((value) => value.barcode === null || value.count === 1, {
    message: 'Barcode manual hanya untuk satu eksemplar. Ubah jumlah menjadi 1 atau kosongkan barcode.',
    path: ['barcode'],
  });

export type AddCopiesInput = z.output<typeof addCopiesSchema>;
