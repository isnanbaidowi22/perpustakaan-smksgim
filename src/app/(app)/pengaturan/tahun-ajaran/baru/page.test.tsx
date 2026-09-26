import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockGetActive, mockRequireProfile } = vi.hoisted(() => ({
  mockGetActive: vi.fn(),
  mockRequireProfile: vi.fn(),
}));

vi.mock('@/server/queries/academic-years', () => ({ getActiveAcademicYear: mockGetActive }));
vi.mock('@/server/actions/academic-years', () => ({ createAcademicYearAction: vi.fn() }));
vi.mock('@/server/auth/guard', () => ({ requireProfile: mockRequireProfile }));

import NewAcademicYearPage from './page';

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireProfile.mockResolvedValue({ id: 'u1', role: 'admin', fullName: 'Administrator', status: 'active' });
});

describe('NewAcademicYearPage', () => {
  it('menyebut tahun aktif saat ini dan tidak mencentang "jadikan aktif"', async () => {
    mockGetActive.mockResolvedValueOnce({ id: 'y1', name: '2026/2027' });

    const html = renderToStaticMarkup(await NewAcademicYearPage());

    for (const name of ['name', 'startDate', 'endDate', 'activate']) expect(html).toContain(`name="${name}"`);
    expect(html).toContain('type="date"');
    expect(html).toContain('Tahun ajaran aktif saat ini 2026/2027');
    expect(html).not.toMatch(/type="checkbox"[^>]*checked=""/);
  });

  it('mencentang "jadikan aktif" bila belum ada tahun ajaran aktif', async () => {
    mockGetActive.mockResolvedValueOnce(null);

    const html = renderToStaticMarkup(await NewAcademicYearPage());

    expect(html).toMatch(/type="checkbox"[^>]*checked=""/);
    expect(html).toContain('Belum ada tahun ajaran aktif');
  });

  it('memeriksa sesi lebih dulu sebelum membaca tahun ajaran aktif', async () => {
    mockRequireProfile.mockRejectedValueOnce(new Error('NEXT_REDIRECT'));

    await expect(NewAcademicYearPage()).rejects.toThrow('NEXT_REDIRECT');

    expect(mockGetActive).not.toHaveBeenCalled();
  });
});
