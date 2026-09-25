import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@/server/actions/categories', () => ({ createCategoryAction: vi.fn() }));

import NewCategoryPage from './page';

describe('NewCategoryPage', () => {
  it('menampilkan kolom nama kategori dan tautan batal ke daftar', () => {
    const html = renderToStaticMarkup(<NewCategoryPage />);
    expect(html).toContain('name="name"');
    expect(html).toContain('Simpan Kategori');
    expect(html).toContain('href="/master/kategori"');
  });
});
