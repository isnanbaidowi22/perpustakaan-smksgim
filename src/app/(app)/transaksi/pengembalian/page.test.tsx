import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockFind, mockDetail } = vi.hoisted(() => ({ mockFind: vi.fn(), mockDetail: vi.fn() }));

vi.mock('@/server/queries/loans', () => ({ findLoansForReturn: mockFind, getLoanDetail: mockDetail }));
vi.mock('@/server/queries/settings', () => ({ getLibrarySettings: vi.fn(async () => ({ finePerDay: 1000 })) }));
vi.mock('@/server/actions/returns', () => ({ processReturnAction: vi.fn() }));
vi.mock('@/lib/school-date', () => ({ schoolToday: () => '2090-03-09' }));
vi.mock('@/server/auth/guard', () => ({
  requireProfile: vi.fn(async () => ({ id: 'u1', role: 'petugas', fullName: 'Petugas', status: 'active' })),
}));

import ReturnPage from './page';

const candidate = {
  id: 'l1', transactionNumber: 'PJM-20900302-0001', studentName: 'Ahmad Fauzi', studentNis: '202600123',
  studentClass: 'XI RPL 1', loanDate: '2090-03-02', dueDate: '2090-03-05', openCount: 1, daysOverdue: 4,
};

const detail = {
  ...candidate,
  status: 'SEBAGIAN_KEMBALI',
  notes: null,
  studentId: 's1',
  academicYearName: '2089/2090',
  createdByName: 'Petugas',
  totalFine: 0,
  paidTotal: 0,
  unpaidFine: 0,
  items: [
    {
      id: 'i1', bookCopyId: 'c1', barcode: 'BK-000001', bookTitle: 'Pemrograman Web', bookPrice: 85000,
      returnedAt: new Date(), returnCondition: 'BAIK', daysLate: 0, lateFine: 0, replacementFee: 0, conditionNote: null,
    },
    {
      id: 'i2', bookCopyId: 'c2', barcode: 'BK-000002', bookTitle: 'Basis Data', bookPrice: 60000,
      returnedAt: null, returnCondition: null, daysLate: 0, lateFine: 0, replacementFee: 0, conditionNote: null,
    },
  ],
  payments: [],
};

async function render(params: Record<string, string> = {}) {
  return renderToStaticMarkup(await ReturnPage({ searchParams: Promise.resolve(params) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFind.mockResolvedValue([]);
  mockDetail.mockResolvedValue(null);
});

describe('ReturnPage', () => {
  it('memfokuskan kolom pencarian universal saat dibuka tanpa kata kunci', async () => {
    const html = await render();
    expect(html).toMatch(/<input[^>]*autofocus=""/i);
    expect(mockFind).not.toHaveBeenCalled();
  });

  it('langsung membuka satu-satunya pinjaman yang cocok, hanya dengan buku yang belum kembali', async () => {
    mockFind.mockResolvedValueOnce([candidate]);
    mockDetail.mockResolvedValueOnce(detail);

    const html = await render({ q: '202600123' });

    expect(mockFind).toHaveBeenCalledWith('202600123', '2090-03-09');
    expect(mockDetail).toHaveBeenCalledWith('l1', '2090-03-09');
    expect(html).toContain('BK-000002');
    expect(html).not.toContain('BK-000001');
    expect(html).toContain('Terlambat 4 hari');
    expect(html).toContain('Simpan Pengembalian');
    expect(html).toContain('Rp4.000');
  });

  it('menampilkan daftar pilihan bila lebih dari satu pinjaman cocok', async () => {
    mockFind.mockResolvedValueOnce([candidate, { ...candidate, id: 'l2', transactionNumber: 'PJM-20900302-0002' }]);

    const html = await render({ q: 'ahmad' });

    expect(mockDetail).not.toHaveBeenCalled();
    expect(html).toContain('href="/transaksi/pengembalian?q=ahmad&amp;pinjam=l2"');
  });

  it('menjelaskan bila tidak ada pinjaman terbuka yang cocok', async () => {
    const html = await render({ q: 'tidak-ada' });
    expect(html).toContain('Tidak ada peminjaman yang masih berjalan untuk &quot;tidak-ada&quot;.');
  });

  it('mencentang hanya buku yang dipindai bila pencarian sama dengan barcode salah satu buku (I1)', async () => {
    const bothOpen = {
      ...detail,
      items: detail.items.map((item) => ({ ...item, returnedAt: null, returnCondition: null })),
    };
    mockDetail.mockResolvedValueOnce(bothOpen);

    const html = await render({ q: 'BK-000002', pinjam: 'l1' });

    expect(html).not.toMatch(/id="kembali-i1"[^>]*checked=""/);
    expect(html).toMatch(/id="kembali-i2"[^>]*checked=""/);
  });

  it('mengarahkan ke riwayat bila pinjaman yang dipilih sudah selesai', async () => {
    mockDetail.mockResolvedValueOnce({ ...detail, status: 'SELESAI' });
    const html = await render({ pinjam: 'l1' });
    expect(html).toContain('sudah selesai');
    expect(html).toContain('href="/transaksi/riwayat/l1"');
  });
});
