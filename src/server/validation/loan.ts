import { z } from 'zod';
import { optionalText } from './common';

export const createLoanSchema = z.object({
  studentId: z.uuid('Pilih siswa terlebih dahulu.'),
  // Daftar kosong sengaja diterima: domain menolaknya dengan NO_COPY_SELECTED,
  // yang kalimatnya sudah disusun describeViolation.
  copyIds: z
    .array(z.uuid('Eksemplar tidak valid. Pindai ulang barcodenya.'), { error: 'Daftar buku tidak valid. Muat ulang halaman.' })
    .max(20, 'Maksimal 20 eksemplar dalam satu transaksi.'),
  notes: optionalText(500),
});

export type CreateLoanInput = z.output<typeof createLoanSchema>;
