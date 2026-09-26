import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockListLoans } = vi.hoisted(() => ({ mockListLoans: vi.fn() }));

vi.mock('@/server/queries/loans', () => ({ listLoans: mockListLoans }));
vi.mock('@/lib/school-date', () => ({ schoolToday: () => '2090-03-09' }));
vi.mock('@/server/auth/guard', () => ({
  requireProfile: vi.fn(async () => ({ id: 'u1', role: 'admin', fullName: 'Petugas', status: 'active' })),
}));

import HistoryPage from './page';

async function render(params: Record<string, string> = {}) {
  return renderToStaticMarkup(await HistoryPage({ searchParams: Promise.resolve(params) }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('HistoryPage', () => {
  it('menampilkan transaksi dengan tautan detail, sisa denda, dan status terlambat', async () => {
    mockListLoans.mockResolvedValueOnce({
      rows: [{
        id: 'l1', transactionNumber: 'PJM-20900302-0001', loanDate: '2090-03-02', dueDate: '2090-03-05',
        status: 'SEBAGIAN_KEMBALI', studentName: 'Ahmad Fauzi', studentNis: '202600123', studentClass: 'XI RPL 1',
        itemCount: 2, openCount: 1, totalFine: 4000, unpaidFine: 1500, daysOverdue: 4,
      }],
      total: 1,
    });

    const html = await render({ status: 'overdue', q: 'ahmad' });

    expect(mockListLoans).toHaveBeenCalledWith({ q: 'ahmad', status: 'overdue', page: 1 }, '2090-03-09');
    expect(html).toContain('href="/transaksi/riwayat/l1"');
    expect(html).toContain('PJM-20900302-0001');
    expect(html).toContain('Ahmad Fauzi');
    expect(html).toContain('1 belum kembali');
    expect(html).toContain('Rp1.500 belum lunas');
    expect(html).toContain('Terlambat 4 hari');
  });

  it('menampilkan pesan kosong', async () => {
    mockListLoans.mockResolvedValueOnce({ rows: [], total: 0 });
    expect(await render()).toContain('Belum ada transaksi yang cocok.');
  });
});
