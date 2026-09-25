import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formError } from '@/lib/form-state';

const { mockAuthorize, mockProcessReturn, mockRevalidatePath, mockRedirect } = vi.hoisted(() => ({
  mockAuthorize: vi.fn(),
  mockProcessReturn: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockRedirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

vi.mock('@/server/auth/guard', () => ({ authorize: mockAuthorize }));
vi.mock('@/server/services/returns', () => ({ processReturn: mockProcessReturn }));
vi.mock('@/lib/school-date', () => ({ schoolToday: () => '2090-03-09' }));
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }));
vi.mock('next/navigation', () => ({ redirect: mockRedirect }));

import { processReturnAction } from './returns';

const actor = { id: 'u1', role: 'petugas' as const };
const loanId = '6f1c2b1e-4b1a-4c3e-9f7a-2d1e3c4b5a6f';
const loanItemId = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const input = { loanId, items: [{ loanItemId, condition: 'BAIK', replacementFee: null, note: null }] };

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthorize.mockResolvedValue({ ok: true, actor });
});

describe('processReturnAction', () => {
  it('menolak sebelum membaca isian bila peran tidak diizinkan', async () => {
    mockAuthorize.mockResolvedValueOnce({ ok: false, message: 'Akses ditolak.' });
    expect(await processReturnAction(input)).toEqual(formError('Akses ditolak.'));
    expect(mockAuthorize).toHaveBeenCalledWith(['admin', 'petugas']);
    expect(mockProcessReturn).not.toHaveBeenCalled();
  });

  it('menampilkan galat validasi pertama', async () => {
    expect(await processReturnAction({ loanId, items: [] }))
      .toEqual(formError('Centang minimal satu buku yang dikembalikan.'));
  });

  it('meneruskan penolakan service', async () => {
    mockProcessReturn.mockResolvedValueOnce({ ok: false, message: 'Transaksi tidak ditemukan.' });
    expect(await processReturnAction(input)).toEqual(formError('Transaksi tidak ditemukan.'));
  });

  it('menyimpan dengan tanggal sekolah lalu pindah ke detail transaksi dengan total denda', async () => {
    mockProcessReturn.mockResolvedValueOnce({ ok: true, id: loanId, notice: 'Total denda transaksi ini Rp4.000.' });

    await expect(processReturnAction(input)).rejects.toThrow('NEXT_REDIRECT');

    expect(mockProcessReturn).toHaveBeenCalledWith(input, actor, '2090-03-09');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/transaksi/riwayat');
    expect(mockRedirect).toHaveBeenCalledWith(
      `/transaksi/riwayat/${loanId}?pesan=${encodeURIComponent('Pengembalian tersimpan. Total denda transaksi ini Rp4.000.')}`,
    );
  });
});
