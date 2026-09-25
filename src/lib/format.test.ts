import { describe, expect, it } from 'vitest';
import { formatDate, formatRupiah } from './format';

describe('formatRupiah', () => {
  it('memakai titik pemisah ribuan tanpa spasi setelah Rp', () => {
    expect(formatRupiah(85_000)).toBe('Rp85.000');
  });

  it('menerima nilai numeric dari Postgres yang berbentuk teks', () => {
    expect(formatRupiah('92000.00')).toBe('Rp92.000');
  });

  it('menampilkan nol sebagai Rp0', () => {
    expect(formatRupiah(0)).toBe('Rp0');
  });
});

describe('formatDate', () => {
  it('mengubah YYYY-MM-DD menjadi DD/MM/YYYY', () => {
    expect(formatDate('2026-09-24')).toBe('24/09/2026');
  });

  it('menampilkan tanda pisah untuk tanggal kosong', () => {
    expect(formatDate(null)).toBe('—');
  });
});
