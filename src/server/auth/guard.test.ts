import { describe, expect, it, vi } from 'vitest';

const { mockGetCurrentProfile, mockRedirect } = vi.hoisted(() => ({
  mockGetCurrentProfile: vi.fn(),
  mockRedirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

vi.mock('@/server/auth/session', () => ({
  getCurrentProfile: mockGetCurrentProfile,
}));
vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}));

import { requireProfile, requireRole } from './guard';

describe('requireProfile', () => {
  it('mengarahkan ke /login ketika tidak ada profil yang masuk', async () => {
    mockGetCurrentProfile.mockResolvedValueOnce(null);
    await expect(requireProfile()).rejects.toThrow('NEXT_REDIRECT');
    expect(mockRedirect).toHaveBeenCalledWith('/login');
  });
});

describe('requireRole', () => {
  it('melempar galat ketika peran akun tidak termasuk yang diizinkan', async () => {
    mockGetCurrentProfile.mockResolvedValueOnce({ id: '1', role: 'petugas' });
    await expect(requireRole(['admin'])).rejects.toThrow('Akses ditolak');
  });
});
