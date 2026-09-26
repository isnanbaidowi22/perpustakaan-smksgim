import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockList, mockRequireProfile } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockRequireProfile: vi.fn(),
}));

vi.mock('@/server/queries/users', () => ({ listUsers: mockList }));
vi.mock('@/server/actions/users', () => ({ setUserStatusAction: vi.fn() }));
vi.mock('@/server/auth/guard', () => ({ requireProfile: mockRequireProfile }));

import UsersPage from './page';

async function render(params: Record<string, string> = {}) {
  return renderToStaticMarkup(await UsersPage({ searchParams: Promise.resolve(params) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireProfile.mockResolvedValue({ id: 'u1', role: 'admin', fullName: 'Administrator', status: 'active' });
});

describe('UsersPage', () => {
  it('tidak menampilkan kolom peran dan tidak menawarkan menonaktifkan akun sendiri', async () => {
    mockList.mockResolvedValueOnce([
      { id: 'u1', username: 'admin', fullName: 'Administrator', status: 'active' },
      { id: 'u2', username: 'petugas', fullName: 'Petugas Perpustakaan', status: 'active' },
      { id: 'u3', username: 'lama', fullName: 'Petugas Lama', status: 'inactive' },
    ]);

    const html = await render({ pesan: 'Pengguna berhasil dibuat.' });

    expect(html).toContain('Akun Anda');
    expect(html.split('Nonaktifkan').length - 1).toBe(1);
    expect(html).toContain('Aktifkan');
    expect(html).toContain('Petugas Perpustakaan');
    expect(html).toContain('href="/pengaturan/pengguna/u2"');
    expect(html).toContain('Pengguna berhasil dibuat.');
    expect(html).not.toContain('>Peran<');
  });

  it('memeriksa sesi lebih dulu sebelum membaca daftar pengguna', async () => {
    mockRequireProfile.mockRejectedValueOnce(new Error('NEXT_REDIRECT'));

    await expect(render()).rejects.toThrow('NEXT_REDIRECT');

    expect(mockList).not.toHaveBeenCalled();
  });
});
