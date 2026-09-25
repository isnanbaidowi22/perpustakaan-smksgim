import { describe, expect, it } from 'vitest';
import { formatTransactionNumber, loanCounterScope } from './transaction-number';

describe('formatTransactionNumber', () => {
  it('mengikuti format PJM-YYYYMMDD-NNNN (spec 6.3)', () => {
    expect(formatTransactionNumber('2026-09-21', 1)).toBe('PJM-20260921-0001');
    expect(formatTransactionNumber('2026-09-21', 37)).toBe('PJM-20260921-0037');
  });

  it('tidak memotong nomor urut di atas 9999', () => {
    expect(formatTransactionNumber('2026-09-21', 12345)).toBe('PJM-20260921-12345');
  });

  it('menolak nomor urut yang bukan bilangan bulat positif', () => {
    expect(() => formatTransactionNumber('2026-09-21', 0)).toThrow('Nomor urut transaksi harus bilangan bulat positif');
  });

  it('menolak tanggal yang bukan YYYY-MM-DD', () => {
    expect(() => formatTransactionNumber('21/09/2026', 1)).toThrow('Tanggal tidak valid');
  });
});

describe('loanCounterScope', () => {
  it('memberi satu penghitung per hari', () => {
    expect(loanCounterScope('2026-09-21')).toBe('loan:20260921');
  });
});
