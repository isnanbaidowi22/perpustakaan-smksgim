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

  it('memeriksa sesi lebih dulu sebelum menampilkan formulir', async () => {
    mockRequireProfile.mockRejectedValueOnce(new Error('NEXT_REDIRECT'));

    await expect(NewUserPage()).rejects.toThrow('NEXT_REDIRECT');
  });
});
