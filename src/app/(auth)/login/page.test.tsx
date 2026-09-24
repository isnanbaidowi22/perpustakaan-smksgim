import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@/server/actions/auth', () => ({
  signIn: vi.fn(),
}));

import LoginPage from './page';

describe('LoginPage', () => {
  it('menampilkan input username dan kata sandi', () => {
    const html = renderToStaticMarkup(<LoginPage />);
    expect(html).toContain('name="username"');
    expect(html).toContain('name="password"');
  });
});
