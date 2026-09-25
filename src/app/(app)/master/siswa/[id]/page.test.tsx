import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockGetStudent, mockNotFound } = vi.hoisted(() => ({
  mockGetStudent: vi.fn(),
  mockNotFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('@/server/queries/students', () => ({ getStudent: mockGetStudent }));
vi.mock('@/server/queries/academic-years', () => ({
  listAcademicYearOptions: vi.fn(async () => [{ value: 'y1', label: '2026/2027 (aktif)' }]),
}));
vi.mock('@/server/actions/students', () => ({ updateStudentAction: vi.fn() }));
vi.mock('@/server/auth/guard', () => ({
  requireProfile: vi.fn(async () => ({ id: 'u1', role: 'petugas', fullName: 'Petugas', status: 'active' })),
}));
vi.mock('next/navigation', () => ({ notFound: mockNotFound }));

import EditStudentPage from './page';

describe('EditStudentPage', () => {
  it('mengisi form dengan data siswa saat ini', async () => {
    mockGetStudent.mockResolvedValueOnce({
      id: 's1', nis: '202600123', name: 'Ahmad Fauzi', className: 'XI RPL 1',
      major: 'RPL', gender: 'L', phone: null, academicYearId: 'y1', status: 'active',
    });

    const html = renderToStaticMarkup(await EditStudentPage({ params: Promise.resolve({ id: 's1' }) }));

    expect(html).toContain('value="202600123"');
    expect(html).toContain('value="XI RPL 1"');
    expect(html).toMatch(/<option value="L" selected="">/);
    expect(html).toContain('Tanpa tahun ajaran');
  });

  it('menampilkan halaman tidak ditemukan untuk id yang tidak ada', async () => {
    mockGetStudent.mockResolvedValueOnce(null);
    await expect(EditStudentPage({ params: Promise.resolve({ id: 'x' }) })).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
