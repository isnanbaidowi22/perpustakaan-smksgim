import { describe, expect, it } from 'vitest';
import { parseReceiptWidth, receiptPageCss, receiptPageHeightMm } from './receipt';

describe('parseReceiptWidth', () => {
  it('memakai 58 mm kecuali diminta 80 mm', () => {
    expect(parseReceiptWidth('80')).toBe(80);
    expect(parseReceiptWidth('58')).toBe(58);
    expect(parseReceiptWidth('')).toBe(58);
    expect(parseReceiptWidth('100')).toBe(58);
  });
});

describe('receiptPageHeightMm', () => {
  it('menambah tinggi untuk setiap buku, catatan kaki, dan catatan transaksi', () => {
    expect(receiptPageHeightMm(1, false, false)).toBe(122);
    expect(receiptPageHeightMm(3, false, false)).toBe(146);
    expect(receiptPageHeightMm(3, true, true)).toBe(170);
  });
});

describe('receiptPageCss', () => {
  it('menyusun aturan @page selebar kertas tanpa margin', () => {
    expect(receiptPageCss(58, 146)).toBe('@page { size: 58mm 146mm; margin: 0; }');
    expect(receiptPageCss(80, 122)).toBe('@page { size: 80mm 122mm; margin: 0; }');
  });
});
