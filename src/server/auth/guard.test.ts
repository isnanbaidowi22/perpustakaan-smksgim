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

import { authorize, requireProfile, requireRole } from './guard';

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

describe('authorize', () => {
  it('mengembalikan pelaku ketika perannya diizinkan', async () => {
    mockGetCurrentProfile.mockResolvedValueOnce({ id: 'u1', role: 'petugas', status: 'active' });
    await expect(authorize(['admin', 'petugas'])).resolves.toEqual({
      ok: true,
      actor: { id: 'u1', role: 'petugas' },
    });
  });

  it('mengembalikan pesan penolakan, bukan melempar galat, ketika peran tidak diizinkan', async () => {
    mockGetCurrentProfile.mockResolvedValueOnce({ id: 'u1', role: 'petugas', status: 'active' });
    await expect(authorize(['admin'])).resolves.toEqual({
      ok: false,
      message: 'Akses ditolak. Aksi ini hanya untuk peran: admin. Akun Anda berperan petugas.',
    });
  });
});
