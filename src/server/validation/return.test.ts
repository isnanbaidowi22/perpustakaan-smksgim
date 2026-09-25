import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { returnSchema } from './return';

const loanId = '6f1c2b1e-4b1a-4c3e-9f7a-2d1e3c4b5a6f';
const loanItemId = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

function messagesOf(result: z.ZodSafeParseResult<unknown>): string[] {
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe('returnSchema', () => {
  it('menerima item dengan biaya ganti dan catatan yang dirapikan', () => {
    expect(returnSchema.parse({
      loanId,
      items: [{ loanItemId, condition: 'RUSAK', replacementFee: 30000, note: '  sampul sobek ' }],
    })).toEqual({
      loanId,
      items: [{ loanItemId, condition: 'RUSAK', replacementFee: 30000, note: 'sampul sobek' }],
    });
  });

  it('menyimpan catatan kosong sebagai null', () => {
    const parsed = returnSchema.parse({ loanId, items: [{ loanItemId, condition: 'BAIK', replacementFee: null, note: '  ' }] });
    expect(parsed.items[0].note).toBeNull();
  });

  it('meminta minimal satu buku', () => {
    expect(messagesOf(returnSchema.safeParse({ loanId, items: [] })))
      .toEqual(['Centang minimal satu buku yang dikembalikan.']);
  });

  it('menolak kondisi dan biaya ganti yang tidak sah', () => {
    expect(messagesOf(returnSchema.safeParse({
      loanId, items: [{ loanItemId, condition: 'LECEK', replacementFee: -1, note: null }],
    }))).toEqual([
      'Kondisi harus Baik, Rusak, atau Hilang.',
      'Biaya ganti harus nominal rupiah bulat, misalnya 50000.',
    ]);
  });

  it('menolak biaya ganti di atas Rp99.999.999 agar total denda muat di kolomnya', () => {
    const tooHigh = returnSchema.safeParse({
      loanId,
      items: [{ loanItemId, condition: 'HILANG', replacementFee: 100_000_000, note: null }],
    });
    expect(messagesOf(tooHigh)).toEqual(['Biaya ganti maksimal Rp99.999.999 per buku. Periksa nominalnya.']);

    const atCap = returnSchema.safeParse({
      loanId,
      items: [{ loanItemId, condition: 'HILANG', replacementFee: 99_999_999, note: null }],
    });
    expect(atCap.success).toBe(true);
  });
});
