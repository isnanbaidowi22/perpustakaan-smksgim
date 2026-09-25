import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { finePaymentSchema } from './fine';

function messagesOf(result: z.ZodSafeParseResult<unknown>): string[] {
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe('finePaymentSchema', () => {
  it('menerima nominal bertitik ribuan dan catatan kosong sebagai null', () => {
    expect(finePaymentSchema.parse({ amount: '4.000', note: '' })).toEqual({ amount: 4000, note: null });
  });

  it('mewajibkan nominal dan menolak nol', () => {
    expect(messagesOf(finePaymentSchema.safeParse({ amount: '', note: '' }))).toEqual(['Nominal pembayaran wajib diisi.']);
    expect(messagesOf(finePaymentSchema.safeParse({ amount: '0', note: '' }))).toEqual(['Nominal pembayaran minimal Rp1.']);
  });

  it('menolak nominal yang bukan angka', () => {
    expect(messagesOf(finePaymentSchema.safeParse({ amount: 'empat ribu', note: '' })))
      .toEqual(['Nominal pembayaran harus berupa angka rupiah, misalnya 5.000.']);
  });
});
