import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockGet, mockRequireProfile, mockNotFound } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockRequireProfile: vi.fn(),
  mockNotFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('@/server/queries/users', () => ({ getUser: mockGet }));
vi.mock('@/server/actions/users', () => ({ updateUserAction: vi.fn(), resetUserPasswordAction: vi.fn() }));
vi.mock('@/server/auth/guard', () => ({ requireProfile: mockRequireProfile }));
vi.mock('next/navigation', () => ({ notFound: mockNotFound }));

import EditUserPage from './page';

function render(id: string) {
  return EditUserPage({ params: Promise.resolve({ id }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireProfile.mockResolvedValue({ id: 'u1', role: 'admin', fullName: 'Administrator', status: 'active' });
});

describe('EditUserPage', () => {
  it('mengisi nama dan peran, dan menyediakan form kata sandi terpisah yang kosong', async () => {
    mockGet.mockResolvedValueOnce({
      id: 'u2', username: 'petugas', fullName: 'Petugas Perpustakaan', role: 'petugas', status: 'active',
    });

    const html = renderToStaticMarkup(await render('u2'));

    expect(html).toContain('value="Petugas Perpustakaan"');
    expect(html).toMatch(/<option value="petugas" selected="">Petugas<\/option>/);
    expect(html).toContain('Atur Ulang Kata Sandi');
    expect(html).toContain('Ganti Kata Sandi');
    expect(html).not.toContain('name="username"');
    expect(html).not.toContain('Peran akun Anda sendiri tidak dapat diubah');
  });

  it('memberi tahu admin bahwa perannya sendiri tidak dapat diubah', async () => {
    mockGet.mockResolvedValueOnce({
      id: 'u1', username: 'admin', fullName: 'Administrator', role: 'admin', status: 'active',
    });

    expect(renderToStaticMarkup(await render('u1'))).toContain('Peran akun Anda sendiri tidak dapat diubah');
  });

  it('menampilkan halaman tidak ditemukan untuk id yang tidak ada', async () => {
    mockGet.mockResolvedValueOnce(null);
    await expect(render('x')).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('menampilkan Akses ditolak untuk petugas tanpa membaca data', async () => {
    mockRequireProfile.mockResolvedValueOnce({ id: 'u2', role: 'petugas', fullName: 'Petugas', status: 'active' });

    expect(renderToStaticMarkup(await render('u1'))).toContain('Akses ditolak');
    expect(mockGet).not.toHaveBeenCalled();
  });
});
