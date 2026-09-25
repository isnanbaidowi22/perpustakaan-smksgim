import { z } from 'zod';

const FEE = 'Biaya ganti harus nominal rupiah bulat, misalnya 50000.';

export const returnSchema = z.object({
  loanId: z.uuid('Transaksi tidak valid. Cari ulang transaksinya.'),
  items: z
    .array(
      z.object({
        loanItemId: z.uuid('Buku tidak valid. Muat ulang halaman.'),
        condition: z.enum(['BAIK', 'RUSAK', 'HILANG'], 'Kondisi harus Baik, Rusak, atau Hilang.'),
        // null berarti memakai harga katalog buku (spec 5.3).
        replacementFee: z.number({ error: FEE }).int(FEE).min(0, FEE).max(9_999_999_999, FEE).nullable(),
        note: z
          .string()
          .max(500, 'Catatan kondisi maksimal 500 karakter.')
          .nullable()
          .transform((value) => value?.trim() || null),
      }),
      { error: 'Data pengembalian tidak valid. Muat ulang halaman.' },
    )
    .min(1, 'Centang minimal satu buku yang dikembalikan.'),
});

export type ReturnInput = z.output<typeof returnSchema>;
