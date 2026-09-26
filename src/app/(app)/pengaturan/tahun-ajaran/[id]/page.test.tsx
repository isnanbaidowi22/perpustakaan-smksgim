import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockGet, mockRequireProfile, mockNotFound } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockRequireProfile: vi.fn(),
  mockNotFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('@/server/queries/academic-years', () => ({ getAcademicYear: mockGet }));
vi.mock('@/server/actions/academic-years', () => ({ updateAcademicYearAction: vi.fn() }));
vi.mock('@/server/auth/guard', () => ({ requireProfile: mockRequireProfile }));
vi.mock('next/navigation', () => ({ notFound: mockNotFound }));

import EditAcademicYearPage from './page';

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireProfile.mockResolvedValue({ id: 'u1', role: 'admin', fullName: 'Administrator', status: 'active' });
});

describe('EditAcademicYearPage', () => {
  it('mengisi form dengan data tahun ajaran dan menandai yang aktif', async () => {
    mockGet.mockResolvedValueOnce({
      id: 'y1', name: '2026/2027', startDate: '2026-07-01', endDate: '2027-06-30', isActive: true,
    });

    const html = renderToStaticMarkup(await EditAcademicYearPage({ params: Promise.resolve({ id: 'y1' }) }));

    expect(html).toContain('value="2026/2027"');
    expect(html).toContain('value="2026-07-01"');
    expect(html).toContain('tahun ajaran aktif');
  });

  it('menampilkan halaman tidak ditemukan untuk id yang tidak ada', async () => {
    mockGet.mockResolvedValueOnce(null);
    await expect(EditAcademicYearPage({ params: Promise.resolve({ id: 'x' }) })).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('memeriksa sesi lebih dulu sebelum membaca data tahun ajaran', async () => {
    mockRequireProfile.mockRejectedValueOnce(new Error('NEXT_REDIRECT'));

    await expect(EditAcademicYearPage({ params: Promise.resolve({ id: 'y1' }) })).rejects.toThrow('NEXT_REDIRECT');

    expect(mockGet).not.toHaveBeenCalled();
  });
});
