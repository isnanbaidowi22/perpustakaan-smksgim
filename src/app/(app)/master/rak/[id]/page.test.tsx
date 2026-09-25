import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockGetRack, mockNotFound } = vi.hoisted(() => ({
  mockGetRack: vi.fn(),
  mockNotFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('@/server/queries/racks', () => ({ getRack: mockGetRack }));
vi.mock('@/server/actions/racks', () => ({ updateRackAction: vi.fn() }));
vi.mock('next/navigation', () => ({ notFound: mockNotFound }));

import EditRackPage from './page';

describe('EditRackPage', () => {
  it('mengisi form dengan data rak saat ini', async () => {
    mockGetRack.mockResolvedValueOnce({
      id: 'r1', code: 'A-3', name: 'Rak A Baris 3', location: 'Ruang Utama', status: 'active',
    });

    const html = renderToStaticMarkup(await EditRackPage({ params: Promise.resolve({ id: 'r1' }) }));

    expect(html).toContain('value="A-3"');
    expect(html).toContain('value="Ruang Utama"');
  });

  it('menampilkan halaman tidak ditemukan untuk id yang tidak ada', async () => {
    mockGetRack.mockResolvedValueOnce(null);
    await expect(EditRackPage({ params: Promise.resolve({ id: 'x' }) })).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
