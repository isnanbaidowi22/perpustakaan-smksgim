import { describe, expect, it } from 'vitest';
import type { BorrowerCard, CopyLookup } from '@/server/queries/circulation';
import { cardWarnings, deskReducer, INITIAL_DESK, remainingSlots, type DeskState } from './desk-state';

function card(overrides: Partial<BorrowerCard> = {}): BorrowerCard {
  return {
    student: { id: 's1', nis: '202600123', name: 'Ahmad Fauzi', className: 'XI RPL 1', status: 'active' },
    activeCount: 0,
    maxActiveLoans: 3,
    overdue: [],
    unpaidFine: 0,
    blockWhenOverdue: true,
    blockWhenUnpaidFine: false,
    ...overrides,
  };
}

function copy(overrides: Partial<CopyLookup> = {}): CopyLookup {
  return {
    id: 'c1',
    barcode: 'BK-000123',
    status: 'TERSEDIA',
    bookId: 'b1',
    bookTitle: 'Pemrograman Web',
    bookStatus: 'active',
    rackCode: 'A-3',
    ...overrides,
  };
}

function withStudent(overrides: Partial<BorrowerCard> = {}): DeskState {
  return deskReducer(INITIAL_DESK, { type: 'selectStudent', card: card(overrides) });
}

describe('deskReducer — menambah eksemplar', () => {
  it('menambahkan eksemplar yang tersedia dan mengurangi sisa slot', () => {
    const state = deskReducer(withStudent({ activeCount: 1 }), { type: 'addCopy', copy: copy() });

    expect(state.copies).toEqual([{ id: 'c1', barcode: 'BK-000123', bookTitle: 'Pemrograman Web', rackCode: 'A-3' }]);
    expect(state.notice).toBeNull();
    expect(remainingSlots(state)).toBe(1);
  });

  it('menolak eksemplar yang sudah ada di daftar', () => {
    const once = deskReducer(withStudent(), { type: 'addCopy', copy: copy() });
    const twice = deskReducer(once, { type: 'addCopy', copy: copy() });

    expect(twice.copies).toHaveLength(1);
    expect(twice.notice).toBe('Eksemplar BK-000123 sudah ada di daftar.');
  });

  it('menolak eksemplar yang sedang dipinjam siswa lain dan menyebut peminjamnya', () => {
    const state = deskReducer(withStudent(), {
      type: 'addCopy',
      copy: copy({ status: 'DIPINJAM', borrowedBy: { name: 'Siti Aminah', nis: '202600456', dueDate: '2026-09-24' } }),
    });

    expect(state.copies).toEqual([]);
    expect(state.notice).toBe('Eksemplar BK-000123 sedang dipinjam — Siti Aminah (NIS 202600456), jatuh tempo 24/09/2026. Pilih eksemplar lain.');
  });

  it('menolak eksemplar rusak dan eksemplar milik buku nonaktif', () => {
    expect(deskReducer(withStudent(), { type: 'addCopy', copy: copy({ status: 'RUSAK' }) }).notice)
      .toBe('Eksemplar BK-000123 berstatus rusak — "Pemrograman Web" tidak dapat dipinjam. Pilih eksemplar lain.');
    expect(deskReducer(withStudent(), { type: 'addCopy', copy: copy({ bookStatus: 'inactive' }) }).notice)
      .toBe('Buku "Pemrograman Web" nonaktif — Eksemplar BK-000123 tidak dapat dipinjam. Aktifkan bukunya di Master Data → Buku bila masih dipakai.');
  });

  it('menolak eksemplar yang melebihi sisa kuota siswa', () => {
    const state = deskReducer(withStudent({ activeCount: 3 }), { type: 'addCopy', copy: copy() });

    expect(state.copies).toEqual([]);
    expect(state.notice).toBe('Kuota penuh: Ahmad Fauzi hanya boleh meminjam 3 buku sekaligus.');
  });

  it('mengizinkan memindai buku sebelum siswa dipilih', () => {
    const state = deskReducer(INITIAL_DESK, { type: 'addCopy', copy: copy() });
    expect(state.copies).toHaveLength(1);
    expect(remainingSlots(state)).toBeNull();
  });
});

