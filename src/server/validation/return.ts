import { z } from 'zod';

const FEE = 'Biaya ganti harus nominal rupiah bulat, misalnya 50000.';

/**
 * Batas per buku. `loans.total_fine` bertipe numeric(12,2) (maks. 9.999.999.999,99);
 * dengan batas ini total denda tetap muat walau satu transaksi berisi 20 buku hilang.
 */
export const MAX_REPLACEMENT_FEE = 99_999_999;

export const returnSchema = z.object({
  loanId: z.uuid('Transaksi tidak valid. Cari ulang transaksinya.'),
  items: z
    .array(
      z.object({
        loanItemId: z.uuid('Buku tidak valid. Muat ulang halaman.'),
        condition: z.enum(['BAIK', 'RUSAK', 'HILANG'], 'Kondisi harus Baik, Rusak, atau Hilang.'),
        // null berarti memakai harga katalog buku (spec 5.3).
        replacementFee: z
          .number({ error: FEE })
          .int(FEE)
          .min(0, FEE)
          .max(MAX_REPLACEMENT_FEE, 'Biaya ganti maksimal Rp99.999.999 per buku. Periksa nominalnya.')
          .nullable(),
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
