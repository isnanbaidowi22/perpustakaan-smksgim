import { z } from 'zod';
import { optionalText, requiredText, rupiah } from './common';

const AMOUNT = 'Nominal pembayaran harus berupa angka rupiah, misalnya 5.000.';

export const finePaymentSchema = z.object({
  amount: requiredText('Nominal pembayaran wajib diisi.', 20)
    // Pelebar tipe saja, sama seperti settingsSchema: `.pipe()` zod 4.6
    // menuntut tipe masukan rupiah() (string | undefined) persis sama.
    .transform((value): string | undefined => value)
    .pipe(rupiah(AMOUNT))
    .pipe(z.number().min(1, 'Nominal pembayaran minimal Rp1.')),
  note: optionalText(200),
});

export type FinePaymentInput = z.output<typeof finePaymentSchema>;
