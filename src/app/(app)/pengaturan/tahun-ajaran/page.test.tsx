import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockList, mockRequireProfile } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockRequireProfile: vi.fn(),
}));

vi.mock('@/server/queries/academic-years', () => ({ listAcademicYears: mockList }));
vi.mock('@/server/actions/academic-years', () => ({ activateAcademicYearAction: vi.fn() }));
vi.mock('@/server/auth/guard', () => ({ requireProfile: mockRequireProfile }));

import AcademicYearsPage from './page';

async function render(params: Record<string, string> = {}) {
  return renderToStaticMarkup(await AcademicYearsPage({ searchParams: Promise.resolve(params) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireProfile.mockResolvedValue({ id: 'u1', role: 'admin', fullName: 'Administrator', status: 'active' });
});

describe('AcademicYearsPage', () => {
  it('menampilkan tanggal dan menawarkan "Jadikan Aktif" hanya untuk tahun yang tidak aktif', async () => {
    mockList.mockResolvedValueOnce([
      { id: 'y2', name: '2027/2028', startDate: '2027-07-01', endDate: '2028-06-30', isActive: false },
      { id: 'y1', name: '2026/2027', startDate: '2026-07-01', endDate: '2027-06-30', isActive: true },
    ]);

    const html = await render({ pesan: 'Tahun ajaran berhasil ditambahkan.' });

    expect(html).toContain('01/07/2027');
    expect(html).toContain('30/06/2028');
    expect(html.split('Jadikan Aktif').length - 1).toBe(1);
    expect(html).toContain('href="/pengaturan/tahun-ajaran/y1"');
    expect(html).toContain('Tahun ajaran berhasil ditambahkan.');
  });

  it('menjelaskan langkah pertama bila belum ada tahun ajaran', async () => {
    mockList.mockResolvedValueOnce([]);
    expect(await render()).toContain('Belum ada tahun ajaran.');
  });

  it('memeriksa sesi lebih dulu sebelum membaca daftar tahun ajaran', async () => {
    mockRequireProfile.mockRejectedValueOnce(new Error('NEXT_REDIRECT'));

    await expect(render()).rejects.toThrow('NEXT_REDIRECT');

    expect(mockList).not.toHaveBeenCalled();
  });
});
