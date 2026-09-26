import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockReturnReport, mockClassOptions, mockSettings, mockRequireProfile } = vi.hoisted(() => ({
  mockReturnReport: vi.fn(),
  mockClassOptions: vi.fn(),
  mockSettings: vi.fn(),
  mockRequireProfile: vi.fn(),
}));

vi.mock('@/server/queries/reports', () => ({ returnReport: mockReturnReport, listReportClassOptions: mockClassOptions }));
vi.mock('@/server/queries/settings', () => ({ getLibrarySettings: mockSettings }));
vi.mock('@/server/auth/guard', () => ({ requireProfile: mockRequireProfile }));
vi.mock('@/lib/school-date', () => ({ schoolToday: () => '2090-03-06', formatSchoolDateTime: () => '02/03/2090 09.00' }));

import ReturnReportPage from './page';

const row = {
  id: 'i1', returnedAt: new Date('2090-03-02T02:00:00Z'), loanId: 'l1', transactionNumber: 'PJM-20900225-0001',
  studentName: 'Ahmad Fauzi', studentNis: '202600123', studentClass: 'XI RPL 1', barcode: 'BK-000001',
  bookTitle: 'Pemrograman Web', condition: 'RUSAK' as const, daysLate: 2, lateFine: 2000, replacementFee: 50000,
};

async function render(params: Record<string, string> = {}) {
  return renderToStaticMarkup(await ReturnReportPage({ searchParams: Promise.resolve(params) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireProfile.mockResolvedValue({ id: 'u1', role: 'admin', fullName: 'Admin', status: 'active' });
  mockClassOptions.mockResolvedValue([]);
  mockSettings.mockResolvedValue({ schoolName: 'SMK Negeri 1 Contoh', receiptFooter: null });
  mockReturnReport.mockResolvedValue({
    rows: [row],
    summary: { copies: 1, good: 0, damaged: 1, lost: 0, lateFines: 2000, replacementFees: 50000 },
    truncated: false,
  });
});

describe('ReturnReportPage', () => {
  it('menampilkan eksemplar yang kembali beserta kondisi, denda, dan ringkasan', async () => {
    const html = await render({ dari: '2090-03-02', sampai: '2090-03-02' });

    expect(mockReturnReport).toHaveBeenCalledWith({ from: '2090-03-02', to: '2090-03-02', className: '' });
    expect(html).toContain('Laporan Pengembalian');
    expect(html).toContain('02/03/2090 09.00');
    expect(html).toContain('href="/transaksi/riwayat/l1"');
    expect(html).toContain('BK-000001');
    expect(html).toContain('Pemrograman Web');
    expect(html).toContain('Rusak');
    expect(html).toContain('Rp2.000');
    expect(html).toContain('Rp50.000');
    expect(html).toContain('Buku kembali');
    expect(html).toContain('Rusak / hilang');
    expect(html).toContain('1 / 0');
  });

  it('menampilkan pesan kosong dan pemberitahuan pemotongan', async () => {
    mockReturnReport.mockResolvedValueOnce({
      rows: [], summary: { copies: 0, good: 0, damaged: 0, lost: 0, lateFines: 0, replacementFees: 0 }, truncated: true,
    });

    const html = await render();

    expect(html).toContain('Tidak ada pengembalian pada periode ini.');
    expect(html).toContain('Laporan ini memuat lebih dari 1.000 baris');
  });

  it('tidak membaca laporan tanpa sesi', async () => {
    mockRequireProfile.mockRejectedValueOnce(new Error('NEXT_REDIRECT'));
    await expect(render()).rejects.toThrow('NEXT_REDIRECT');
    expect(mockReturnReport).not.toHaveBeenCalled();
  });
});
