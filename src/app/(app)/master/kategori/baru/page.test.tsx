import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@/server/actions/categories', () => ({ createCategoryAction: vi.fn() }));
vi.mock('@/server/auth/guard', () => ({
  requireProfile: vi.fn(async () => ({ id: 'u1', role: 'petugas', fullName: 'Petugas', status: 'active' })),
}));

import NewCategoryPage from './page';

describe('NewCategoryPage', () => {
  it('menampilkan kolom nama kategori dan tautan batal ke daftar', async () => {
    const html = renderToStaticMarkup(await NewCategoryPage());
    expect(html).toContain('name="name"');
    expect(html).toContain('Simpan Kategori');
    expect(html).toContain('href="/master/kategori"');
  });
});
