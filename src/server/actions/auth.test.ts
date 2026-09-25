import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSignInWithPassword, mockSignOut, mockRedirect, mockGetUser } = vi.hoisted(() => ({
  mockSignInWithPassword: vi.fn(),
  mockSignOut: vi.fn(),
  mockRedirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
  mockGetUser: vi.fn(),
}));

vi.mock('@/server/auth/session', () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { signInWithPassword: mockSignInWithPassword, signOut: mockSignOut },
  })),
}));
vi.mock('@/server/queries/users', () => ({ getUser: mockGetUser }));
vi.mock('next/navigation', () => ({ redirect: mockRedirect }));

import { signIn, signOut } from './auth';

function buildFormData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('signIn', () => {
  it('mengembalikan galat validasi username tanpa memanggil Supabase', async () => {
    const result = await signIn(null, buildFormData({ username: 'budi santoso', password: 'x' }));
    expect(result?.error).toMatch('Username hanya boleh');
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });

  it('mengembalikan pesan generik ketika kredensial ditolak, tanpa membedakan sebabnya', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Invalid login credentials' } });
    const result = await signIn(null, buildFormData({ username: 'budi', password: 'salah' }));
    expect(result?.error).toBe('Username atau kata sandi salah.');
  });

  it('mengarahkan ke /dashboard ketika kredensial benar dan akunnya aktif', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null });
    mockGetUser.mockResolvedValueOnce({ id: 'u1', status: 'active' });
    await expect(
      signIn(null, buildFormData({ username: 'budi', password: 'benar' })),
    ).rejects.toThrow('NEXT_REDIRECT');
    expect(mockRedirect).toHaveBeenCalledWith('/dashboard');
  });

  it('menjelaskan bahwa akun dinonaktifkan dan tidak meninggalkan sesi', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null });
    mockGetUser.mockResolvedValueOnce({ id: 'u1', status: 'inactive' });

    const result = await signIn(null, buildFormData({ username: 'budi', password: 'benar' }));

    expect(result?.error).toBe('Akun ini dinonaktifkan. Hubungi admin perpustakaan untuk mengaktifkannya kembali.');
    expect(mockSignOut).toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('menjelaskan akun autentikasi yang belum memiliki profil', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null });
    mockGetUser.mockResolvedValueOnce(null);

    const result = await signIn(null, buildFormData({ username: 'budi', password: 'benar' }));

    expect(result?.error).toBe('Akun ini belum terdaftar sebagai pengguna perpustakaan. Hubungi admin perpustakaan.');
    expect(mockSignOut).toHaveBeenCalled();
  });
});

describe('signOut', () => {
  it('memanggil signOut Supabase lalu mengarahkan ke /login', async () => {
    await expect(signOut()).rejects.toThrow('NEXT_REDIRECT');
    expect(mockSignOut).toHaveBeenCalled();
    expect(mockRedirect).toHaveBeenCalledWith('/login');
  });
});
