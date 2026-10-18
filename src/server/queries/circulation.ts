import { and, asc, desc, eq, ilike, inArray, isNull, ne, notInArray, or, sql } from 'drizzle-orm';
import { diffDays, type IsoDate } from '@/domain/shared/date';
import type {
  BorrowerSnapshot, CopySnapshot, OpenLoanSnapshot, RecordStatus, StudentSnapshot,
} from '@/domain/shared/types';
import { db } from '@/server/db/client';
import type { Executor } from '@/server/db/executor';
import { bookCopies, books, loanItems, loans, racks, students } from '@/server/db/schema';
import { isUuid } from '@/server/validation/common';
import { containsPattern } from './like';
import { openItemCounts, paidTotals } from './loan-aggregates';
import { getLibrarySettings } from './settings';

export interface BorrowerOption {
  id: string;
  name: string;
  className: string;
  status: RecordStatus;
}

const BORROWER_LIMIT = 8;

/**
 * Pencarian siswa di meja peminjaman menurut nama. Nama yang cocok persis
 * selalu di urutan pertama.
 * Siswa nonaktif ikut tampil agar kartu dapat menjelaskan mengapa ia ditolak.
 */
export async function searchBorrowers(query: string, executor: Executor = db): Promise<BorrowerOption[]> {
  const keyword = query.trim();
  if (!keyword) return [];
  const pattern = containsPattern(keyword);
  return executor
    .select({
      id: students.id,
      name: students.name,
      className: students.className,
      status: students.status,
    })
    .from(students)
    .where(ilike(students.name, pattern))
    .orderBy(desc(sql`lower(${students.name}) = lower(${keyword})`), asc(students.name))
    .limit(BORROWER_LIMIT);
}

/**
 * Peminjaman siswa yang masih berpengaruh pada peminjaman baru: yang masih
 * memiliki eksemplar belum kembali (kuota, keterlambatan), dan yang semua
 * bukunya sudah kembali tetapi dendanya belum lunas (tunggakan).
 */
export async function loadBorrowerLoans(studentId: string, executor: Executor = db): Promise<OpenLoanSnapshot[]> {
  const openItems = openItemCounts(executor);
  const paid = paidTotals(executor);
  const rows = await executor
    .select({
      id: loans.id,
      transactionNumber: loans.transactionNumber,
      dueDate: loans.dueDate,
      openItemCount: sql<number>`coalesce(${openItems.openCount}, 0)`,
      unpaidFine: sql<string>`${loans.totalFine} - coalesce(${paid.paid}, 0)`,
    })
    .from(loans)
    .leftJoin(openItems, eq(openItems.loanId, loans.id))
    .leftJoin(paid, eq(paid.loanId, loans.id))
    .where(and(
      eq(loans.studentId, studentId),
      or(ne(loans.status, 'SELESAI'), sql`${loans.totalFine} > coalesce(${paid.paid}, 0)`),
    ))
    .orderBy(asc(loans.dueDate));

  return rows.map((row) => ({
    ...row,
    openItemCount: Number(row.openItemCount),
    unpaidFine: Math.max(0, Number(row.unpaidFine)),
  }));
}

export interface BorrowerCard {
  student: StudentSnapshot;
  /** Eksemplar yang sedang dipinjam, dari seluruh transaksi. */
  activeCount: number;
  maxActiveLoans: number;
  overdue: { transactionNumber: string; daysLate: number }[];
  unpaidFine: number;
  blockWhenOverdue: boolean;
  blockWhenUnpaidFine: boolean;
}

/**
 * Kartu siswa di meja peminjaman: sisa slot dan peringatan ditampilkan
 * SEBELUM petugas menambahkan buku, sehingga penolakan jarang terjadi (spec 8.2).
 */
export async function getBorrowerCard(
  studentId: string,
  today: IsoDate,
  executor: Executor = db,
): Promise<BorrowerCard | null> {
  if (!isUuid(studentId)) return null;
  const [student] = await executor
    .select({
      id: students.id,
      name: students.name,
      className: students.className,
      status: students.status,
    })
    .from(students)
    .where(eq(students.id, studentId))
    .limit(1);
  if (!student) return null;

  const borrowerLoans = await loadBorrowerLoans(studentId, executor);
  const settings = await getLibrarySettings(executor);

  return {
    student,
    activeCount: borrowerLoans.reduce((sum, loan) => sum + loan.openItemCount, 0),
    maxActiveLoans: settings.maxActiveLoans,
    overdue: borrowerLoans
      .filter((loan) => loan.openItemCount > 0 && diffDays(loan.dueDate, today) > 0)
      .map((loan) => ({ transactionNumber: loan.transactionNumber, daysLate: diffDays(loan.dueDate, today) })),
    unpaidFine: borrowerLoans.reduce((sum, loan) => sum + loan.unpaidFine, 0),
    blockWhenOverdue: settings.blockWhenOverdue,
    blockWhenUnpaidFine: settings.blockWhenUnpaidFine,
  };
}

