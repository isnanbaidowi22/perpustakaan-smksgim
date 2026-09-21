import { describe, expect, it } from 'vitest';
import { calculateDueDate } from './due-date';

describe('calculateDueDate', () => {
  it('menambahkan durasi pinjam ke tanggal pinjam', () => {
    expect(calculateDueDate('2026-09-21', 3)).toBe('2026-09-24');
  });

  it('menghormati durasi yang dikonfigurasi, bukan nilai tetap', () => {
    expect(calculateDueDate('2026-09-21', 7)).toBe('2026-09-28');
  });

  it('menolak durasi nol', () => {
    expect(() => calculateDueDate('2026-09-21', 0)).toThrow('minimal 1 hari');
  });

  it('menolak durasi negatif', () => {
    expect(() => calculateDueDate('2026-09-21', -1)).toThrow('minimal 1 hari');
  });
});
