import { z } from 'zod';
import { checkbox, optionalText, requiredInteger, requiredText, rupiah } from './common';

const FINE = 'Denda per hari harus nominal rupiah 0 sampai 1.000.000.';

export const settingsSchema = z.object({
  maxActiveLoans: requiredInteger('Batas pinjam harus bilangan bulat 1 sampai 20.', 1, 20),
  loanDurationDays: requiredInteger('Durasi pinjam harus bilangan bulat 1 sampai 90 hari.', 1, 90),
  // Wajib diisi, tidak seperti harga buku: denda kosong yang diam-diam
  // menjadi nol akan mematikan denda tanpa ada yang menyadarinya.
  finePerDay: requiredText('Denda per hari wajib diisi. Tulis 0 bila tidak ada denda.', 20)
    .transform((value): string | undefined => value)
    .pipe(rupiah(FINE))
    .pipe(z.number().max(1_000_000, FINE)),
  blockWhenOverdue: checkbox(),
  blockWhenUnpaidFine: checkbox(),
  schoolName: requiredText('Nama sekolah wajib diisi; dicetak di struk peminjaman.', 150),
  receiptFooter: optionalText(300),
});

export type SettingsInput = z.output<typeof settingsSchema>;
