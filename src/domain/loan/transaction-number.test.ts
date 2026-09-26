import { describe, expect, it } from 'vitest';
import {
  formatTransactionNumber, loanCounterScope, normalizeTransactionNumber, transactionScanCode,
} from './transaction-number';

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

describe('transactionScanCode', () => {
  it('mengambil digitnya saja dari nomor transaksi', () => {
    expect(transactionScanCode('PJM-20260925-0001')).toBe('202609250001');
  });
});

describe('normalizeTransactionNumber', () => {
  it('menerima format baku, huruf kecil, atau kode pindai digit-saja', () => {
    expect(normalizeTransactionNumber('PJM-20260925-0001')).toBe('PJM-20260925-0001');
    expect(normalizeTransactionNumber('pjm-20260925-0001')).toBe('PJM-20260925-0001');
    expect(normalizeTransactionNumber('202609250001')).toBe('PJM-20260925-0001');
  });

  it('menerima nomor urut 5 digit atau lebih (di atas 9999)', () => {
    expect(normalizeTransactionNumber('2026092510000')).toBe('PJM-20260925-10000');
  });

  it('merapikan spasi di sekitar masukan', () => {
    expect(normalizeTransactionNumber('  202609250001  ')).toBe('PJM-20260925-0001');
  });

  it('menolak masukan yang bukan nomor transaksi atau kode pindai', () => {
    expect(normalizeTransactionNumber('BK-000001')).toBeNull();
    expect(normalizeTransactionNumber('20260925001')).toBeNull();
    expect(normalizeTransactionNumber('')).toBeNull();
  });
});
