import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LOAN_SAVE_FAILED } from '@/lib/circulation-results';

const {
  mockRequireActor, mockSearch, mockCard, mockFindCopy, mockCreateLoan, mockRevalidatePath, mockCreateStudent,
  mockSearchBooks, mockPickCopy,
} = vi.hoisted(() => ({
  mockRequireActor: vi.fn(),
  mockSearch: vi.fn(),
  mockCard: vi.fn(),
  mockFindCopy: vi.fn(),
  mockCreateLoan: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockCreateStudent: vi.fn(),
  mockSearchBooks: vi.fn(),
  mockPickCopy: vi.fn(),
}));

vi.mock('@/server/auth/guard', () => ({ requireActor: mockRequireActor }));
vi.mock('@/server/queries/circulation', () => ({
  searchBorrowers: mockSearch,
  getBorrowerCard: mockCard,
  findCopyByBarcode: mockFindCopy,
  searchLoanableBooks: mockSearchBooks,
  pickAvailableCopy: mockPickCopy,
}));
vi.mock('@/server/services/loans', () => ({ createLoan: mockCreateLoan }));
vi.mock('@/server/services/students', () => ({ createStudent: mockCreateStudent }));
vi.mock('@/lib/school-date', () => ({ schoolToday: () => '2090-03-02' }));
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }));

import {
  createBorrowerAction, createLoanAction, getBorrowerCardAction, lookupCopyAction, pickCopyAction, searchBorrowersAction, suggestBooksAction,
} from './loans';

const actor = { id: 'u1', role: 'admin' as const };
const studentId = '6f1c2b1e-4b1a-4c3e-9f7a-2d1e3c4b5a6f';
const copyId = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireActor.mockResolvedValue(actor);
});

