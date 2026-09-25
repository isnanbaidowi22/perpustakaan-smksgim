import { describe, expect, it } from 'vitest';
import { validateLoanRequest, type LoanRequestInput } from './rules';
import type { CopySnapshot, LibrarySettings, StudentSnapshot } from '../shared/types';
import type { Violation, ViolationCode } from '../shared/violations';

const settings: LibrarySettings = {
  maxActiveLoans: 3,
  loanDurationDays: 3,
  finePerDay: 1000,
  blockWhenOverdue: true,
  blockWhenUnpaidFine: false,
};

const student: StudentSnapshot = {
  id: 'stu-1',
  nis: '202600123',
  name: 'Ahmad Fauzi',
  className: 'XI RPL 1',
  status: 'active',
};

function copy(overrides: Partial<CopySnapshot> = {}): CopySnapshot {
  return {
    id: 'copy-1',
    barcode: 'BK-000123',
    status: 'TERSEDIA',
    bookTitle: 'Pemrograman Web',
    bookStatus: 'active',
    ...overrides,
  };
}

function request(overrides: Partial<LoanRequestInput> = {}): LoanRequestInput {
  return {
    student,
    openLoans: [],
    requestedCopies: [copy()],
    settings,
    hasActiveAcademicYear: true,
    today: '2026-09-21',
    ...overrides,
  };
}

function codesOf(result: ReturnType<typeof validateLoanRequest>): ViolationCode[] {
  return result.ok ? [] : result.violations.map((v: Violation) => v.code);
}

describe('validateLoanRequest — jalur normal', () => {
  it('menerima permintaan yang memenuhi seluruh aturan', () => {
    expect(validateLoanRequest(request())).toEqual({ ok: true });
  });

  it('menerima permintaan yang tepat mengisi sisa kuota', () => {
    const result = validateLoanRequest(request({
      openLoans: [{ id: 'l1', transactionNumber: 'PJM-20260920-0001', dueDate: '2026-09-23', openItemCount: 2, unpaidFine: 0 }],
      requestedCopies: [copy()],
    }));
    expect(result).toEqual({ ok: true });
  });
});

describe('validateLoanRequest — prasyarat', () => {
  it('menolak bila tidak ada tahun ajaran aktif', () => {
    expect(codesOf(validateLoanRequest(request({ hasActiveAcademicYear: false })))).toContain('NO_ACTIVE_YEAR');
  });

  it('menolak bila tidak ada buku yang dipilih', () => {
    expect(codesOf(validateLoanRequest(request({ requestedCopies: [] })))).toContain('NO_COPY_SELECTED');
  });

  it('menolak siswa tidak aktif', () => {
    const result = validateLoanRequest(request({ student: { ...student, status: 'inactive' } }));
    expect(result).toEqual({
      ok: false,
      violations: [{ code: 'STUDENT_INACTIVE', studentName: 'Ahmad Fauzi' }],
    });
  });
});

describe('validateLoanRequest — kuota', () => {
  it('menolak bila permintaan melewati batas maksimal', () => {
    const result = validateLoanRequest(request({
      openLoans: [{ id: 'l1', transactionNumber: 'PJM-20260920-0001', dueDate: '2026-09-23', openItemCount: 3, unpaidFine: 0 }],
    }));
    expect(result).toEqual({
      ok: false,
      violations: [{
        code: 'QUOTA_EXCEEDED',
        studentName: 'Ahmad Fauzi',
        activeCount: 3,
        requestedCount: 1,
        maxActiveLoans: 3,
      }],
    });
  });

  it('menjumlahkan eksemplar terbuka dari beberapa peminjaman', () => {
    const result = validateLoanRequest(request({
      openLoans: [
        { id: 'l1', transactionNumber: 'PJM-20260920-0001', dueDate: '2026-09-23', openItemCount: 1, unpaidFine: 0 },
        { id: 'l2', transactionNumber: 'PJM-20260920-0002', dueDate: '2026-09-23', openItemCount: 2, unpaidFine: 0 },
      ],
    }));
    expect(codesOf(result)).toContain('QUOTA_EXCEEDED');
  });

  it('menghitung seluruh buku dalam satu permintaan terhadap kuota', () => {
    const result = validateLoanRequest(request({
      requestedCopies: [
        copy({ id: 'c1', barcode: 'BK-000001' }),
        copy({ id: 'c2', barcode: 'BK-000002' }),
        copy({ id: 'c3', barcode: 'BK-000003' }),
        copy({ id: 'c4', barcode: 'BK-000004' }),
      ],
    }));
    expect(codesOf(result)).toContain('QUOTA_EXCEEDED');
  });

  it('menghormati batas yang dikonfigurasi, bukan angka tiga yang tetap', () => {
    const result = validateLoanRequest(request({
      settings: { ...settings, maxActiveLoans: 5 },
      openLoans: [{ id: 'l1', transactionNumber: 'PJM-20260920-0001', dueDate: '2026-09-23', openItemCount: 3, unpaidFine: 0 }],
    }));
    expect(result).toEqual({ ok: true });
  });
});

