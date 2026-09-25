import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockGetCategory, mockNotFound } = vi.hoisted(() => ({
  mockGetCategory: vi.fn(),
  mockNotFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('@/server/queries/categories', () => ({ getCategory: mockGetCategory }));
vi.mock('@/server/actions/categories', () => ({ updateCategoryAction: vi.fn() }));
vi.mock('@/server/auth/guard', () => ({
  requireProfile: vi.fn(async () => ({ id: 'u1', role: 'petugas', fullName: 'Petugas', status: 'active' })),
}));
vi.mock('next/navigation', () => ({ notFound: mockNotFound }));

import EditCategoryPage from './page';

describe('EditCategoryPage', () => {
  it('mengisi form dengan nama kategori saat ini', async () => {
    mockGetCategory.mockResolvedValueOnce({ id: 'c1', name: 'Fiksi', status: 'active' });

    const html = renderToStaticMarkup(await EditCategoryPage({ params: Promise.resolve({ id: 'c1' }) }));

    expect(html).toContain('value="Fiksi"');
    expect(html).toContain('Simpan Perubahan');
  });

  it('menampilkan halaman tidak ditemukan untuk id yang tidak ada', async () => {
    mockGetCategory.mockResolvedValueOnce(null);

    await expect(EditCategoryPage({ params: Promise.resolve({ id: 'x' }) })).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
