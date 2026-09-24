import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockRequireProfile, mockLimit } = vi.hoisted(() => ({
  mockRequireProfile: vi.fn(),
  mockLimit: vi.fn(),
}));

vi.mock('@/server/auth/guard', () => ({
  requireProfile: mockRequireProfile,
}));
vi.mock('@/server/db/client', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: mockLimit,
        }),
      }),
    }),
  },
  schema: { academicYears: {} },
}));

import AppLayout from './layout';

describe('AppLayout', () => {
  it('menampilkan nama petugas dan tahun ajaran aktif dari sesi sungguhan', async () => {
    mockRequireProfile.mockResolvedValueOnce({ fullName: 'Petugas Perpustakaan' });
    mockLimit.mockResolvedValueOnce([{ name: '2026/2027' }]);

    const element = await AppLayout({ children: <div>isi</div> });
    const html = renderToStaticMarkup(element);

    expect(html).toContain('Petugas Perpustakaan');
    expect(html).toContain('2026/2027');
  });

  it('meneruskan null ke Topbar ketika tidak ada tahun ajaran aktif', async () => {
    mockRequireProfile.mockResolvedValueOnce({ fullName: 'Admin' });
    mockLimit.mockResolvedValueOnce([]);

    const element = await AppLayout({ children: <div>isi</div> });
    const html = renderToStaticMarkup(element);

    expect(html).toContain('Belum ada tahun ajaran aktif');
  });
});
