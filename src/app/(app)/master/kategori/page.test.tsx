import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockListCategories } = vi.hoisted(() => ({ mockListCategories: vi.fn() }));

vi.mock('@/server/queries/categories', () => ({ listCategories: mockListCategories }));
vi.mock('@/server/actions/categories', () => ({ setCategoryStatusAction: vi.fn() }));
vi.mock('@/server/auth/guard', () => ({
  requireProfile: vi.fn(async () => ({ id: 'u1', role: 'petugas', fullName: 'Petugas', status: 'active' })),
}));

import CategoriesPage from './page';

async function render(params: Record<string, string> = {}) {
  return renderToStaticMarkup(await CategoriesPage({ searchParams: Promise.resolve(params) }));
}

describe('CategoriesPage', () => {
  it('menampilkan kategori, jumlah judul, dan aksinya sesuai filter dari URL', async () => {
    mockListCategories.mockResolvedValueOnce({
      rows: [{ id: 'c1', name: 'Fiksi', status: 'active', bookCount: 4 }],
      total: 1,
    });

    const html = await render({ q: 'fik' });

    expect(mockListCategories).toHaveBeenCalledWith({ q: 'fik', status: 'active', page: 1 });
    expect(html).toContain('Fiksi');
    expect(html).toContain('>4<');
    expect(html).toContain('href="/master/kategori/c1"');
    expect(html).toContain('Nonaktifkan');
  });

  it('menampilkan pesan kosong dan pesan sukses dari ?pesan', async () => {
    mockListCategories.mockResolvedValueOnce({ rows: [], total: 0 });

    const html = await render({ pesan: 'Kategori berhasil ditambahkan.' });

    expect(html).toContain('Belum ada kategori yang cocok.');
    expect(html).toContain('Kategori berhasil ditambahkan.');
  });
});
