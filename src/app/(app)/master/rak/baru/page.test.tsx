import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@/server/actions/racks', () => ({ createRackAction: vi.fn() }));
vi.mock('@/server/auth/guard', () => ({
  requireProfile: vi.fn(async () => ({ id: 'u1', role: 'petugas', fullName: 'Petugas', status: 'active' })),
}));

import NewRackPage from './page';

describe('NewRackPage', () => {
  it('menampilkan kolom kode, nama, dan lokasi', async () => {
    const html = renderToStaticMarkup(await NewRackPage());
    for (const name of ['code', 'name', 'location']) {
      expect(html).toContain(`name="${name}"`);
    }
    expect(html).toContain('href="/master/rak"');
  });
});
