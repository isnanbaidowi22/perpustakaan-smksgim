import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockGetLoanDetail, mockNotFound } = vi.hoisted(() => ({
  mockGetLoanDetail: vi.fn(),
  mockNotFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('@/server/queries/loans', () => ({ getLoanDetail: mockGetLoanDetail }));
vi.mock('@/server/actions/fines', () => ({ payFineAction: vi.fn() }));
vi.mock('@/lib/school-date', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/school-date')>()),
  schoolToday: () => '2090-03-09',
}));
vi.mock('@/server/auth/guard', () => ({
  requireProfile: vi.fn(async () => ({ id: 'u1', role: 'petugas', fullName: 'Petugas', status: 'active' })),
}));
vi.mock('next/navigation', () => ({ notFound: mockNotFound }));

import LoanDetailPage from './page';

const baseLoan = {
  id: 'l1',
  transactionNumber: 'PJM-20900302-0001',
  status: 'SEBAGIAN_KEMBALI' as const,
  loanDate: '2090-03-02',
  dueDate: '2090-03-05',
  notes: null,
  studentId: 's1',
  studentName: 'Ahmad Fauzi',
  studentNis: '202600123',
  studentClass: 'XI RPL 1',
  academicYearName: '2089/2090',
  createdByName: 'Petugas Perpustakaan',
  totalFine: 54000,
  paidTotal: 4000,
  unpaidFine: 50000,
  daysOverdue: 4,
  items: [
    {
      id: 'i1', bookCopyId: 'c1', barcode: 'BK-000001', bookTitle: 'Pemrograman Web', bookPrice: 50000,
      returnedAt: new Date('2090-03-09T03:00:00Z'), returnCondition: 'RUSAK' as const, daysLate: 4,
      lateFine: 4000, replacementFee: 50000, conditionNote: 'sampul sobek',
    },
    {
      id: 'i2', bookCopyId: 'c2', barcode: 'BK-000002', bookTitle: 'Basis Data', bookPrice: 60000,
      returnedAt: null, returnCondition: null, daysLate: 0, lateFine: 0, replacementFee: 0, conditionNote: null,
    },
  ],
  payments: [
    { id: 'p1', amount: 4000, paidAt: new Date('2090-03-09T04:00:00Z'), receivedByName: 'Petugas Perpustakaan', note: null },
  ],
};

async function render(loan: unknown, params: Record<string, string> = {}) {
  mockGetLoanDetail.mockResolvedValueOnce(loan);
  return renderToStaticMarkup(await LoanDetailPage({
    params: Promise.resolve({ id: 'l1' }),
    searchParams: Promise.resolve(params),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LoanDetailPage', () => {
  it('menampilkan buku, pengembalian, denda, pembayaran, dan pesan sukses', async () => {
    const html = await render(baseLoan, { pesan: 'Pembayaran denda tercatat.' });

    expect(mockGetLoanDetail).toHaveBeenCalledWith('l1', '2090-03-09');
    expect(html).toContain('PJM-20900302-0001');
    expect(html).toContain('Pembayaran denda tercatat.');
    expect(html).toContain('09/03/2090 10.00');
    expect(html).toContain('Rusak');
    expect(html).toContain('sampul sobek');
    expect(html).toContain('Belum kembali');
    expect(html).toContain('Rp54.000');
    expect(html).toContain('Terlambat 4 hari');
  });

  it('mengisi form pelunasan dengan sisa tagihan dan menawarkan proses pengembalian', async () => {
    const html = await render(baseLoan);

    expect(html).toContain('name="amount"');
    expect(html).toContain('value="50000"');
    expect(html).toContain('Tandai Lunas');
    expect(html).toContain('href="/transaksi/pengembalian?q=PJM-20900302-0001&amp;pinjam=l1"');
  });

  it('menyembunyikan form pelunasan dan tombol pengembalian untuk transaksi selesai yang lunas', async () => {
    const html = await render({ ...baseLoan, status: 'SELESAI', unpaidFine: 0, paidTotal: 54000, daysOverdue: 0 });

    expect(html).not.toContain('name="amount"');
    expect(html).not.toContain('/transaksi/pengembalian');
    expect(html).toContain('Lunas');
  });

  it('menampilkan halaman tidak ditemukan untuk transaksi yang tidak ada', async () => {
    mockGetLoanDetail.mockResolvedValueOnce(null);
    await expect(LoanDetailPage({ params: Promise.resolve({ id: 'x' }), searchParams: Promise.resolve({}) }))
      .rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('menawarkan cetak struk, juga untuk transaksi yang sudah selesai', async () => {
    const open = await render(baseLoan);
    expect(open).toContain('href="/cetak/struk/l1"');

    const done = await render({ ...baseLoan, status: 'SELESAI', unpaidFine: 0, paidTotal: 54000, daysOverdue: 0 });
    expect(done).toContain('href="/cetak/struk/l1"');
  });
});
