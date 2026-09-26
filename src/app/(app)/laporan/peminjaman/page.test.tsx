import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockLoanReport, mockClassOptions, mockSettings, mockRequireProfile } = vi.hoisted(() => ({
  mockLoanReport: vi.fn(),
  mockClassOptions: vi.fn(),
  mockSettings: vi.fn(),
  mockRequireProfile: vi.fn(),
}));

vi.mock('@/server/queries/reports', () => ({ loanReport: mockLoanReport, listReportClassOptions: mockClassOptions }));
vi.mock('@/server/queries/settings', () => ({ getLibrarySettings: mockSettings }));
vi.mock('@/server/auth/guard', () => ({ requireProfile: mockRequireProfile }));
vi.mock('@/lib/school-date', () => ({ schoolToday: () => '2090-03-06', formatSchoolDateTime: () => '06/03/2090 10.00' }));

import LoanReportPage from './page';

const row = {
  id: 'l1', transactionNumber: 'PJM-20900301-0001', loanDate: '2090-03-01', dueDate: '2090-03-04',
  status: 'AKTIF' as const, studentName: 'Ahmad Fauzi', studentNis: '202600123', studentClass: 'XI RPL 1',
  itemCount: 2, openCount: 2, daysOverdue: 2,
};

async function render(params: Record<string, string> = {}) {
  return renderToStaticMarkup(await LoanReportPage({ searchParams: Promise.resolve(params) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireProfile.mockResolvedValue({ id: 'u1', role: 'admin', fullName: 'Admin', status: 'active' });
  mockClassOptions.mockResolvedValue([{ value: 'XI RPL 1', label: 'XI RPL 1' }]);
  mockSettings.mockResolvedValue({ schoolName: 'SMK Negeri 1 Contoh', receiptFooter: null });
  mockLoanReport.mockResolvedValue({ rows: [row], summary: { loans: 1, copies: 2, students: 1 }, truncated: false });
});

describe('LoanReportPage', () => {
  it('memakai tanggal 1 bulan ini sampai hari ini dan menampilkan baris serta ringkasan', async () => {
    const html = await render();

    expect(mockLoanReport).toHaveBeenCalledWith({ from: '2090-03-01', to: '2090-03-06', className: '' }, '2090-03-06');
    expect(html).toContain('Laporan Peminjaman');
    expect(html).toContain('SMK Negeri 1 Contoh');
    expect(html).toContain('Periode 01/03/2090 – 06/03/2090');
    expect(html).toContain('href="/transaksi/riwayat/l1"');
    expect(html).toContain('PJM-20900301-0001');
    expect(html).toContain('Ahmad Fauzi');
    expect(html).toContain('XI RPL 1');
    expect(html).toContain('Terlambat 2 hari');
    expect(html).toContain('Transaksi');
    expect(html).toContain('Buku dipinjam');
  });

  it('meneruskan periode dan kelas dari URL, dan menyebut kelasnya di kop', async () => {
    const html = await render({ dari: '2090-02-01', sampai: '2090-02-28', kelas: 'XI RPL 1' });

    expect(mockLoanReport).toHaveBeenCalledWith({ from: '2090-02-01', to: '2090-02-28', className: 'XI RPL 1' }, '2090-03-06');
    expect(html).toContain('Periode 01/02/2090 – 28/02/2090 · Kelas XI RPL 1');
  });

  it('memberi tahu periode yang salah dan memakai periode bawaan', async () => {
    const html = await render({ dari: '2090-03-05', sampai: '2090-03-01' });

    expect(html).toContain('Periode terbalik: 05/03/2090 berada setelah 01/03/2090.');
    expect(mockLoanReport).toHaveBeenCalledWith({ from: '2090-03-01', to: '2090-03-06', className: '' }, '2090-03-06');
  });

  it('memberi tahu bila baris dipotong, dan menampilkan pesan kosong', async () => {
    mockLoanReport.mockResolvedValueOnce({ rows: [], summary: { loans: 0, copies: 0, students: 0 }, truncated: true });

    const html = await render();

    expect(html).toContain('Laporan ini memuat lebih dari 1.000 baris');
    expect(html).toContain('Tidak ada peminjaman pada periode ini.');
  });

  it('tidak membaca laporan tanpa sesi', async () => {
    mockRequireProfile.mockRejectedValueOnce(new Error('NEXT_REDIRECT'));

    await expect(render()).rejects.toThrow('NEXT_REDIRECT');
    expect(mockLoanReport).not.toHaveBeenCalled();
  });
});
