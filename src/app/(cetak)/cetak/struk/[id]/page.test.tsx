import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockGetLoanDetail, mockSettings, mockNotFound } = vi.hoisted(() => ({
  mockGetLoanDetail: vi.fn(),
  mockSettings: vi.fn(),
  mockNotFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('@/server/queries/loans', () => ({ getLoanDetail: mockGetLoanDetail }));
vi.mock('@/server/queries/settings', () => ({ getLibrarySettings: mockSettings }));
vi.mock('@/lib/school-date', () => ({
  schoolToday: () => '2090-03-09',
  formatSchoolDateTime: () => '09/03/2090 10.15',
}));
vi.mock('@/server/auth/guard', () => ({
  requireProfile: vi.fn(async () => ({ id: 'u1', role: 'petugas', fullName: 'Petugas', status: 'active' })),
}));
vi.mock('next/navigation', () => ({ notFound: mockNotFound }));

import ReceiptPage from './page';

const loan = {
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
  createdByName: 'Siti Petugas',
  totalFine: 0,
  paidTotal: 0,
  unpaidFine: 0,
  daysOverdue: 4,
  items: [
    {
      id: 'i1', bookCopyId: 'c1', barcode: 'BK-000001', bookTitle: 'Pemrograman Web', bookPrice: 85000,
      returnedAt: new Date('2090-03-04T03:00:00Z'), returnCondition: 'BAIK' as const, daysLate: 0,
      lateFine: 0, replacementFee: 0, conditionNote: null,
    },
    {
      id: 'i2', bookCopyId: 'c2', barcode: 'BK-000002', bookTitle: 'Basis Data', bookPrice: 60000,
      returnedAt: null, returnCondition: null, daysLate: 0, lateFine: 0, replacementFee: 0, conditionNote: null,
    },
  ],
  payments: [],
};

const settings = {
  maxActiveLoans: 3, loanDurationDays: 3, finePerDay: 1000, blockWhenOverdue: true, blockWhenUnpaidFine: false,
  schoolName: 'SMK Negeri 1 Contoh', receiptFooter: 'Terima kasih. Simpan struk ini.',
};

async function render(params: Record<string, string> = {}, id = 'l1') {
  return renderToStaticMarkup(await ReceiptPage({
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve(params),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetLoanDetail.mockResolvedValue(loan);
  mockSettings.mockResolvedValue(settings);
});

describe('ReceiptPage', () => {
  it('memuat isi struk sesuai spec 8.5, termasuk buku yang sudah kembali', async () => {
    const html = await render();

    expect(mockGetLoanDetail).toHaveBeenCalledWith('l1', '2090-03-09');
    expect(html).toContain('SMK Negeri 1 Contoh');
    expect(html).toContain('STRUK PEMINJAMAN BUKU');
    expect(html).toContain('PJM-20900302-0001');
    expect(html).toContain('Ahmad Fauzi');
    expect(html).toContain('202600123');
    expect(html).toContain('XI RPL 1');
    expect(html).toContain('02/03/2090');
    expect(html).toContain('05/03/2090');
    expect(html).toContain('Pemrograman Web');
    expect(html).toContain('BK-000001');
    expect(html).toContain('Basis Data');
    expect(html).toContain('BK-000002');
    expect(html).toContain('Jumlah: 2 buku');
    expect(html).toContain('Petugas: Siti Petugas');
    expect(html).toContain('Dicetak: 09/03/2090 10.15');
    expect(html).toContain('Terima kasih. Simpan struk ini.');
    expect(html).toContain('aria-label="Barcode PJM-20900302-0001"');
  });

  it('memakai kertas 58 mm secara bawaan dan 80 mm bila diminta', async () => {
    const narrow = await render();
    expect(narrow).toContain('@page { size: 58mm 148mm; margin: 0; }');
    expect(narrow).toContain('w-[58mm]');
    expect(narrow).toContain('href="/cetak/struk/l1?lebar=80"');

    const wide = await render({ lebar: '80' });
    expect(wide).toContain('@page { size: 80mm 148mm; margin: 0; }');
    expect(wide).toContain('w-[80mm]');
    expect(wide).toContain('href="/cetak/struk/l1"');
  });

  it('memakai nama bawaan dan melewati catatan kaki yang kosong', async () => {
    mockSettings.mockResolvedValueOnce({ ...settings, schoolName: '  ', receiptFooter: null });

    const html = await render();

    expect(html).toContain('Perpustakaan Sekolah');
    expect(html).toContain('@page { size: 58mm 134mm; margin: 0; }');
  });

  it('mencetak catatan transaksi bila ada', async () => {
    mockGetLoanDetail.mockResolvedValueOnce({ ...loan, notes: 'Untuk tugas kelompok' });
    expect(await render()).toContain('Catatan: Untuk tugas kelompok');
  });

  it('menampilkan halaman tidak ditemukan untuk transaksi yang tidak ada', async () => {
    mockGetLoanDetail.mockResolvedValueOnce(null);
    await expect(render({}, 'bukan-uuid')).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
