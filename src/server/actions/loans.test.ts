import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LOAN_SAVE_FAILED } from '@/lib/circulation-results';

const {
  mockAuthorize, mockSearch, mockCard, mockFindCopy, mockCreateLoan, mockRevalidatePath,
} = vi.hoisted(() => ({
  mockAuthorize: vi.fn(),
  mockSearch: vi.fn(),
  mockCard: vi.fn(),
  mockFindCopy: vi.fn(),
  mockCreateLoan: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

vi.mock('@/server/auth/guard', () => ({ authorize: mockAuthorize }));
vi.mock('@/server/queries/circulation', () => ({
  searchBorrowers: mockSearch,
  getBorrowerCard: mockCard,
  findCopyByBarcode: mockFindCopy,
}));
vi.mock('@/server/services/loans', () => ({ createLoan: mockCreateLoan }));
vi.mock('@/lib/school-date', () => ({ schoolToday: () => '2090-03-02' }));
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }));

import {
  createLoanAction, getBorrowerCardAction, lookupCopyAction, searchBorrowersAction,
} from './loans';

const actor = { id: 'u1', role: 'petugas' as const };
const studentId = '6f1c2b1e-4b1a-4c3e-9f7a-2d1e3c4b5a6f';
const copyId = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthorize.mockResolvedValue({ ok: true, actor });
});

describe('Server Action baca meja peminjaman', () => {
  it('menolak tanpa membaca data bila peran tidak diizinkan', async () => {
    mockAuthorize.mockResolvedValueOnce({ ok: false, message: 'Akses ditolak.' });

    expect(await searchBorrowersAction('ahmad')).toEqual({ ok: false, message: 'Akses ditolak.' });
    expect(mockAuthorize).toHaveBeenCalledWith(['admin', 'petugas']);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('meneruskan pencarian siswa', async () => {
    mockSearch.mockResolvedValueOnce([{ id: studentId }]);
    expect(await searchBorrowersAction('ahmad')).toEqual({ ok: true, data: [{ id: studentId }] });
    expect(mockSearch).toHaveBeenCalledWith('ahmad');
  });

  it('memuat kartu siswa dengan tanggal sekolah, atau menjelaskan bila tidak ditemukan', async () => {
    mockCard.mockResolvedValueOnce({ activeCount: 1 });
    expect(await getBorrowerCardAction(studentId)).toEqual({ ok: true, data: { activeCount: 1 } });
    expect(mockCard).toHaveBeenCalledWith(studentId, '2090-03-02');

    mockCard.mockResolvedValueOnce(null);
    expect(await getBorrowerCardAction(studentId)).toEqual({
      ok: false, message: 'Siswa tidak ditemukan. Cari ulang dengan NIS atau nama.',
    });
  });

  it('menjelaskan barcode yang tidak terdaftar dan barcode kosong', async () => {
    mockFindCopy.mockResolvedValueOnce(null);
    expect(await lookupCopyAction(' xx-9 ')).toEqual({
      ok: false,
      message: 'Barcode XX-9 tidak terdaftar. Periksa label buku, atau daftarkan eksemplarnya di Master Data → Buku.',
    });
    expect(await lookupCopyAction('  ')).toEqual({ ok: false, message: 'Pindai atau ketik barcode buku terlebih dahulu.' });
  });
});

describe('createLoanAction', () => {
  const input = { studentId, copyIds: [copyId], notes: '' };

  it('menyimpan dengan tanggal sekolah dan mengembalikan nomor transaksi', async () => {
    mockCreateLoan.mockResolvedValueOnce({ ok: true, id: 'l1', transactionNumber: 'PJM-20900302-0001', dueDate: '2090-03-05' });

    expect(await createLoanAction(input)).toEqual({
      status: 'success', loanId: 'l1', transactionNumber: 'PJM-20900302-0001', dueDate: '2090-03-05',
    });
    expect(mockCreateLoan).toHaveBeenCalledWith({ studentId, copyIds: [copyId], notes: null }, actor, '2090-03-02');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/transaksi/riwayat');
  });

  it('meneruskan pelanggaran aturan apa adanya', async () => {
    mockCreateLoan.mockResolvedValueOnce({ ok: false, violations: [{ code: 'NO_ACTIVE_YEAR' }] });
    expect(await createLoanAction(input)).toEqual({ status: 'rejected', violations: [{ code: 'NO_ACTIVE_YEAR' }] });
  });

  it('meneruskan pesan galat service dan galat validasi', async () => {
    mockCreateLoan.mockResolvedValueOnce({ ok: false, message: 'Siswa tidak ditemukan.' });
    expect(await createLoanAction(input)).toEqual({ status: 'error', message: 'Siswa tidak ditemukan.' });

    expect(await createLoanAction({ copyIds: [], notes: '' })).toEqual({ status: 'error', message: 'Pilih siswa terlebih dahulu.' });
  });

  it('mengubah galat database tak terduga menjadi pesan yang meminta petugas memeriksa riwayat', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockCreateLoan.mockRejectedValueOnce(new Error('Connection terminated unexpectedly'));

    expect(await createLoanAction(input))
      .toEqual({ status: 'error', message: LOAN_SAVE_FAILED });
    expect(LOAN_SAVE_FAILED).toBe(
      'Peminjaman belum tersimpan karena gangguan koneksi ke database. Periksa Riwayat Transaksi sebelum menyimpan ulang.',
    );
    expect(quiet).toHaveBeenCalled();
    quiet.mockRestore();
  });
});
