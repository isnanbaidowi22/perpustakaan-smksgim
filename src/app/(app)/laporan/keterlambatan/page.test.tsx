import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockOverdueReport, mockClassOptions, mockSettings, mockRequireProfile } = vi.hoisted(() => ({
  mockOverdueReport: vi.fn(),
  mockClassOptions: vi.fn(),
  mockSettings: vi.fn(),
  mockRequireProfile: vi.fn(),
}));

vi.mock('@/server/queries/reports', () => ({ overdueReport: mockOverdueReport, listReportClassOptions: mockClassOptions }));
vi.mock('@/server/queries/settings', () => ({ getLibrarySettings: mockSettings }));
vi.mock('@/server/auth/guard', () => ({ requireProfile: mockRequireProfile }));
vi.mock('@/lib/school-date', () => ({ schoolToday: () => '2090-03-06', formatSchoolDateTime: () => '06/03/2090 10.00' }));

import OverdueReportPage from './page';

const row = {
  id: 'i1', loanId: 'l1', transactionNumber: 'PJM-20900220-0001', studentName: 'Ahmad Fauzi', studentNis: '202600123',
  studentClass: 'XI RPL 1', barcode: 'BK-000001', bookTitle: 'Pemrograman Web', dueDate: '2090-02-23', daysLate: 11,
  estimatedFine: 11000,
};

async function render(params: Record<string, string> = {}) {
  return renderToStaticMarkup(await OverdueReportPage({ searchParams: Promise.resolve(params) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireProfile.mockResolvedValue({ id: 'u1', role: 'admin', fullName: 'Admin', status: 'active' });
  mockClassOptions.mockResolvedValue([{ value: 'XI RPL 1', label: 'XI RPL 1' }]);
  mockSettings.mockResolvedValue({ schoolName: 'SMK Negeri 1 Contoh', receiptFooter: null, finePerDay: 1000 });
  mockOverdueReport.mockResolvedValue({ rows: [row], summary: { students: 1, copies: 1, estimatedFines: 11000 }, truncated: false });
});

describe('OverdueReportPage', () => {
  it('menampilkan keterlambatan per hari ini dengan tarif denda saat ini', async () => {
    const html = await render({ kelas: 'XI RPL 1' });

    expect(mockOverdueReport).toHaveBeenCalledWith({ className: 'XI RPL 1' }, '2090-03-06', 1000);
    expect(html).toContain('Laporan Keterlambatan');
    expect(html).toContain('Per 06/03/2090 · Kelas XI RPL 1');
    expect(html).not.toContain('name="dari"');
    expect(html).toContain('href="/transaksi/riwayat/l1"');
    expect(html).toContain('Ahmad Fauzi');
    expect(html).toContain('23/02/2090');
    expect(html).toContain('11 hari');
    expect(html).toContain('Rp11.000');
    expect(html).toContain('tarif Rp1.000 per hari');
  });

  it('menampilkan pesan bila tidak ada yang terlambat', async () => {
    mockOverdueReport.mockResolvedValueOnce({ rows: [], summary: { students: 0, copies: 0, estimatedFines: 0 }, truncated: false });
    expect(await render()).toContain('Tidak ada buku yang terlambat dikembalikan.');
  });

  it('tidak membaca laporan tanpa sesi', async () => {
    mockRequireProfile.mockRejectedValueOnce(new Error('NEXT_REDIRECT'));
    await expect(render()).rejects.toThrow('NEXT_REDIRECT');
    expect(mockOverdueReport).not.toHaveBeenCalled();
  });
});
