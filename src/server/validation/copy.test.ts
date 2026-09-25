import { describe, expect, it } from 'vitest';
import { addCopiesSchema } from './copy';

function messages(input: Record<string, string>) {
  const result = addCopiesSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => [String(issue.path[0]), issue.message]);
}

describe('addCopiesSchema', () => {
  it('bawaannya satu eksemplar dengan barcode otomatis', () => {
    expect(addCopiesSchema.parse({})).toEqual({ count: 1, barcode: null, acquisitionDate: null, notes: null });
  });

  it('menerima jumlah dan tanggal pengadaan', () => {
    expect(addCopiesSchema.parse({ count: '3', acquisitionDate: '2026-07-15' })).toMatchObject({
      count: 3,
      acquisitionDate: '2026-07-15',
    });
  });

  it('menormalkan barcode manual ke huruf besar', () => {
    expect(addCopiesSchema.parse({ barcode: ' lama-0001 ' }).barcode).toBe('LAMA-0001');
  });

  it('menolak jumlah di luar 1 sampai 50', () => {
    expect(messages({ count: '51' })).toEqual([['count', 'Jumlah eksemplar harus antara 1 dan 50.']]);
  });

  it('menolak barcode manual berawalan BK-', () => {
    expect(messages({ barcode: 'BK-000500' })).toEqual([[
      'barcode',
      'Awalan BK- dicadangkan untuk barcode otomatis. Kosongkan kolom ini agar sistem membuatkannya.',
    ]]);
  });

  it('menolak barcode manual untuk lebih dari satu eksemplar', () => {
    expect(messages({ count: '2', barcode: 'LAMA-0001' })).toEqual([[
      'barcode',
      'Barcode manual hanya untuk satu eksemplar. Ubah jumlah menjadi 1 atau kosongkan barcode.',
    ]]);
  });
});
