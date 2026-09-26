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
  it('menambah tinggi menurut panjang tiap judul, baris barcode, catatan kaki, dan catatan transaksi', () => {
    // dua judul pendek: masing-masing 1 baris judul (5mm) + 1 baris barcode (5mm) = 10mm
    expect(receiptPageHeightMm(['Pemrograman Web', 'Basis Data'], false, false)).toBe(110 + 20);
    // judul 60 karakter: ceil(60/28) = 3 baris judul (15mm) + 1 baris barcode (5mm) = 20mm
    expect(receiptPageHeightMm(['A'.repeat(60)], false, false)).toBe(110 + 5 * 3 + 5);
    expect(receiptPageHeightMm(['Pemrograman Web', 'Basis Data', 'Jaringan Komputer'], true, true)).toBe(110 + 30 + 14 + 10);
  });
});

describe('receiptPageCss', () => {
  it('menyusun aturan @page selebar kertas tanpa margin', () => {
    expect(receiptPageCss(58, 146)).toBe('@page { size: 58mm 146mm; margin: 0; }');
    expect(receiptPageCss(80, 122)).toBe('@page { size: 80mm 122mm; margin: 0; }');
  });
});
