import { describe, expect, it } from 'vitest';
import { studentSchema } from './student';

const valid = {
  name: 'Ahmad Fauzi',
  className: 'XI RPL 1',
  major: 'RPL',
  gender: 'L',
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
    const parsed = studentSchema.parse({ name: 'Siti', className: 'X TKJ 2' });
    expect(parsed).toEqual({ name: 'Siti', className: 'X TKJ 2', major: null, gender: null, academicYearId: null });
  });

  it('tidak lagi menyimpan NIS dan nomor telepon walaupun dikirim', () => {
    expect(studentSchema.parse({ ...valid, nis: '202600123', phone: '0812' })).not.toHaveProperty('nis');
    expect(studentSchema.parse({ ...valid, nis: '202600123', phone: '0812' })).not.toHaveProperty('phone');
  });

  it('menolak jenis kelamin selain L dan P', () => {
    expect(messages({ ...valid, gender: 'X' })).toEqual(['Jenis kelamin harus L atau P.']);
  });
});
