import { describe, expect, it } from 'vitest';
import { autoBarcodeRange, formatAutoBarcode, isReservedBarcode } from './barcode';

describe('formatAutoBarcode', () => {
  it('memberi awalan BK- dan minimal enam digit', () => {
    expect(formatAutoBarcode(123)).toBe('BK-000123');
  });

  it('tidak memotong nomor yang melebihi enam digit', () => {
    expect(formatAutoBarcode(1_234_567)).toBe('BK-1234567');
  });

  it.each([0, -1, 1.5])('menolak nomor urut %s', (sequence) => {
    expect(() => formatAutoBarcode(sequence)).toThrow('bilangan bulat positif');
  });
});

describe('autoBarcodeRange', () => {
  it('menghasilkan barcode berurutan yang berakhir di nomor terakhir yang dialokasikan', () => {
    expect(autoBarcodeRange(9, 3)).toEqual(['BK-000007', 'BK-000008', 'BK-000009']);
  });

  it('menghasilkan satu barcode untuk satu eksemplar', () => {
    expect(autoBarcodeRange(1, 1)).toEqual(['BK-000001']);
  });
});

describe('isReservedBarcode', () => {
  it('mengenali awalan BK- tanpa membedakan huruf besar', () => {
    expect(isReservedBarcode('bk-000001')).toBe(true);
  });

  it('mengizinkan barcode lain', () => {
    expect(isReservedBarcode('LAMA-0001')).toBe(false);
  });
});