describe('validateLoanRequest — keterlambatan', () => {
  const overdue = {
    id: 'l1', transactionNumber: 'PJM-20260917-0003',
    dueDate: '2026-09-17', openItemCount: 1, unpaidFine: 0,
  };

  it('menolak siswa yang punya pinjaman terlambat', () => {
    const result = validateLoanRequest(request({ openLoans: [overdue] }));
    expect(result).toEqual({
      ok: false,
      violations: [{
        code: 'HAS_OVERDUE',
        studentName: 'Ahmad Fauzi',
        transactionNumber: 'PJM-20260917-0003',
        daysLate: 4,
      }],
    });
  });

  it('tidak menganggap terlambat pinjaman yang jatuh tempo hari ini', () => {
    const result = validateLoanRequest(request({
      openLoans: [{ ...overdue, dueDate: '2026-09-21' }],
    }));
    expect(result).toEqual({ ok: true });
  });

  it('melewati pemeriksaan bila blockWhenOverdue dimatikan', () => {
    const result = validateLoanRequest(request({
      openLoans: [overdue],
      settings: { ...settings, blockWhenOverdue: false },
    }));
    expect(result).toEqual({ ok: true });
  });
});

describe('validateLoanRequest — ketersediaan eksemplar', () => {
  it('menolak eksemplar yang sedang dipinjam beserta identitas peminjamnya', () => {
    const result = validateLoanRequest(request({
      requestedCopies: [copy({
        status: 'DIPINJAM',
        borrowedBy: { name: 'Siti Aminah', nis: '202600456', dueDate: '2026-09-24' },
      })],
    }));
    expect(result).toEqual({
      ok: false,
      violations: [{
        code: 'COPY_UNAVAILABLE',
        barcode: 'BK-000123',
        bookTitle: 'Pemrograman Web',
        status: 'DIPINJAM',
        borrowedBy: { name: 'Siti Aminah', nis: '202600456', dueDate: '2026-09-24' },
      }],
    });
  });

  it.each(['RUSAK', 'HILANG', 'NONAKTIF'] as const)('menolak eksemplar berstatus %s', (status) => {
    const result = validateLoanRequest(request({ requestedCopies: [copy({ status })] }));
    expect(codesOf(result)).toContain('COPY_UNAVAILABLE');
  });

  it('menolak eksemplar yang sama dimasukkan dua kali', () => {
    const result = validateLoanRequest(request({
      requestedCopies: [copy(), copy()],
    }));
    expect(codesOf(result)).toContain('DUPLICATE_COPY');
  });

  it('tidak menghitung eksemplar ganda dua kali terhadap kuota', () => {
    const result = validateLoanRequest(request({
      openLoans: [{ id: 'l1', transactionNumber: 'PJM-20260920-0001', dueDate: '2026-09-23', openItemCount: 2, unpaidFine: 0 }],
      requestedCopies: [copy(), copy()],
    }));
    expect(codesOf(result)).not.toContain('QUOTA_EXCEEDED');
  });
});

describe('validateLoanRequest — tunggakan denda', () => {
  const unpaid = {
    id: 'l1', transactionNumber: 'PJM-20260910-0001',
    dueDate: '2026-09-23', openItemCount: 1, unpaidFine: 4000,
  };

  it('mengizinkan peminjaman meski ada tunggakan, sesuai bawaan', () => {
    expect(validateLoanRequest(request({ openLoans: [unpaid] }))).toEqual({ ok: true });
  });

  it('menolak bila blockWhenUnpaidFine dinyalakan', () => {
    const result = validateLoanRequest(request({
      openLoans: [unpaid],
      settings: { ...settings, blockWhenUnpaidFine: true },
    }));
    expect(result).toEqual({
      ok: false,
      violations: [{ code: 'UNPAID_FINE', studentName: 'Ahmad Fauzi', amount: 4000 }],
    });
  });
});

describe('validateLoanRequest — pelanggaran majemuk', () => {
  it('melaporkan seluruh pelanggaran sekaligus, bukan hanya yang pertama', () => {
    const result = validateLoanRequest(request({
      student: { ...student, status: 'inactive' },
      openLoans: [{ id: 'l1', transactionNumber: 'PJM-20260917-0003', dueDate: '2026-09-17', openItemCount: 3, unpaidFine: 0 }],
      requestedCopies: [copy({ status: 'RUSAK' })],
    }));
    const codes = codesOf(result);
    expect(codes).toContain('STUDENT_INACTIVE');
    expect(codes).toContain('QUOTA_EXCEEDED');
    expect(codes).toContain('HAS_OVERDUE');
    expect(codes).toContain('COPY_UNAVAILABLE');
  });
});

describe('validateLoanRequest — buku nonaktif', () => {
  it('menolak eksemplar milik buku nonaktif dengan BOOK_INACTIVE, bukan COPY_UNAVAILABLE', () => {
    const result = validateLoanRequest(request({
      requestedCopies: [copy({ bookStatus: 'inactive', status: 'DIPINJAM' })],
    }));
    expect(result).toEqual({
      ok: false,
      violations: [{ code: 'BOOK_INACTIVE', barcode: 'BK-000123', bookTitle: 'Pemrograman Web' }],
    });
  });
});

describe('validateLoanRequest — pinjaman selesai yang dendanya belum lunas', () => {
  const settled = {
    id: 'l9', transactionNumber: 'PJM-20260901-0001',
    dueDate: '2026-09-04', openItemCount: 0, unpaidFine: 5000,
  };

  it('tidak menganggap pinjaman tanpa eksemplar terbuka sebagai terlambat', () => {
    expect(validateLoanRequest(request({ openLoans: [settled] }))).toEqual({ ok: true });
  });

  it('tetap menghitung dendanya bila blockWhenUnpaidFine dinyalakan', () => {
    const result = validateLoanRequest(request({
      openLoans: [settled],
      settings: { ...settings, blockWhenUnpaidFine: true },
    }));
    expect(result).toEqual({
      ok: false,
      violations: [{ code: 'UNPAID_FINE', studentName: 'Ahmad Fauzi', amount: 5000 }],
    });
  });
});
