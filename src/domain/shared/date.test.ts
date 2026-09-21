import { describe, expect, it } from 'vitest';
import { addDays, diffDays } from './date';

describe('addDays', () => {
  it('menambah hari dalam bulan yang sama', () => {
    expect(addDays('2026-09-21', 3)).toBe('2026-09-24');
  });

  it('melintasi batas bulan', () => {
    expect(addDays('2026-09-29', 3)).toBe('2026-10-02');
  });

  it('melintasi batas tahun', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  });

  it('menangani tahun kabisat', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('menolak tanggal yang tidak berformat YYYY-MM-DD', () => {
    expect(() => addDays('21/09/2026', 1)).toThrow('Tanggal tidak valid');
  });

  it('menolak tanggal yang formatnya benar tetapi tidak ada dalam kalender', () => {
    expect(() => addDays('2026-02-31', 1)).toThrow('bukan tanggal yang ada dalam kalender');
  });
});

describe('diffDays', () => {
  it('mengembalikan nol untuk tanggal yang sama', () => {
    expect(diffDays('2026-09-21', '2026-09-21')).toBe(0);
  });

  it('mengembalikan selisih positif bila tujuan lebih akhir', () => {
    expect(diffDays('2026-09-21', '2026-09-25')).toBe(4);
  });

  it('mengembalikan selisih negatif bila tujuan lebih awal', () => {
    expect(diffDays('2026-09-25', '2026-09-21')).toBe(-4);
  });

  it('tidak terpengaruh zona waktu WIB', () => {
    // Bila implementasi memakai waktu lokal, selisih ini akan menjadi 0 atau 2.
    expect(diffDays('2026-09-21', '2026-09-22')).toBe(1);
  });
});
