import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockListStudents, mockListClassNames, mockRequireProfile } = vi.hoisted(() => ({
  mockListStudents: vi.fn(),
  mockListClassNames: vi.fn(),
  mockRequireProfile: vi.fn(async () => ({ id: 'u1', role: 'petugas', fullName: 'Petugas', status: 'active' })),
}));

vi.mock('@/server/queries/students', () => ({
  listStudents: mockListStudents,
  listClassNames: mockListClassNames,
}));
vi.mock('@/server/actions/students', () => ({ setStudentStatusAction: vi.fn() }));
vi.mock('@/server/auth/guard', () => ({ requireProfile: mockRequireProfile }));

import StudentsPage from './page';

async function render(params: Record<string, string> = {}) {
  return renderToStaticMarkup(await StudentsPage({ searchParams: Promise.resolve(params) }));
}

describe('StudentsPage', () => {
  it('menampilkan siswa dan meneruskan filter kelas dari URL', async () => {
    mockListClassNames.mockResolvedValueOnce(['X TKJ 2', 'XI RPL 1']);
    mockListStudents.mockResolvedValueOnce({
      rows: [{
        id: 's1', nis: '202600123', name: 'Ahmad Fauzi', className: 'XI RPL 1',
        major: 'RPL', academicYearName: '2026/2027', status: 'active',
      }],
      total: 1,
    });

    const html = await render({ kelas: 'XI RPL 1' });

    expect(mockListStudents).toHaveBeenCalledWith({ q: '', className: 'XI RPL 1', status: 'active', page: 1 });
    expect(html).toContain('202600123');
    expect(html).toContain('Ahmad Fauzi');
    expect(html).toContain('2026/2027');
    expect(html).toMatch(/<option value="XI RPL 1" selected="">XI RPL 1<\/option>/);
  });

  it('menampilkan pesan kosong', async () => {
    mockListClassNames.mockResolvedValueOnce([]);
    mockListStudents.mockResolvedValueOnce({ rows: [], total: 0 });
    expect(await render()).toContain('Belum ada siswa yang cocok.');
  });

  it('memeriksa sesi lebih dulu sebelum membaca data siswa', async () => {
    mockRequireProfile.mockRejectedValueOnce(new Error('NEXT_REDIRECT'));
    mockListClassNames.mockResolvedValueOnce([]);
    mockListStudents.mockResolvedValueOnce({ rows: [], total: 0 });

    await expect(render()).rejects.toThrow('NEXT_REDIRECT');

    expect(mockListStudents).not.toHaveBeenCalled();
  });
});