describe('deskReducer — aksi lain', () => {
  it('menghapus eksemplar, mengganti siswa tanpa membuang daftar buku, dan mengosongkan semuanya', () => {
    const filled = deskReducer(withStudent(), { type: 'addCopy', copy: copy() });

    expect(deskReducer(filled, { type: 'removeCopy', id: 'c1' }).copies).toEqual([]);
    const cleared = deskReducer(filled, { type: 'clearStudent' });
    expect(cleared.student).toBeNull();
    expect(cleared.copies).toHaveLength(1);
    expect(deskReducer(filled, { type: 'reset' })).toEqual(INITIAL_DESK);
    expect(deskReducer(filled, { type: 'notice', message: 'Barcode tidak terdaftar.' }).notice).toBe('Barcode tidak terdaftar.');
  });
});

describe('deskReducer — mengganti siswa dengan buku sudah di daftar', () => {
  it('tidak mengatur notice ketika daftar buku masih kosong', () => {
    const state = deskReducer(INITIAL_DESK, { type: 'selectStudent', card: card() });
    expect(state.notice).toBeNull();
  });

  it('mengatur notice yang menyebut jumlah buku dan nama siswa baru ketika daftar tidak kosong', () => {
    const filled = deskReducer(withStudent(), { type: 'addCopy', copy: copy() });
    const switched = deskReducer(filled, {
      type: 'selectStudent',
      card: card({ student: { id: 's2', nis: '202600789', name: 'Budi Santoso', className: 'XI RPL 2', status: 'active' } }),
    });

    expect(switched.notice).toBe('1 buku di daftar akan dipinjamkan ke Budi Santoso.');
  });

  it('menyebut kuota tidak cukup ketika daftar buku melebihi sisa kuota siswa baru', () => {
    const filled = deskReducer(withStudent(), { type: 'addCopy', copy: copy() });
    const switched = deskReducer(filled, {
      type: 'selectStudent',
      card: card({
        student: { id: 's2', nis: '202600789', name: 'Budi Santoso', className: 'XI RPL 2', status: 'active' },
        activeCount: 3,
        maxActiveLoans: 3,
      }),
    });

    expect(switched.notice).toBe('1 buku di daftar akan dipinjamkan ke Budi Santoso, tetapi sisa kuotanya hanya 0. Kurangi daftar buku.');
  });
});

describe('cardWarnings', () => {
  it('menyatakan tidak ada masalah untuk siswa yang bersih', () => {
    expect(cardWarnings(card())).toEqual([{ tone: 'ok', text: 'Tidak ada keterlambatan atau tunggakan denda.' }]);
  });

  it('menandai hal yang akan menolak peminjaman sebagai blokir dan sisanya sebagai peringatan', () => {
    expect(cardWarnings(card({
      student: { id: 's1', nis: '202600123', name: 'Ahmad Fauzi', className: 'XI RPL 1', status: 'inactive' },
      activeCount: 3,
      overdue: [{ transactionNumber: 'PJM-20260917-0003', daysLate: 4 }],
      unpaidFine: 4000,
    }))).toEqual([
      { tone: 'block', text: 'Ahmad Fauzi berstatus nonaktif; peminjaman akan ditolak.' },
      { tone: 'block', text: 'Kuota penuh. Kembalikan salah satu buku terlebih dahulu.' },
      { tone: 'block', text: 'PJM-20260917-0003 terlambat 4 hari. Selesaikan dahulu sebelum meminjam.' },
      { tone: 'warn', text: 'Tunggakan denda Rp4.000.' },
    ]);
  });

  it('menurunkan keterlambatan menjadi peringatan bila blokir dimatikan, dan tunggakan menjadi blokir bila dinyalakan', () => {
    expect(cardWarnings(card({
      overdue: [{ transactionNumber: 'PJM-20260917-0003', daysLate: 4 }],
      unpaidFine: 4000,
      blockWhenOverdue: false,
      blockWhenUnpaidFine: true,
    }))).toEqual([
      { tone: 'warn', text: 'PJM-20260917-0003 terlambat 4 hari.' },
      { tone: 'block', text: 'Tunggakan denda Rp4.000. Lunasi dahulu sebelum meminjam.' },
    ]);
  });
});
