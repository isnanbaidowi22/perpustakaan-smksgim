import { describe, expect, it } from 'vitest';
import { parseIsoDate } from './iso-date';

describe('parseIsoDate', () => {
  it('menerima tanggal kalender yang sah saja', () => {
    expect(parseIsoDate('2026-09-25')).toBe('2026-09-25');
    expect(parseIsoDate('2028-02-29')).toBe('2028-02-29');
    expect(parseIsoDate('2026-02-30')).toBeNull();
    expect(parseIsoDate('25/09/2026')).toBeNull();
    expect(parseIsoDate('')).toBeNull();
  });

  it('menolak tahun di bawah 1000: input berpola benar tapi bukan tahun kalender wajar', () => {
    expect(parseIsoDate('0026-09-01')).toBeNull();
    expect(parseIsoDate('0000-01-01')).toBeNull();
    expect(parseIsoDate('0999-12-31')).toBeNull();
    expect(parseIsoDate('1000-01-01')).toBe('1000-01-01');
  });
});
