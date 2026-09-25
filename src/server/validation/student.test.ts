import { describe, expect, it } from 'vitest';
import { studentSchema } from './student';

const valid = {
  nis: '202600123',
  name: 'Ahmad Fauzi',
  className: 'XI RPL 1',
  major: 'RPL',
  gender: 'L',
  phone: '0812-3456-7890',
  academicYearId: '',
};

function messages(input: Record<string, string>) {
  const result = studentSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe('studentSchema', () => {
  it('menerima data siswa lengkap dan mengubah pilihan kosong menjadi null', () => {
    expect(studentSchema.parse(valid)).toEqual({ ...valid, academicYearId: null });
  });

  it('menyimpan kolom opsional yang kosong sebagai null', () => {
    const parsed = studentSchema.parse({ nis: '202600124', name: 'Siti', className: 'X TKJ 2' });
    expect(parsed).toEqual({
      nis: '202600124', name: 'Siti', className: 'X TKJ 2',
      major: null, gender: null, phone: null, academicYearId: null,
    });
  });

  it('menolak NIS berisi spasi', () => {
    expect(messages({ ...valid, nis: '2026 00123' })).toEqual([
      'NIS hanya boleh berisi angka, huruf, titik, dan tanda hubung.',
    ]);
  });

  it('menolak jenis kelamin selain L dan P', () => {
    expect(messages({ ...valid, gender: 'X' })).toEqual(['Jenis kelamin harus L atau P.']);
  });

  it('menolak nomor telepon berisi huruf', () => {
    expect(messages({ ...valid, phone: 'nol delapan' })).toEqual([
      'Nomor telepon hanya boleh berisi angka, spasi, +, dan tanda hubung.',
    ]);
  });
});
