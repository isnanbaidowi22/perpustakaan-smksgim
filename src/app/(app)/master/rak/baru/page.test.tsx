import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@/server/actions/racks', () => ({ createRackAction: vi.fn() }));

import NewRackPage from './page';

describe('NewRackPage', () => {
  it('menampilkan kolom kode, nama, dan lokasi', () => {
    const html = renderToStaticMarkup(<NewRackPage />);
    for (const name of ['code', 'name', 'location']) {
      expect(html).toContain(`name="${name}"`);
    }
    expect(html).toContain('href="/master/rak"');
  });
});