describe('Server Action baca meja peminjaman', () => {
  it('melempar redirect tanpa membaca data bila pengunjung belum masuk', async () => {
    mockRequireActor.mockRejectedValueOnce(new Error('NEXT_REDIRECT'));

    await expect(searchBorrowersAction('ahmad')).rejects.toThrow('NEXT_REDIRECT');
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('meneruskan pencarian siswa', async () => {
    mockSearch.mockResolvedValueOnce([{ id: studentId }]);
    expect(await searchBorrowersAction('ahmad')).toEqual({ ok: true, data: [{ id: studentId }] });
    expect(mockSearch).toHaveBeenCalledWith('ahmad');
  });

  it('melempar redirect tanpa membaca kartu siswa bila pengunjung belum masuk', async () => {
    mockRequireActor.mockRejectedValueOnce(new Error('NEXT_REDIRECT'));

    await expect(getBorrowerCardAction(studentId)).rejects.toThrow('NEXT_REDIRECT');
    expect(mockCard).not.toHaveBeenCalled();
  });

  it('memuat kartu siswa dengan tanggal sekolah, atau menjelaskan bila tidak ditemukan', async () => {
    mockCard.mockResolvedValueOnce({ activeCount: 1 });
    expect(await getBorrowerCardAction(studentId)).toEqual({ ok: true, data: { activeCount: 1 } });
    expect(mockCard).toHaveBeenCalledWith(studentId, '2090-03-02');

    mockCard.mockResolvedValueOnce(null);
    expect(await getBorrowerCardAction(studentId)).toEqual({
      ok: false, message: 'Siswa tidak ditemukan. Cari ulang dengan nama siswa.',
    });
  });

  it('melempar redirect tanpa membaca barcode bila pengunjung belum masuk', async () => {
    mockRequireActor.mockRejectedValueOnce(new Error('NEXT_REDIRECT'));

    await expect(lookupCopyAction(' xx-9 ')).rejects.toThrow('NEXT_REDIRECT');
    expect(mockFindCopy).not.toHaveBeenCalled();
  });

  it('menambahkan eksemplar langsung bila barcode cocok', async () => {
    mockFindCopy.mockResolvedValueOnce({ id: copyId });
    expect(await lookupCopyAction(' bk-000001 ')).toEqual({ ok: true, data: { kind: 'copy', copy: { id: copyId } } });
    expect(mockSearchBooks).not.toHaveBeenCalled();
  });

  it('mengambilkan eksemplar tersedia bila judul hanya cocok dengan satu buku', async () => {
    mockFindCopy.mockResolvedValueOnce(null);
    mockSearchBooks.mockResolvedValueOnce([{ bookId: 'b1', availableCount: 2 }]);
    mockPickCopy.mockResolvedValueOnce({ id: copyId });

    expect(await lookupCopyAction('pemrograman', ['c9'])).toEqual({ ok: true, data: { kind: 'copy', copy: { id: copyId } } });
    expect(mockSearchBooks).toHaveBeenCalledWith('pemrograman');
    expect(mockPickCopy).toHaveBeenCalledWith('b1', ['c9']);
  });

  it('mengembalikan daftar judul bila cocok dengan beberapa buku', async () => {
    const found = [{ bookId: 'b1', availableCount: 1 }, { bookId: 'b2', availableCount: 0 }];
    mockFindCopy.mockResolvedValueOnce(null);
    mockSearchBooks.mockResolvedValueOnce(found);

    expect(await lookupCopyAction('web')).toEqual({ ok: true, data: { kind: 'books', books: found } });
    expect(mockPickCopy).not.toHaveBeenCalled();
  });

  it('menjelaskan buku yang tidak ditemukan dan isian kosong', async () => {
    mockFindCopy.mockResolvedValueOnce(null);
    mockSearchBooks.mockResolvedValueOnce([]);
    expect(await lookupCopyAction(' xx-9 ')).toEqual({
      ok: false,
      message: 'Buku "xx-9" tidak ditemukan. Periksa barcode, judul, atau ISBN, atau daftarkan bukunya di Master Data → Buku.',
    });
    expect(await lookupCopyAction('  ')).toEqual({
      ok: false, message: 'Pindai barcode, atau ketik judul atau ISBN buku terlebih dahulu.',
    });
  });

  it('suggestBooksAction baru mencari setelah 3 karakter', async () => {
    expect(await suggestBooksAction(' pe ')).toEqual({ ok: true, data: [] });
    expect(mockSearchBooks).not.toHaveBeenCalled();

    mockSearchBooks.mockResolvedValueOnce([{ bookId: 'b1', availableCount: 1 }]);
    expect(await suggestBooksAction('pem')).toEqual({ ok: true, data: [{ bookId: 'b1', availableCount: 1 }] });
    expect(mockSearchBooks).toHaveBeenCalledWith('pem');
  });

  it('pickCopyAction menjelaskan bila judul itu tidak punya eksemplar tersedia lagi', async () => {
    mockPickCopy.mockResolvedValueOnce(null);
    expect(await pickCopyAction('b1', [copyId])).toEqual({
      ok: false, message: 'Tidak ada lagi eksemplar tersedia untuk judul ini.',
    });
    expect(mockPickCopy).toHaveBeenCalledWith('b1', [copyId]);
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

describe('createBorrowerAction', () => {
  function studentForm(fields: Record<string, string>) {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.set(key, value);
    return form;
  }

  it('menyimpan siswa baru lalu mengembalikan kartunya agar langsung terpilih', async () => {
    mockCreateStudent.mockResolvedValueOnce({ ok: true, id: studentId });
    mockCard.mockResolvedValueOnce({ activeCount: 0 });

    const result = await createBorrowerAction(studentForm({ name: 'Ahmad Fauzi', className: 'XI RPL 1' }));

    expect(result).toEqual({ ok: true, data: { activeCount: 0 } });
    expect(mockCreateStudent).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Ahmad Fauzi', className: 'XI RPL 1', academicYearId: null }),
      actor,
    );
    expect(mockCard).toHaveBeenCalledWith(studentId, '2090-03-02');
  });

  it('menandai kolom yang tidak valid tanpa menyentuh service', async () => {
    const result = await createBorrowerAction(studentForm({ name: '', className: 'XI RPL 1' }));

    expect(result.ok).toBe(false);
    if (!result.ok && result.state.status === 'error') {
      expect(Object.keys(result.state.fieldErrors)).toEqual(['name']);
      expect(result.state.values.className).toBe('XI RPL 1');
    }
    expect(mockCreateStudent).not.toHaveBeenCalled();
  });

  it('meneruskan galat service ke kolom yang disebutnya', async () => {
    mockCreateStudent.mockResolvedValueOnce({ ok: false, message: 'Kelas tidak dikenal.', field: 'className' });

    const result = await createBorrowerAction(studentForm({ name: 'Ahmad', className: 'X' }));

    expect(result.ok).toBe(false);
    if (!result.ok && result.state.status === 'error') {
      expect(result.state.fieldErrors).toEqual({ className: ['Kelas tidak dikenal.'] });
    }
  });
});
