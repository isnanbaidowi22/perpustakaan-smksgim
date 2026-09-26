import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockGetActive } = vi.hoisted(() => ({ mockGetActive: vi.fn() }));

vi.mock('@/server/actions/students', () => ({ createStudentAction: vi.fn() }));
vi.mock('@/server/queries/academic-years', () => ({
  listAcademicYearOptions: vi.fn(async () => [
    { value: 'y1', label: '2026/2027 (aktif)' },
    { value: 'y0', label: '2025/2026' },
  ]),
  getActiveAcademicYear: mockGetActive,
}));
vi.mock('@/server/auth/guard', () => ({
  requireProfile: vi.fn(async () => ({ id: 'u1', role: 'admin', fullName: 'Petugas', status: 'active' })),
}));

import NewStudentPage from './page';

beforeEach(() => {
  mockGetActive.mockResolvedValue({ id: 'y1', name: '2026/2027' });
});

describe('NewStudentPage', () => {
  it('menampilkan seluruh kolom siswa dengan tahun ajaran aktif terpilih', async () => {
    const html = renderToStaticMarkup(await NewStudentPage());
    for (const name of ['nis', 'name', 'className', 'major', 'gender', 'phone', 'academicYearId']) {
      expect(html).toContain(`name="${name}"`);
    }
    expect(html).toMatch(/<option value="y1" selected="">2026\/2027 \(aktif\)<\/option>/);
  });

  it('tidak menawarkan opsi "tanpa tahun ajaran" karena tahun aktif sudah terpilih', async () => {
    const html = renderToStaticMarkup(await NewStudentPage());
    expect(html).not.toContain('Tanpa tahun ajaran');
  });

  it('tidak diam-diam memilih tahun lama bila belum ada tahun ajaran aktif', async () => {
    mockGetActive.mockResolvedValueOnce(null);

    const html = renderToStaticMarkup(await NewStudentPage());

    expect(html).toMatch(/<option value="" selected="">— Tanpa tahun ajaran —<\/option>/);
    expect(html).toContain('Belum ada tahun ajaran aktif. Admin dapat mengaktifkannya di Pengaturan → Tahun Ajaran.');
  });
});
