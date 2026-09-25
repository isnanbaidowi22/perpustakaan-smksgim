import { describe, expect, it } from 'vitest';
import { formatSchoolDateTime, schoolToday } from './school-date';

describe('schoolToday', () => {
  it('sudah berganti hari pukul 00.30 WIB walau di UTC masih kemarin', () => {
    expect(schoolToday(new Date('2026-09-24T17:30:00Z'))).toBe('2026-09-25');
  });

  it('masih hari yang sama pukul 23.59 WIB', () => {
    expect(schoolToday(new Date('2026-09-24T16:59:00Z'))).toBe('2026-09-24');
  });
});

describe('formatSchoolDateTime', () => {
  it('menampilkan tanggal dan jam WIB', () => {
    expect(formatSchoolDateTime(new Date('2026-09-25T07:03:00Z'))).toBe('25/09/2026 14.03');
  });

  it('menampilkan tengah malam sebagai 00', () => {
    expect(formatSchoolDateTime(new Date('2026-09-24T17:00:00Z'))).toBe('25/09/2026 00.00');
  });
});
