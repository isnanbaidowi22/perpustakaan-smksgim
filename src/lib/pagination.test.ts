import { describe, expect, it } from 'vitest';
import { offsetOf, PAGE_SIZE, pageCount, parsePage } from './pagination';

describe('parsePage', () => {
  it('membaca nomor halaman yang sah', () => {
    expect(parsePage('3')).toBe(3);
  });

  it.each(['', '0', '-2', 'dua', '1.5'])('kembali ke halaman 1 untuk %j', (value) => {
    expect(parsePage(value)).toBe(1);
  });

  it('kembali ke halaman 1 untuk nilai yang terlalu besar untuk OFFSET SQL', () => {
    expect(parsePage('1e20')).toBe(1);
    expect(parsePage('100001')).toBe(1);
  });

  it('menerima batas atas yang wajar', () => {
    expect(parsePage('100000')).toBe(100000);
  });
});

describe('pageCount dan offsetOf', () => {
  it('selalu ada minimal satu halaman', () => {
    expect(pageCount(0)).toBe(1);
  });

  it('membulatkan ke atas', () => {
    expect(pageCount(PAGE_SIZE + 1)).toBe(2);
  });

  it('menghitung offset dari nomor halaman', () => {
    expect(offsetOf(1)).toBe(0);
    expect(offsetOf(3)).toBe(PAGE_SIZE * 2);
  });
});
