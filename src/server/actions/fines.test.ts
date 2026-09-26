import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDLE } from '@/lib/form-state';

const { mockRunFormAction, mockPayFine } = vi.hoisted(() => ({
  mockRunFormAction: vi.fn(),
  mockPayFine: vi.fn(),
}));

vi.mock('@/server/forms/run-action', () => ({ runFormAction: mockRunFormAction }));
vi.mock('@/server/services/fines', () => ({ payFine: mockPayFine }));

import { payFineAction } from './fines';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('payFineAction', () => {
  it('kembali ke detail transaksi agar pesannya tetap terlihat', async () => {
    await payFineAction('loan-1', IDLE, new FormData());

    const options = mockRunFormAction.mock.calls[0]?.[0];
    // Form pelunasan hilang setelah lunas; pesan sukses dibawa lewat ?pesan=.
    expect(options.redirectTo).toBe('/transaksi/riwayat/loan-1');
    expect(options.revalidate).toEqual(['/transaksi/riwayat', '/transaksi/riwayat/loan-1']);

    const actor = { id: 'u1', role: 'admin' as const };
    await options.execute({ amount: 4000, note: null }, actor);
    expect(mockPayFine).toHaveBeenCalledWith('loan-1', { amount: 4000, note: null }, actor);
  });
});
