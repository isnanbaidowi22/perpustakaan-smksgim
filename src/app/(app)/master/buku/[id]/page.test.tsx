import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockGetBook, mockRequireProfile, mockNotFound } = vi.hoisted(() => ({
  mockGetBook: vi.fn(),
  mockRequireProfile: vi.fn(),
  mockNotFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('@/server/queries/books', () => ({ getBook: mockGetBook }));
vi.mock('@/server/queries/categories', () => ({ listCategoryOptions: vi.fn(async () => []) }));
vi.mock('@/server/queries/racks', () => ({ listRackOptions: vi.fn(async () => []) }));
vi.mock('@/server/queries/copies', () => ({
  listCopiesOfBook: vi.fn(async () => [
    { id: 'k1', barcode: 'BK-000001', status: 'NONAKTIF', acquisitionDate: null, notes: null },
  ]),
}));
vi.mock('@/server/auth/guard', () => ({ requireProfile: mockRequireProfile }));
vi.mock('@/server/actions/books', () => ({ updateBookAction: vi.fn() }));
vi.mock('@/server/actions/copies', () => ({ addCopiesAction: vi.fn(), changeCopyStatusAction: vi.fn() }));
vi.mock('next/navigation', () => ({ notFound: mockNotFound }));

import BookDetailPage from './page';

const book = {
  id: 'b1', isbn: '9786021234567', title: 'Pemrograman Web', author: 'Budi Raharjo',
  publisher: 'Informatika', publishYear: 2024, categoryId: null, rackId: null,
  price: '85000.00', description: null, status: 'active' as const,
};

async function render(params: Record<string, string> = {}) {
  return renderToStaticMarkup(await BookDetailPage({
    params: Promise.resolve({ id: 'b1' }),
    searchParams: Promise.resolve(params),
  }));
}

describe('BookDetailPage', () => {
  it('mengisi form dengan data buku, harga tanpa desimal', async () => {
    mockGetBook.mockResolvedValueOnce(book);
    mockRequireProfile.mockResolvedValueOnce({ role: 'petugas' });

    const html = await render({ pesan: 'Buku berhasil ditambahkan.' });

    expect(html).toContain('value="Pemrograman Web"');
    expect(html).toContain('value="85000"');
    expect(html).toContain('value="2024"');
    expect(html).toContain('Buku berhasil ditambahkan.');
  });

  it('menampilkan eksemplar, dengan aksi status hanya untuk admin', async () => {
    mockGetBook.mockResolvedValueOnce(book);
    mockRequireProfile.mockResolvedValueOnce({ role: 'admin' });
    expect(await render()).toContain('Aktifkan kembali');

    mockGetBook.mockResolvedValueOnce(book);
    mockRequireProfile.mockResolvedValueOnce({ role: 'petugas' });
    const html = await render();
    expect(html).toContain('BK-000001');
    expect(html).not.toContain('Aktifkan kembali');
  });

  it('menampilkan halaman tidak ditemukan untuk id yang tidak ada', async () => {
    mockGetBook.mockResolvedValueOnce(null);
    mockRequireProfile.mockResolvedValueOnce({ role: 'admin' });
    await expect(render()).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
