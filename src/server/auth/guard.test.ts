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

import { requireActor, requireProfile } from './guard';

describe('requireProfile', () => {
  it('mengarahkan ke /login ketika tidak ada profil yang masuk', async () => {
    mockGetCurrentProfile.mockResolvedValueOnce(null);
    await expect(requireProfile()).rejects.toThrow('NEXT_REDIRECT');
    expect(mockRedirect).toHaveBeenCalledWith('/login');
  });
});

describe('requireActor', () => {
  it('mengembalikan pelaku dari profil yang masuk', async () => {
    mockGetCurrentProfile.mockResolvedValueOnce({ id: 'u1', role: 'admin', status: 'active' });
    await expect(requireActor()).resolves.toEqual({ id: 'u1', role: 'admin' });
  });

  it('mengarahkan ke /login ketika tidak ada profil yang masuk', async () => {
    mockGetCurrentProfile.mockResolvedValueOnce(null);
    await expect(requireActor()).rejects.toThrow('NEXT_REDIRECT');
    expect(mockRedirect).toHaveBeenCalledWith('/login');
  });
});
