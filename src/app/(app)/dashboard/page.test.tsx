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
  requireProfile: vi.fn(async () => ({ id: 'u1', role: 'admin', fullName: 'Siti Petugas', status: 'active' })),
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
  loansReturnedToday: 4,
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
  it('menyapa petugas dengan tanggal hari ini yang ditulis lengkap', async () => {
    const html = await render();
    expect(html).toContain('Kamis, 2 Maret 2090 · Selamat bertugas, Siti Petugas');
    expect(html).toContain('href="/transaksi/peminjaman"');
    expect(html).toContain('href="/transaksi/pengembalian"');
  });

  it('merangkum koleksi: total, tersedia, dipinjam, dan persen yang ada di rak', async () => {
    const html = await render();

    expect(mockStats).toHaveBeenCalledWith('2090-03-02');
    expect(html).toContain('310 judul aktif');
    expect(html).toContain('Total eksemplar');
    expect(html).toContain('1.250');
    expect(html).toContain('Tersedia');
    expect(html).toContain('1.100');
    expect(html).toContain('Sedang dipinjam');
    expect(html).toContain('href="/transaksi/riwayat?status=open"');
    // 1100 / 1250 = 88%
    expect(html).toContain('88% eksemplar ada di rak');
    expect(html).toContain('width:88%');
    expect(html).toContain('140 di tangan siswa');
  });

  it('tidak membagi dengan nol ketika koleksi masih kosong', async () => {
    mockStats.mockResolvedValueOnce({ ...stats, totalCopies: 0, availableCopies: 0, borrowedCopies: 0 });
    expect(await render()).toContain('0% eksemplar ada di rak');
  });

  it('menampilkan aktivitas hari ini: transaksi dan jumlah bukunya', async () => {
    const html = await render();
    expect(html).toContain('Aktivitas hari ini');
    expect(html).toMatch(/Peminjaman<\/span><span[^>]*>7<\/span><span[^>]*>12 buku</);
    expect(html).toMatch(/Pengembalian<\/span><span[^>]*>4<\/span><span[^>]*>9 buku</);
  });

  it('menyorot keterlambatan dengan tautan ke daftarnya', async () => {
    const html = await render();
    expect(html).toContain('href="/transaksi/riwayat?status=overdue"');
    expect(html).toContain('3 transaksi');
    expect(html).toContain('5 buku belum kembali melewati jatuh tempo.');
    expect(html).not.toContain('Semua pinjaman tepat waktu');
  });

  it('menyatakan semua beres bila tidak ada yang terlambat maupun jatuh tempo hari ini', async () => {
    mockStats.mockResolvedValueOnce({ ...stats, overdueLoans: 0, overdueCopies: 0 });
    const html = await render();
    expect(html).toContain('0 transaksi');
    expect(html).toContain('0 pinjaman');
    expect(html).toContain('Semua pinjaman tepat waktu. Tidak ada yang perlu ditindaklanjuti.');
  });

  it('mendaftar pinjaman yang jatuh tempo hari ini dengan tautan ke transaksinya', async () => {
    mockDueToday.mockResolvedValueOnce([{
      id: 'd1', transactionNumber: 'PJM-20900227-0004', studentName: 'Ahmad Fauzi',
      studentNis: '202600123', studentClass: 'XI RPL 1', openCount: 2,
    }]);

    const html = await render();

    expect(mockDueToday).toHaveBeenCalledWith('2090-03-02');
    expect(html).toContain('Jatuh tempo hari ini');
    expect(html).toContain('1 pinjaman');
    expect(html).toContain('href="/transaksi/riwayat/d1"');
    expect(html).toContain('Ahmad Fauzi');
    expect(html).toContain('PJM-20900227-0004');
    expect(html).toContain('2 buku');
  });

  it('menampilkan pesan bila belum ada transaksi', async () => {
    expect(await render()).toContain('Belum ada transaksi.');
  });

  it('menampilkan delapan transaksi terbaru dari riwayat', async () => {
    mockListLoans.mockResolvedValueOnce({ rows: Array.from({ length: 10 }, (_, index) => loanRow(index + 1)), total: 10 });

    const html = await render();

    expect(mockListLoans).toHaveBeenCalledWith({ q: '', status: 'all', page: 1 }, '2090-03-02');
    expect(html).toContain('PJM-20900302-0008');
    expect(html).not.toContain('PJM-20900302-0009');
    expect(html).toContain('Lihat semua');
    expect(html).toContain('href="/transaksi/riwayat"');
  });
});
