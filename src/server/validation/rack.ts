import { z } from 'zod';
import { optionalText, requiredText } from './common';

export const rackSchema = z.object({
  code: requiredText('Kode rak wajib diisi.', 20)
    .transform((value) => value.toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9-]+$/, 'Kode rak hanya boleh berisi huruf, angka, dan tanda hubung, misalnya A-3.')),
  name: requiredText('Nama rak wajib diisi.', 100),
  location: optionalText(100),
});

export type RackInput = z.output<typeof rackSchema>;
