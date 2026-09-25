import { describe, expect, it } from 'vitest';
import { categorySchema } from './category';

describe('categorySchema', () => {
  it('membuang spasi di ujung nama', () => {
    expect(categorySchema.parse({ name: '  Fiksi ' })).toEqual({ name: 'Fiksi' });
  });

  it('menolak nama kosong dengan pesan yang menyebut kategori', () => {
    const result = categorySchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Nama kategori wajib diisi.');
  });
});
