import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@/server/actions/books', () => ({ createBookAction: vi.fn() }));
vi.mock('@/server/queries/categories', () => ({
  listCategoryOptions: vi.fn(async () => [{ value: 'c1', label: 'Teknologi Informasi' }]),
}));
vi.mock('@/server/queries/racks', () => ({
  listRackOptions: vi.fn(async () => [{ value: 'r1', label: 'A-3 — Rak A Baris 3' }]),
}));
vi.mock('@/server/auth/guard', () => ({
  requireProfile: vi.fn(async () => ({ id: 'u1', role: 'admin', fullName: 'Petugas', status: 'active' })),
}));

import NewBookPage from './page';

describe('NewBookPage', () => {
  it('menampilkan seluruh kolom buku beserta pilihan kategori dan rak', async () => {
    const html = renderToStaticMarkup(await NewBookPage());
    for (const name of ['isbn', 'title', 'author', 'publisher', 'publishYear', 'categoryId', 'rackId', 'price', 'description']) {
      expect(html).toContain(`name="${name}"`);
    }
    expect(html).toContain('Teknologi Informasi');
    expect(html).toContain('A-3 — Rak A Baris 3');
  });
});
