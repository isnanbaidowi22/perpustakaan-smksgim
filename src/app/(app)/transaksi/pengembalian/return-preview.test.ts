import { describe, expect, it } from 'vitest';
import {
  initialRows, parseRupiahInput, previewReturn, toReturnInput, type ReturnableItem,
} from './return-preview';

const items: ReturnableItem[] = [
  { id: 'i1', barcode: 'BK-000001', bookTitle: 'Pemrograman Web', bookPrice: 85000 },
  { id: 'i2', barcode: 'BK-000002', bookTitle: 'Buku Sumbangan', bookPrice: 0 },
];
const context = { dueDate: '2090-03-05', today: '2090-03-09', finePerDay: 1000 };

describe('parseRupiahInput', () => {
  it('menerima titik ribuan, menganggap kosong sebagai null, dan menandai selain angka', () => {
    expect(parseRupiahInput('30.000')).toBe(30000);
    expect(parseRupiahInput(' ')).toBeNull();
    expect(parseRupiahInput('tiga puluh')).toBeNaN();
  });
});

describe('previewReturn', () => {
  it('mencentang semua buku dengan kondisi Baik dan biaya ganti sebesar harga katalog secara bawaan', () => {
    expect(initialRows(items)).toEqual({
      i1: { selected: true, condition: 'BAIK', replacementFee: '85000', note: '' },
      i2: { selected: true, condition: 'BAIK', replacementFee: '0', note: '' },
    });
  });

  it('mencentang hanya buku yang cocok bila pencarian sama dengan barcode salah satu buku (I1)', () => {
    expect(initialRows(items, 'BK-000002')).toEqual({
      i1: { selected: false, condition: 'BAIK', replacementFee: '85000', note: '' },
      i2: { selected: true, condition: 'BAIK', replacementFee: '0', note: '' },
    });
  });

  it('mencocokkan barcode tanpa peduli huruf besar/kecil dan spasi di pinggir', () => {
    expect(initialRows(items, ' bk-000001 ').i1.selected).toBe(true);
    expect(initialRows(items, ' bk-000001 ').i2.selected).toBe(false);
  });

  it('mencentang semua buku bila pencarian bukan barcode salah satu buku (nomor transaksi, NIS, atau nama)', () => {
    expect(initialRows(items, 'PJM-20900302-0001').i1.selected).toBe(true);
    expect(initialRows(items, 'PJM-20900302-0001').i2.selected).toBe(true);
    expect(initialRows(items, undefined).i1.selected).toBe(true);
  });

  it('menghitung denda telat per eksemplar yang dicentang', () => {
    const rows = { ...initialRows(items), i2: { ...initialRows(items).i2, selected: false } };

    expect(previewReturn(items, rows, context)).toEqual({
      lines: [{ itemId: 'i1', daysLate: 4, lateFine: 4000, replacementFee: 0, total: 4000 }],
      total: 4000,
      problems: [],
      warnings: [],
    });
  });

  it('menumpuk biaya ganti yang ditimpa petugas untuk buku rusak', () => {
    const rows = initialRows(items);
    rows.i1 = { ...rows.i1, condition: 'RUSAK', replacementFee: '60.000' };
    rows.i2 = { ...rows.i2, selected: false };

    expect(previewReturn(items, rows, context).lines).toEqual([
      { itemId: 'i1', daysLate: 4, lateFine: 4000, replacementFee: 60000, total: 64000 },
    ]);
  });

  it('memperingatkan biaya ganti Rp0 untuk buku rusak atau hilang (spec §12)', () => {
    const rows = initialRows(items);
    rows.i1 = { ...rows.i1, selected: false };
    rows.i2 = { ...rows.i2, condition: 'HILANG' };

    expect(previewReturn(items, rows, context).warnings).toEqual([
      'Biaya ganti BK-000002 Rp0. Isi biaya ganti bila buku ini memang harus diganti.',
    ]);
  });

  it('menahan penyimpanan bila biaya ganti bukan angka atau tidak ada buku yang dicentang', () => {
    const invalid = initialRows(items);
    invalid.i1 = { ...invalid.i1, condition: 'RUSAK', replacementFee: 'mahal' };
    expect(previewReturn(items, invalid, context).problems).toEqual([
      'Isi biaya ganti BK-000001 dengan angka, misalnya 50.000.',
    ]);

    const none = { i1: { ...invalid.i1, selected: false }, i2: { ...invalid.i2, selected: false } };
    expect(previewReturn(items, none, context).problems).toEqual(['Centang minimal satu buku yang dikembalikan.']);
  });
});

describe('toReturnInput', () => {
  it('mengirim hanya buku yang dicentang, dengan biaya ganti hanya untuk yang rusak atau hilang', () => {
    const rows = initialRows(items);
    rows.i1 = { ...rows.i1, condition: 'RUSAK', replacementFee: '60.000', note: ' sampul sobek ' };
    rows.i2 = { ...rows.i2, selected: false };

    expect(toReturnInput('l1', items, rows)).toEqual({
      loanId: 'l1',
      items: [{ loanItemId: 'i1', condition: 'RUSAK', replacementFee: 60000, note: 'sampul sobek' }],
    });
  });

  it('mengirim biaya ganti null untuk buku dalam kondisi baik', () => {
    expect(toReturnInput('l1', [items[0]], initialRows([items[0]])).items[0])
      .toEqual({ loanItemId: 'i1', condition: 'BAIK', replacementFee: null, note: null });
  });
});
