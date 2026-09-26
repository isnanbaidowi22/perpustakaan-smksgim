import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockRequireProfile } = vi.hoisted(() => ({ mockRequireProfile: vi.fn() }));

vi.mock('@/server/actions/users', () => ({ createUserAction: vi.fn() }));
vi.mock('@/server/auth/guard', () => ({ requireProfile: mockRequireProfile }));

import NewUserPage from './page';

beforeEach(() => {
  mockRequireProfile.mockResolvedValue({ id: 'u1', role: 'admin', fullName: 'Administrator', status: 'active' });
});

describe('NewUserPage', () => {
  it('menampilkan kolom akun baru tanpa pilihan peran', async () => {
    const html = renderToStaticMarkup(await NewUserPage());

    for (const name of ['username', 'fullName', 'password', 'passwordConfirm']) {
      expect(html).toContain(`name="${name}"`);
    }
    expect(html.split('type="password"').length - 1).toBe(2);
    expect(html).not.toContain('name="role"');
  });

  it('menampilkan Akses ditolak untuk petugas', async () => {
    mockRequireProfile.mockResolvedValueOnce({ id: 'u2', role: 'petugas', fullName: 'Petugas', status: 'active' });
    expect(renderToStaticMarkup(await NewUserPage())).toContain('Akses ditolak');
  });
});
