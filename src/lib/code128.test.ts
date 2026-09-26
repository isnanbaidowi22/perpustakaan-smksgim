import { describe, expect, it } from 'vitest';
import { CODE128_PATTERNS, code128Bars, code128Values, encodeCode128 } from './code128';

const widthsOf = (pattern: string) => [...pattern].map(Number);
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

describe('CODE128_PATTERNS', () => {
  it('memuat 107 pola unik: 106 simbol selebar 11 modul dan STOP selebar 13', () => {
    expect(CODE128_PATTERNS).toHaveLength(107);
    expect(new Set(CODE128_PATTERNS).size).toBe(107);
    CODE128_PATTERNS.slice(0, 106).forEach((pattern, value) => {
      expect(pattern, `simbol ${value}`).toMatch(/^[1-4]{6}$/);
      expect(sum(widthsOf(pattern)), `simbol ${value}`).toBe(11);
    });
    expect(CODE128_PATTERNS[106]).toBe('2331112');
  });

  it('mematuhi aturan paritas Code128: jumlah lebar bar tiap simbol genap', () => {
    // Pola yang salah ketik hampir selalu melanggar aturan ini.
    CODE128_PATTERNS.slice(0, 106).forEach((pattern, value) => {
      const [b1, , b2, , b3] = widthsOf(pattern);
      expect((b1 + b2 + b3) % 2, `simbol ${value}`).toBe(0);
    });
  });

  it('memuat pola acuan dari tabel standar', () => {
    expect(CODE128_PATTERNS[0]).toBe('212222');
    expect(CODE128_PATTERNS[33]).toBe('111323');
    expect(CODE128_PATTERNS[64]).toBe('111422');
    expect(CODE128_PATTERNS[103]).toBe('211412');
    expect(CODE128_PATTERNS[104]).toBe('211214');
    expect(CODE128_PATTERNS[105]).toBe('211232');
  });
});

describe('code128Values', () => {
  it('menyusun START B, data, checksum modulo 103, dan STOP', () => {
    // Checksum: (104 + 48·1 + 42·2 + 42·3 + 17·4 + 18·5 + 19·6 + 35·7) mod 103 = 879 mod 103 = 55
    expect(code128Values('PJJ123C')).toEqual([104, 48, 42, 42, 17, 18, 19, 35, 55, 106]);
    // Barcode otomatis sistem: 896 mod 103 = 72
    expect(code128Values('BK-000001')).toEqual([104, 34, 43, 13, 16, 16, 16, 16, 16, 17, 72, 106]);
  });

  it('menolak teks kosong dan karakter di luar ASCII 32–126', () => {
    expect(code128Values('')).toBeNull();
    expect(code128Values('BUKU-É1')).toBeNull();
    expect(code128Values('BK\t1')).toBeNull();
    expect(code128Values('~ ')).toEqual([104, 94, 0, (104 + 94 * 1 + 0 * 2) % 103, 106]);
  });
});

describe('code128Values — subset C', () => {
  it('memakai START C untuk teks angka genap dan menghitung pasangan digit', () => {
    // Checksum: (105+20+52+27+100+0+6) mod 103 = 1
    expect(code128Values('202609250001')).toEqual([105, 20, 26, 9, 25, 0, 1, 1, 106]);
  });

  it('memakai START B untuk teks angka ganjil (tidak dapat dipasangkan)', () => {
    expect(code128Values('123')?.[0]).toBe(104);
  });
});

describe('code128Bars — subset C', () => {
  it('menghitung total modul untuk 12 digit dikodekan sebagai 6 simbol subset C', () => {
    // 8 simbol data × 11 modul + STOP 13 modul + 2×10 zona sepi = 121
    expect(code128Bars('202609250001')?.totalModules).toBe(8 * 11 + 13 + 20);
  });
});

describe('encodeCode128', () => {
  it('menghasilkan lebar modul berselang-seling yang diawali START B dan diakhiri STOP', () => {
    const widths = encodeCode128('A');
    // START B, 'A' (33), checksum (104 + 33) mod 103 = 34, STOP
    expect(widths).toEqual([
      ...widthsOf('211214'), ...widthsOf('111323'), ...widthsOf('131123'), ...widthsOf('2331112'),
    ]);
    expect(sum(widths ?? [])).toBe(11 * 3 + 13);
  });

  it('mengembalikan null bila teks tidak dapat dikodekan', () => {
    expect(encodeCode128('Buku É')).toBeNull();
  });
});

describe('code128Bars', () => {
  it('menempatkan bar setelah zona sepi 10 modul dan menghitung lebar total', () => {
    const result = code128Bars('A');
    expect(result).not.toBeNull();
    // 3 simbol × 3 bar + STOP 4 bar
    expect(result?.bars).toHaveLength(13);
    expect(result?.bars[0]).toEqual({ x: 10, width: 2 });
    expect(result?.totalModules).toBe(46 + 20);
    const last = result?.bars.at(-1);
    expect((last?.x ?? 0) + (last?.width ?? 0)).toBe(46 + 10);
  });

  it('mengembalikan null untuk teks yang tidak dapat dikodekan', () => {
    expect(code128Bars('')).toBeNull();
  });
});
