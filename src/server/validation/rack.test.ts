import { describe, expect, it } from 'vitest';
import { rackSchema } from './rack';

describe('rackSchema', () => {
  it('menormalkan kode ke huruf besar dan lokasi kosong menjadi null', () => {
    expect(rackSchema.parse({ code: ' a-3 ', name: 'Rak A Baris 3', location: '' })).toEqual({
      code: 'A-3',
      name: 'Rak A Baris 3',
      location: null,
    });
  });

  it('menolak kode berisi spasi dengan contoh format yang benar', () => {
    const result = rackSchema.safeParse({ code: 'A 3', name: 'Rak A' });
    expect(result.error?.issues[0]?.message).toBe(
      'Kode rak hanya boleh berisi huruf, angka, dan tanda hubung, misalnya A-3.',
    );
  });

  it('mewajibkan kode dan nama', () => {
    const result = rackSchema.safeParse({ code: '', name: '' });
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      'Kode rak wajib diisi.',
      'Nama rak wajib diisi.',
    ]);
  });
});
