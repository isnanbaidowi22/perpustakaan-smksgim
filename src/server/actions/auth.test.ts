import { describe, expect, it, vi } from 'vitest';

const { mockSignInWithPassword, mockSignOut, mockRedirect } = vi.hoisted(() => ({
  mockSignInWithPassword: vi.fn(),
  mockSignOut: vi.fn(),
  mockRedirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

vi.mock('@/server/auth/session', () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { signInWithPassword: mockSignInWithPassword, signOut: mockSignOut },
  })),
}));
vi.mock('next/navigation', () => ({ redirect: mockRedirect }));

import { signIn, signOut } from './auth';

function buildFormData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

describe('signIn', () => {
  it('mengembalikan galat validasi username tanpa memanggil Supabase', async () => {
    const result = await signIn(null, buildFormData({ username: 'budi santoso', password: 'x' }));
    expect(result?.error).toMatch('Username hanya boleh');
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });

  it('mengembalikan pesan generik ketika kredensial ditolak, tanpa membedakan sebabnya', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({ error: { message: 'Invalid login credentials' } });
    const result = await signIn(null, buildFormData({ username: 'budi', password: 'salah' }));
    expect(result?.error).toBe('Username atau kata sandi salah.');
  });

  it('mengarahkan ke /dashboard ketika kredensial benar', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({ error: null });
    await expect(
      signIn(null, buildFormData({ username: 'budi', password: 'benar' })),
    ).rejects.toThrow('NEXT_REDIRECT');
    expect(mockRedirect).toHaveBeenCalledWith('/dashboard');
  });
});

describe('signOut', () => {
  it('memanggil signOut Supabase lalu mengarahkan ke /login', async () => {
    await expect(signOut()).rejects.toThrow('NEXT_REDIRECT');
    expect(mockSignOut).toHaveBeenCalled();
    expect(mockRedirect).toHaveBeenCalledWith('/login');
  });
});
