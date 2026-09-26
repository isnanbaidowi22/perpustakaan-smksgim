import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockCollection, mockCategories, mockSettings, mockRequireProfile } = vi.hoisted(() => ({
  mockCollection: vi.fn(),
  mockCategories: vi.fn(),
  mockSettings: vi.fn(),
  mockRequireProfile: vi.fn(),
}));

vi.mock('@/server/queries/reports', () => ({ collectionReport: mockCollection }));
vi.mock('@/server/queries/categories', () => ({ listCategoryOptions: mockCategories }));
vi.mock('@/server/queries/settings', () => ({ getLibrarySettings: mockSettings }));
vi.mock('@/server/auth/guard', () => ({ requireProfile: mockRequireProfile }));
vi.mock('@/lib/school-date', () => ({ schoolToday: () => '2090-03-06', formatSchoolDateTime: () => '06/03/2090 10.00' }));

import CollectionReportPage from './page';

const row = {
  id: 'b1', title: 'Pemrograman Web', author: 'Budi Raharjo', categoryName: 'Teknologi', rackCode: 'A-3',
  available: 3, borrowed: 2, damaged: 1, lost: 0, inactive: 1, total: 6,
};

async function render(params: Record<string, string> = {}) {
  return renderToStaticMarkup(await CollectionReportPage({ searchParams: Promise.resolve(params) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireProfile.mockResolvedValue({ id: 'u1', role: 'admin', fullName: 'Admin', status: 'active' });
  mockCategories.mockResolvedValue([{ value: 'c1', label: 'Teknologi' }]);
  mockSettings.mockResolvedValue({ schoolName: 'SMK Negeri 1 Contoh', receiptFooter: null });
  mockCollection.mockResolvedValue({
    rows: [row], summary: { titles: 1, total: 6, available: 3, borrowed: 2, damaged: 1, lost: 0 }, truncated: false,
  });
});

describe('CollectionReportPage', () => {
  it('menampilkan eksemplar per status tiap judul, dengan filter kata kunci dan kategori', async () => {
    const html = await render({ q: 'web', kategori: 'c1' });

    expect(mockCollection).toHaveBeenCalledWith({ q: 'web', categoryId: 'c1' });
    expect(html).toContain('Laporan Koleksi Buku');
    expect(html).toContain('Per 06/03/2090 · Kategori Teknologi');
    expect(html).toContain('name="q"');
    expect(html).toContain('name="kategori"');
    expect(html).toContain('Semua kategori');
    expect(html).toContain('href="/master/buku/b1"');
    expect(html).toContain('Pemrograman Web');
    expect(html).toContain('Budi Raharjo');
    expect(html).toContain('A-3');
    expect(html).toContain('Judul');
    expect(html).toContain('Rusak / hilang');
  });

  it('menampilkan pesan kosong', async () => {
    mockCollection.mockResolvedValueOnce({
      rows: [], summary: { titles: 0, total: 0, available: 0, borrowed: 0, damaged: 0, lost: 0 }, truncated: false,
    });
    expect(await render()).toContain('Tidak ada judul yang cocok.');
  });

  it('tidak membaca laporan tanpa sesi', async () => {
    mockRequireProfile.mockRejectedValueOnce(new Error('NEXT_REDIRECT'));
    await expect(render()).rejects.toThrow('NEXT_REDIRECT');
    expect(mockCollection).not.toHaveBeenCalled();
  });
});
