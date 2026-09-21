import { describe, expect, it } from 'vitest';
import { statusLabel, statusIcon } from './status-badge';

describe('statusLabel', () => {
  it('menerjemahkan status eksemplar ke bahasa Indonesia yang terbaca', () => {
    expect(statusLabel('TERSEDIA')).toBe('Tersedia');
    expect(statusLabel('DIPINJAM')).toBe('Dipinjam');
    expect(statusLabel('NONAKTIF')).toBe('Nonaktif');
  });
});

describe('statusIcon', () => {
  it('memberi ikon berbeda untuk tiap status', () => {
    const icons = (['TERSEDIA', 'DIPINJAM', 'RUSAK', 'HILANG', 'NONAKTIF'] as const)
      .map(statusIcon);
    expect(new Set(icons).size).toBe(5);
  });
});
