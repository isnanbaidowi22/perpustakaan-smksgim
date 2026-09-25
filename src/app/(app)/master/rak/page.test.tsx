import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockListRacks } = vi.hoisted(() => ({ mockListRacks: vi.fn() }));

vi.mock('@/server/queries/racks', () => ({ listRacks: mockListRacks }));
vi.mock('@/server/actions/racks', () => ({ setRackStatusAction: vi.fn() }));
vi.mock('@/server/auth/guard', () => ({
  requireProfile: vi.fn(async () => ({ id: 'u1', role: 'petugas', fullName: 'Petugas', status: 'active' })),
}));

import RacksPage from './page';

async function render(params: Record<string, string> = {}) {
  return renderToStaticMarkup(await RacksPage({ searchParams: Promise.resolve(params) }));
}

describe('RacksPage', () => {
  it('menampilkan kode, nama, lokasi, dan jumlah judul', async () => {
    mockListRacks.mockResolvedValueOnce({
      rows: [{ id: 'r1', code: 'A-3', name: 'Rak A Baris 3', location: null, status: 'inactive', bookCount: 2 }],
      total: 1,
    });

    const html = await render({ status: 'all' });

    expect(mockListRacks).toHaveBeenCalledWith({ q: '', status: 'all', page: 1 });
    expect(html).toContain('A-3');
    expect(html).toContain('Rak A Baris 3');
    expect(html).toContain('—');
    expect(html).toContain('Aktifkan');
  });

  it('menampilkan pesan kosong', async () => {
    mockListRacks.mockResolvedValueOnce({ rows: [], total: 0 });
    expect(await render()).toContain('Belum ada rak yang cocok.');
  });
});
