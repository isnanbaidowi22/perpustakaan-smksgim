import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { createLoanSchema } from './loan';

const studentId = '6f1c2b1e-4b1a-4c3e-9f7a-2d1e3c4b5a6f';
const copyId = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

function messagesOf(result: z.ZodSafeParseResult<unknown>): string[] {
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe('createLoanSchema', () => {
  it('menerima siswa, daftar eksemplar, dan catatan kosong sebagai null', () => {
    expect(createLoanSchema.parse({ studentId, copyIds: [copyId], notes: '  ' })).toEqual({
      studentId, copyIds: [copyId], notes: null,
    });
  });

  it('membiarkan daftar eksemplar kosong agar domain menolaknya dengan NO_COPY_SELECTED', () => {
    expect(createLoanSchema.parse({ studentId, copyIds: [], notes: '' }).copyIds).toEqual([]);
  });

  it('meminta siswa dipilih lebih dulu', () => {
    expect(messagesOf(createLoanSchema.safeParse({ copyIds: [copyId], notes: '' })))
      .toEqual(['Pilih siswa terlebih dahulu.']);
  });

  it('menolak eksemplar yang bukan UUID dan daftar yang terlalu panjang', () => {
    expect(messagesOf(createLoanSchema.safeParse({ studentId, copyIds: ['BK-000123'], notes: '' })))
      .toEqual(['Eksemplar tidak valid. Pindai ulang barcodenya.']);
    expect(messagesOf(createLoanSchema.safeParse({ studentId, copyIds: Array(21).fill(copyId), notes: '' })))
      .toEqual(['Maksimal 20 eksemplar dalam satu transaksi.']);
  });
});
