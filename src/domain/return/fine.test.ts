import { describe, expect, it } from 'vitest';
import { calculateItemFine } from './fine';

const base = {
  dueDate: '2026-09-24',
  finePerDay: 1000,
  bookPrice: 85_000,
} as const;

describe('calculateItemFine — keterlambatan', () => {
  it('tidak mendenda pengembalian tepat pada hari jatuh tempo', () => {
    const result = calculateItemFine({ ...base, returnDate: '2026-09-24', condition: 'BAIK' });
    expect(result).toEqual({ daysLate: 0, lateFine: 0, replacementFee: 0, total: 0 });
  });

  it('tidak mendenda pengembalian lebih awal', () => {
    const result = calculateItemFine({ ...base, returnDate: '2026-09-22', condition: 'BAIK' });
    expect(result.daysLate).toBe(0);
    expect(result.lateFine).toBe(0);
  });

  it('mendenda per hari keterlambatan', () => {
    const result = calculateItemFine({ ...base, returnDate: '2026-09-28', condition: 'BAIK' });
    expect(result.daysLate).toBe(4);
    expect(result.lateFine).toBe(4000);
    expect(result.total).toBe(4000);
  });

  it('memakai tarif dari konfigurasi, bukan nilai tetap', () => {
    const result = calculateItemFine({
      ...base, returnDate: '2026-09-26', condition: 'BAIK', finePerDay: 2500,
    });
    expect(result.lateFine).toBe(5000);
  });
});

describe('calculateItemFine — kondisi buku', () => {
  it('membebankan harga buku bila rusak', () => {
    const result = calculateItemFine({ ...base, returnDate: '2026-09-24', condition: 'RUSAK' });
    expect(result.replacementFee).toBe(85_000);
    expect(result.total).toBe(85_000);
  });

  it('membebankan harga buku bila hilang', () => {
    const result = calculateItemFine({ ...base, returnDate: '2026-09-24', condition: 'HILANG' });
    expect(result.replacementFee).toBe(85_000);
  });

  it('menumpuk denda telat dan biaya ganti bila buku rusak sekaligus terlambat', () => {
    const result = calculateItemFine({ ...base, returnDate: '2026-09-28', condition: 'RUSAK' });
    expect(result.lateFine).toBe(4000);
    expect(result.replacementFee).toBe(85_000);
    expect(result.total).toBe(89_000);
  });

  it('mengutamakan nominal yang ditimpa petugas atas harga katalog', () => {
    const result = calculateItemFine({
      ...base, returnDate: '2026-09-24', condition: 'HILANG', replacementFeeOverride: 120_000,
    });
    expect(result.replacementFee).toBe(120_000);
  });

  it('menghormati nominal timpaan nol', () => {
    const result = calculateItemFine({
      ...base, returnDate: '2026-09-24', condition: 'RUSAK', replacementFeeOverride: 0,
    });
    expect(result.replacementFee).toBe(0);
  });

  it('mengabaikan nominal timpaan bila kondisi buku baik', () => {
    const result = calculateItemFine({
      ...base, returnDate: '2026-09-24', condition: 'BAIK', replacementFeeOverride: 120_000,
    });
    expect(result.replacementFee).toBe(0);
  });
});
