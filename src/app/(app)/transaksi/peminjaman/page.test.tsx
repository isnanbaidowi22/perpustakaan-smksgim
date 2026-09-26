import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockActiveYear } = vi.hoisted(() => ({ mockActiveYear: vi.fn() }));

vi.mock('@/server/actions/loans', () => ({
  searchBorrowersAction: vi.fn(),
  getBorrowerCardAction: vi.fn(),
  lookupCopyAction: vi.fn(),
  createLoanAction: vi.fn(),
}));
vi.mock('@/server/queries/settings', () => ({
  getLibrarySettings: vi.fn(async () => ({ loanDurationDays: 3 })),
}));
vi.mock('@/server/queries/academic-years', () => ({ getActiveAcademicYear: mockActiveYear }));
vi.mock('@/lib/school-date', () => ({ schoolToday: () => '2090-03-02' }));
vi.mock('@/server/auth/guard', () => ({
  requireProfile: vi.fn(async () => ({ id: 'u1', role: 'admin', fullName: 'Petugas', status: 'active' })),
}));

import LoanPage from './page';

beforeEach(() => {
  mockActiveYear.mockResolvedValue({ id: 'y1', name: '2089/2090' });
});

describe('LoanPage', () => {
  it('menampilkan kolom scan siswa yang langsung aktif, kolom scan buku, dan tanggal jatuh tempo', async () => {
    const html = renderToStaticMarkup(await LoanPage());

    expect(html).toMatch(/<input[^>]*id="student"[^>]*autofocus=""/i);
    expect(html).toContain('id="barcode"');
    expect(html).toContain('02/03/2090');
    expect(html).toContain('05/03/2090');
    expect(html).toContain('(3 hari)');
    expect(html).toContain('Ctrl+Enter');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Simpan Peminjaman/);
  });

  it('memperingatkan bila belum ada tahun ajaran aktif', async () => {
    mockActiveYear.mockResolvedValueOnce(null);
    expect(renderToStaticMarkup(await LoanPage())).toContain('Belum ada tahun ajaran aktif');
  });
});
