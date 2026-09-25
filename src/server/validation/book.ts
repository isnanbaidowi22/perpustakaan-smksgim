import { z } from 'zod';
import { optionalInteger, optionalText, optionalUuid, requiredText, rupiah } from './common';

export const bookSchema = z.object({
  isbn: optionalText(20)
    .transform((value) => (value === null ? null : value.replace(/[-\s]/g, '').toUpperCase()))
    .pipe(
      z.string()
        .regex(/^(\d{9}[\dX]|\d{13})$/, 'ISBN harus 10 atau 13 digit. Tanda hubung boleh diketik.')
        .nullable(),
    ),
  title: requiredText('Judul buku wajib diisi.', 200),
  author: requiredText('Penulis wajib diisi.', 150),
  publisher: optionalText(150),
  publishYear: optionalInteger('Tahun terbit harus bilangan antara 1800 dan 2100.', 1800, 2100),
  categoryId: optionalUuid('Kategori tidak valid. Pilih dari daftar.'),
  rackId: optionalUuid('Rak tidak valid. Pilih dari daftar.'),
  price: rupiah('Harga harus berupa bilangan bulat rupiah, minimal 0.'),
  description: optionalText(2000),
});

export type BookInput = z.output<typeof bookSchema>;
