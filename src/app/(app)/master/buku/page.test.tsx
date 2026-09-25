import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockListBooks } = vi.hoisted(() => ({ mockListBooks: vi.fn() }));

vi.mock('@/server/queries/books', () => ({ listBooks: mockListBooks }));
vi.mock('@/server/queries/categories', () => ({
  listCategoryOptions: vi.fn(async () => [{ value: 'c1', label: 'Teknologi Informasi' }]),
}));
vi.mock('@/server/actions/books', () => ({ setBookStatusAction: vi.fn() }));
vi.mock('@/server/auth/guard', () => ({
  requireProfile: vi.fn(async () => ({ id: 'u1', role: 'petugas', fullName: 'Petugas', status: 'active' })),
}));

import BooksPage from './page';

async function render(params: Record<string, string> = {}) {
  return renderToStaticMarkup(await BooksPage({ searchParams: Promise.resolve(params) }));
}

describe('BooksPage', () => {
  it('menampilkan judul, penulis, ketersediaan eksemplar, dan harga', async () => {
    mockListBooks.mockResolvedValueOnce({
      rows: [{
        id: 'b1', title: 'Pemrograman Web', author: 'Budi Raharjo', isbn: null,
        categoryName: 'Teknologi Informasi', rackCode: 'A-3', price: '85000.00',
        status: 'active', totalCopies: 3, availableCopies: 2,
      }],
      total: 1,
    });

    const html = await render({ kategori: 'c1' });

    expect(mockListBooks).toHaveBeenCalledWith({ q: '', categoryId: 'c1', status: 'active', page: 1 });
    expect(html).toContain('href="/master/buku/b1"');
    expect(html).toContain('Budi Raharjo');
    expect(html).toContain('2/3 tersedia');
    expect(html).toContain('Rp85.000');
    expect(html).toContain('A-3');
  });

  it('menandai buku tanpa eksemplar dan menampilkan pesan kosong', async () => {
    mockListBooks.mockResolvedValueOnce({
      rows: [{
        id: 'b2', title: 'Basis Data', author: 'Siti', isbn: null, categoryName: null, rackCode: null,
        price: '0.00', status: 'active', totalCopies: 0, availableCopies: 0,
      }],
      total: 1,
    });
    expect(await render()).toContain('Belum ada eksemplar');

    mockListBooks.mockResolvedValueOnce({ rows: [], total: 0 });
    expect(await render()).toContain('Belum ada buku yang cocok.');
  });
});
