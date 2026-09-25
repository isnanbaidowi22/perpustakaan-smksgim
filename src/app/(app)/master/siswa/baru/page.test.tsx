import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@/server/actions/students', () => ({ createStudentAction: vi.fn() }));
vi.mock('@/server/queries/academic-years', () => ({
  listAcademicYearOptions: vi.fn(async () => [{ value: 'y1', label: '2026/2027 (aktif)' }]),
  getActiveAcademicYear: vi.fn(async () => ({ id: 'y1', name: '2026/2027' })),
}));
vi.mock('@/server/auth/guard', () => ({
  requireProfile: vi.fn(async () => ({ id: 'u1', role: 'petugas', fullName: 'Petugas', status: 'active' })),
}));

import NewStudentPage from './page';

describe('NewStudentPage', () => {
  it('menampilkan seluruh kolom siswa dengan tahun ajaran aktif terpilih', async () => {
    const html = renderToStaticMarkup(await NewStudentPage());
    for (const name of ['nis', 'name', 'className', 'major', 'gender', 'phone', 'academicYearId']) {
      expect(html).toContain(`name="${name}"`);
    }
    expect(html).toMatch(/<option value="y1" selected="">2026\/2027 \(aktif\)<\/option>/);
  });
});
