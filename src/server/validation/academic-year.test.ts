import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { academicYearSchema, newAcademicYearSchema } from './academic-year';

const NAME_FORMAT = 'Nama tahun ajaran ditulis seperti 2026/2027: dua tahun berurutan.';
const valid = { name: '2026/2027', startDate: '2026-07-01', endDate: '2027-06-30' };

function messagesOf(result: z.ZodSafeParseResult<unknown>): string[] {
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe('academicYearSchema', () => {
  it('menerima tahun ajaran yang tanggalnya sesuai nama', () => {
    expect(academicYearSchema.parse({ ...valid, name: ' 2026/2027 ' })).toEqual(valid);
  });

  it('menolak nama yang bukan dua tahun berurutan, tanpa galat tanggal tambahan', () => {
    for (const name of ['2026/2028', '2026-2027', '26/27']) {
      expect(messagesOf(academicYearSchema.safeParse({ ...valid, name }))).toEqual([NAME_FORMAT]);
    }
  });

  it('menolak tanggal mulai di luar tahun pertama', () => {
    expect(messagesOf(academicYearSchema.safeParse({ ...valid, startDate: '2025-07-01' }))).toEqual([
      'Tanggal mulai harus jatuh pada tahun 2026, sesuai nama tahun ajaran.',
    ]);
  });

  it('menolak tanggal selesai di luar tahun kedua', () => {
    expect(messagesOf(academicYearSchema.safeParse({ ...valid, endDate: '2026-12-31' }))).toEqual([
      'Tanggal selesai harus jatuh pada tahun 2027, sesuai nama tahun ajaran.',
    ]);
  });

  it('mewajibkan kedua tanggal', () => {
    expect(messagesOf(academicYearSchema.safeParse({ ...valid, startDate: '', endDate: '' }))).toEqual([
      'Tanggal mulai wajib diisi dengan tanggal yang valid.',
      'Tanggal selesai wajib diisi dengan tanggal yang valid.',
    ]);
  });
});

describe('newAcademicYearSchema', () => {
  it('membaca kotak centang "jadikan aktif"', () => {
    expect(newAcademicYearSchema.parse({ ...valid, activate: 'on' })).toEqual({ ...valid, activate: true });
    expect(newAcademicYearSchema.parse(valid)).toEqual({ ...valid, activate: false });
  });
});