/** Peminjam eksemplar yang sedang DIPINJAM, untuk pesan "sedang dipinjam oleh …" (spec §9). */
export async function borrowersOf(copyIds: string[], executor: Executor = db): Promise<Map<string, BorrowerSnapshot>> {
  if (copyIds.length === 0) return new Map();
  const rows = await executor
    .select({
      copyId: loanItems.bookCopyId,
      name: students.name,
      className: students.className,
      dueDate: loans.dueDate,
    })
    .from(loanItems)
    .innerJoin(loans, eq(loans.id, loanItems.loanId))
    .innerJoin(students, eq(students.id, loans.studentId))
    .where(and(inArray(loanItems.bookCopyId, copyIds), isNull(loanItems.returnedAt)));
  return new Map(rows.map(({ copyId, ...borrower }) => [copyId, borrower]));
}

export interface CopyLookup extends CopySnapshot {
  bookId: string;
  rackCode: string | null;
}

const COPY_FIELDS = {
  id: bookCopies.id,
  barcode: bookCopies.barcode,
  status: bookCopies.status,
  bookId: books.id,
  bookTitle: books.title,
  bookStatus: books.status,
  rackCode: racks.code,
};

/** Barcode disimpan dalam huruf besar (validasi eksemplar Rencana 02). */
export async function findCopyByBarcode(barcode: string, executor: Executor = db): Promise<CopyLookup | null> {
  const normalized = barcode.trim().toUpperCase();
  if (!normalized) return null;
  const [copy] = await executor
    .select(COPY_FIELDS)
    .from(bookCopies)
    .innerJoin(books, eq(books.id, bookCopies.bookId))
    .leftJoin(racks, eq(racks.id, books.rackId))
    .where(eq(bookCopies.barcode, normalized))
    .limit(1);
  if (!copy) return null;

  const borrower = copy.status === 'DIPINJAM' ? (await borrowersOf([copy.id], executor)).get(copy.id) : undefined;
  return borrower ? { ...copy, borrowedBy: borrower } : copy;
}

export interface LoanableBook {
  bookId: string;
  title: string;
  author: string;
  isbn: string | null;
  availableCount: number;
}

const BOOK_LIMIT = 8;

/**
 * Pencarian judul di meja peminjaman, untuk buku yang barcodenya tidak
 * terbaca. Hanya buku aktif; ISBN yang cocok persis selalu di urutan pertama.
 */
export async function searchLoanableBooks(query: string, executor: Executor = db): Promise<LoanableBook[]> {
  const keyword = query.trim();
  if (!keyword) return [];
  const pattern = containsPattern(keyword);
  const rows = await executor
    .select({
      bookId: books.id,
      title: books.title,
      author: books.author,
      isbn: books.isbn,
      availableCount: sql<number>`count(${bookCopies.id}) filter (where ${bookCopies.status} = 'TERSEDIA')`.mapWith(Number),
    })
    .from(books)
    .leftJoin(bookCopies, eq(bookCopies.bookId, books.id))
    .where(and(eq(books.status, 'active'), or(ilike(books.title, pattern), ilike(books.isbn, pattern))))
    .groupBy(books.id)
    .orderBy(desc(sql`${books.isbn} = ${keyword}`), asc(books.title))
    .limit(BOOK_LIMIT);
  return rows;
}

/** Eksemplar TERSEDIA pertama dari sebuah judul yang belum ada di daftar meja. */
export async function pickAvailableCopy(
  bookId: string,
  excludeCopyIds: string[],
  executor: Executor = db,
): Promise<CopyLookup | null> {
  if (!isUuid(bookId)) return null;
  const excluded = excludeCopyIds.filter(isUuid);
  const [copy] = await executor
    .select(COPY_FIELDS)
    .from(bookCopies)
    .innerJoin(books, eq(books.id, bookCopies.bookId))
    .leftJoin(racks, eq(racks.id, books.rackId))
    .where(and(
      eq(bookCopies.bookId, bookId),
      eq(bookCopies.status, 'TERSEDIA'),
      excluded.length > 0 ? notInArray(bookCopies.id, excluded) : undefined,
    ))
    .orderBy(asc(bookCopies.barcode))
    .limit(1);
  return copy ?? null;
}
