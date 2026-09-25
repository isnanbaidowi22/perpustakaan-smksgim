import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { LoanRow } from '@/server/queries/loans';

const { mockStats, mockDueToday, mockListLoans } = vi.hoisted(() => ({
  mockStats: vi.fn(),
  mockDueToday: vi.fn(),
  mockListLoans: vi.fn(),
}));

vi.mock('@/server/queries/dashboard', () => ({ getDashboardStats: mockStats, listDueToday: mockDueToday }));
vi.mock('@/server/queries/loans', () => ({ listLoans: mockListLoans }));
vi.mock('@/lib/school-date', () => ({ schoolToday: () => '2090-03-02' }));
vi.mock('@/server/auth/guard', () => ({
  requireProfile: vi.fn(async () => ({ id: 'u1', role: 'petugas', fullName: 'Siti Petugas', status: 'active' })),
}));

import DashboardPage from './page';

const stats = {
  totalCopies: 1250,
  totalTitles: 310,
  availableCopies: 1100,
  borrowedCopies: 140,
  overdueLoans: 3,
  overdueCopies: 5,
  loansToday: 7,
  copiesLentToday: 12,
  copiesReturnedToday: 9,
};

function loanRow(index: number): LoanRow {
  return {
    id: `l${index}`,
    transactionNumber: `PJM-20900302-${String(index).padStart(4, '0')}`,
    loanDate: '2090-03-02',
    dueDate: '2090-03-05',
    status: 'AKTIF',
    studentName: `Siswa ${index}`,
    studentNis: `N${index}`,
    studentClass: 'XI RPL 1',
    itemCount: 1,
    openCount: 1,
    totalFine: 0,
    unpaidFine: 0,
    daysOverdue: 0,
  };
}

async function render() {
  return renderToStaticMarkup(await DashboardPage());
}

beforeEach(() => {
  vi.clearAllMocks();
  mockStats.mockResolvedValue(stats);
  mockDueToday.mockResolvedValue([]);
  mockListLoans.mockResolvedValue({ rows: [], total: 0 });
});

describe('DashboardPage', () => {
  it('menampilkan enam angka dengan tautan ke halaman rinciannya', async () => {
    const html = await render();

    expect(mockStats).toHaveBeenCalledWith('2090-03-02');
    expect(html).toContain('Total Buku');
    expect(html).toContain('1.250');
    expect(html).toContain('eksemplar dari 310 judul aktif');
    expect(html).toContain('Buku Tersedia');
    expect(html).toContain('1.100');
    expect(html).toContain('Sedang Dipinjam');
    expect(html).toContain('href="/transaksi/riwayat?status=open"');
    expect(html).toContain('Terlambat');
    expect(html).toContain('href="/transaksi/riwayat?status=overdue"');
    expect(html).toContain('transaksi · 5 buku belum kembali');
    expect(html).toContain('Peminjaman Hari Ini');
    expect(html).toContain('transaksi · 12 buku');
    expect(html).toContain('Pengembalian Hari Ini');
    expect(html).toContain('>9<');
    expect(html).toContain('02/03/2090');
  });

  it('mendaftar pinjaman yang jatuh tempo hari ini dengan tautan ke transaksinya', async () => {
    mockDueToday.mockResolvedValueOnce([{
      id: 'd1', transactionNumber: 'PJM-20900227-0004', studentName: 'Ahmad Fauzi',
      studentNis: '202600123', studentClass: 'XI RPL 1', openCount: 2,
    }]);

    const html = await render();

    expect(mockDueToday).toHaveBeenCalledWith('2090-03-02');
    expect(html).toContain('Jatuh Tempo Hari Ini');
    expect(html).toContain('href="/transaksi/riwayat/d1"');
    expect(html).toContain('Ahmad Fauzi');
    expect(html).toContain('PJM-20900227-0004');
    expect(html).toContain('2 buku');
  });

  it('menampilkan pesan bila tidak ada yang jatuh tempo dan belum ada transaksi', async () => {
    const html = await render();
    expect(html).toContain('Tidak ada pinjaman yang jatuh tempo hari ini.');
    expect(html).toContain('Belum ada transaksi.');
  });

  it('menampilkan delapan transaksi terbaru dari riwayat', async () => {
    mockListLoans.mockResolvedValueOnce({ rows: Array.from({ length: 10 }, (_, index) => loanRow(index + 1)), total: 10 });

    const html = await render();

    expect(mockListLoans).toHaveBeenCalledWith({ q: '', status: 'all', page: 1 }, '2090-03-02');
    expect(html).toContain('PJM-20900302-0008');
    expect(html).not.toContain('PJM-20900302-0009');
    expect(html).toContain('href="/transaksi/riwayat"');
  });
});
