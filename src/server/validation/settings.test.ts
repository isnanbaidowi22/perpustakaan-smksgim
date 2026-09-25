import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { settingsSchema } from './settings';

const valid = {
  maxActiveLoans: '3',
  loanDurationDays: '3',
  finePerDay: '1.000',
  blockWhenOverdue: 'on',
  blockWhenUnpaidFine: 'off',
  schoolName: ' SMK Negeri 1 Contoh ',
  receiptFooter: '',
};

function messagesOf(result: z.ZodSafeParseResult<unknown>): string[] {
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe('settingsSchema', () => {
  it('mengubah isian form menjadi konfigurasi bertipe', () => {
    expect(settingsSchema.parse(valid)).toEqual({
      maxActiveLoans: 3,
      loanDurationDays: 3,
      finePerDay: 1000,
      blockWhenOverdue: true,
      blockWhenUnpaidFine: false,
      schoolName: 'SMK Negeri 1 Contoh',
      receiptFooter: null,
    });
  });

  it('menerima denda nol, tetapi tidak menerima denda kosong', () => {
    expect(settingsSchema.parse({ ...valid, finePerDay: '0' }).finePerDay).toBe(0);
    expect(messagesOf(settingsSchema.safeParse({ ...valid, finePerDay: '' }))).toEqual([
      'Denda per hari wajib diisi. Tulis 0 bila tidak ada denda.',
    ]);
  });

  it('menolak denda di atas satu juta dan batas di luar rentang', () => {
    expect(messagesOf(settingsSchema.safeParse({
      ...valid, finePerDay: '2.000.000', maxActiveLoans: '0', loanDurationDays: '91',
    }))).toEqual([
      'Batas pinjam harus bilangan bulat 1 sampai 20.',
      'Durasi pinjam harus bilangan bulat 1 sampai 90 hari.',
      'Denda per hari harus nominal rupiah 0 sampai 1.000.000.',
    ]);
  });

  it('mewajibkan nama sekolah karena dicetak di struk', () => {
    expect(messagesOf(settingsSchema.safeParse({ ...valid, schoolName: ' ' }))).toEqual([
      'Nama sekolah wajib diisi; dicetak di struk peminjaman.',
    ]);
  });
});
