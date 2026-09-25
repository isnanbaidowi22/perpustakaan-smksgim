import { describe, expect, it } from 'vitest';
import { firstValue, parseStatusFilter, withQuery } from './search-params';

describe('firstValue', () => {
  it('mengambil nilai pertama dari parameter berulang', () => {
    expect(firstValue(['a', 'b'])).toBe('a');
  });

  it('mengubah parameter yang tidak ada menjadi untai kosong', () => {
    expect(firstValue(undefined)).toBe('');
  });
});

describe('parseStatusFilter', () => {
  it('menampilkan data aktif secara bawaan', () => {
    expect(parseStatusFilter('')).toBe('active');
    expect(parseStatusFilter('entah')).toBe('active');
  });

  it('menerima inactive dan all', () => {
    expect(parseStatusFilter('inactive')).toBe('inactive');
    expect(parseStatusFilter('all')).toBe('all');
  });
});

describe('withQuery', () => {
  it('menyusun query string dan membuang parameter kosong', () => {
    expect(withQuery('/master/kategori', { q: 'fiksi', status: '', hal: 2 })).toBe('/master/kategori?q=fiksi&hal=2');
  });

  it('mengembalikan path apa adanya bila tidak ada parameter', () => {
    expect(withQuery('/master/kategori', { q: '' })).toBe('/master/kategori');
  });
});
