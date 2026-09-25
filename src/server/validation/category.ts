import { z } from 'zod';
import { requiredText } from './common';

export const categorySchema = z.object({
  name: requiredText('Nama kategori wajib diisi.', 100),
});

export type CategoryInput = z.output<typeof categorySchema>;
