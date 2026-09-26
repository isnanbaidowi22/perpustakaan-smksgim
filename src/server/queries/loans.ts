import { and, asc, desc, eq, ilike, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm';
import { diffDays, type IsoDate } from '@/domain/shared/date';
import { normalizeTransactionNumber } from '@/domain/loan/transaction-number';
import type { HistoryStatus } from '@/lib/circulation-labels';
import { offsetOf, PAGE_SIZE } from '@/lib/pagination';
import type { LoanStatus, ReturnCondition } from '@/domain/shared/types';
import { db } from '@/server/db/client';
import type { Executor } from '@/server/db/executor';
import {
  academicYears, bookCopies, books, finePayments, loanItems, loans, profiles, students,
} from '@/server/db/schema';
import { isUuid } from '@/server/validation/common';
import { containsPattern } from './like';
import { loanItemCounts, openItemCounts, paidTotals } from './loan-aggregates';

export interface LoanItemDetail {
  id: string;
  bookCopyId: string;
  barcode: string;
  bookTitle: string;
  /** Harga katalog saat ini, dasar biaya ganti yang dapat ditimpa petugas. */
  bookPrice: number;
  returnedAt: Date | null;
  returnCondition: ReturnCondition | null;
  daysLate: number;
  lateFine: number;
  replacementFee: number;
  conditionNote: string | null;
}

export interface LoanPaymentRow {
  id: string;
  amount: number;
  paidAt: Date;
  receivedByName: string;
  note: string | null;
}

export interface LoanDetail {
  id: string;
  transactionNumber: string;
  status: LoanStatus;
  loanDate: string;
  dueDate: string;
  notes: string | null;
  studentId: string;
  studentName: string;
  studentNis: string;
  /** Snapshot kelas saat meminjam (spec 4.2), bukan kelas siswa sekarang. */
  studentClass: string;
  academicYearName: string;
  createdByName: string;
  totalFine: number;
  paidTotal: number;
  unpaidFine: number;
  /** 0 bila tidak terlambat atau seluruh bukunya sudah kembali. */
  daysOverdue: number;
  items: LoanItemDetail[];
  payments: LoanPaymentRow[];
}

/** Keterlambatan dihitung saat dibaca, tidak pernah disimpan (spec 4.2). */
function overdueDays(status: LoanStatus, dueDate: IsoDate, today: IsoDate): number {
  return status === 'SELESAI' ? 0 : Math.max(0, diffDays(dueDate, today));
}

export async function getLoanDetail(id: string, today: IsoDate, executor: Executor = db): Promise<LoanDetail | null> {
  if (!isUuid(id)) return null;
  const [loan] = await executor
    .select({
      id: loans.id,
      transactionNumber: loans.transactionNumber,
      status: loans.status,
      loanDate: loans.loanDate,
      dueDate: loans.dueDate,
      notes: loans.notes,
      studentId: students.id,
      studentName: students.name,
      studentNis: students.nis,
      studentClass: loans.studentClass,
      academicYearName: academicYears.name,
      createdByName: profiles.fullName,
      totalFine: loans.totalFine,
    })
    .from(loans)
    .innerJoin(students, eq(students.id, loans.studentId))
    .innerJoin(academicYears, eq(academicYears.id, loans.academicYearId))
    .innerJoin(profiles, eq(profiles.id, loans.createdBy))
    .where(eq(loans.id, id))
    .limit(1);
  if (!loan) return null;

  const itemRows = await executor
    .select({
      id: loanItems.id,
      bookCopyId: loanItems.bookCopyId,
      barcode: bookCopies.barcode,
      bookTitle: books.title,
      bookPrice: books.price,
      returnedAt: loanItems.returnedAt,
      returnCondition: loanItems.returnCondition,
      daysLate: loanItems.daysLate,
      lateFine: loanItems.lateFine,
      replacementFee: loanItems.replacementFee,
      conditionNote: loanItems.conditionNote,
    })
    .from(loanItems)
    .innerJoin(bookCopies, eq(bookCopies.id, loanItems.bookCopyId))
    .innerJoin(books, eq(books.id, bookCopies.bookId))
    .where(eq(loanItems.loanId, id))
    .orderBy(asc(bookCopies.barcode));

  const paymentRows = await executor
    .select({
      id: finePayments.id,
      amount: finePayments.amount,
      paidAt: finePayments.paidAt,
      receivedByName: profiles.fullName,
      note: finePayments.note,
    })
    .from(finePayments)
    .innerJoin(profiles, eq(profiles.id, finePayments.receivedBy))
    .where(eq(finePayments.loanId, id))
    .orderBy(asc(finePayments.paidAt));

  const items = itemRows.map((row) => ({
    ...row,
    bookPrice: Number(row.bookPrice),
    lateFine: Number(row.lateFine),
    replacementFee: Number(row.replacementFee),
  }));
  const payments = paymentRows.map((row) => ({ ...row, amount: Number(row.amount) }));
  const totalFine = Number(loan.totalFine);
  const paidTotal = payments.reduce((sum, payment) => sum + payment.amount, 0);

  return {
    ...loan,
    totalFine,
    paidTotal,
    unpaidFine: Math.max(0, totalFine - paidTotal),
    daysOverdue: overdueDays(loan.status, loan.dueDate, today),
    items,
    payments,
  };
}

export interface ReturnCandidate {
  id: string;
  transactionNumber: string;
  studentName: string;
  studentNis: string;
  studentClass: string;
  loanDate: string;
  dueDate: string;
  openCount: number;
  daysOverdue: number;
}

const CANDIDATE_LIMIT = 20;

/**
 * Satu kolom pencarian universal di layar pengembalian (spec 8.3). Alih-alih
 * menebak jenis masukan, keempat kemungkinan dicocokkan sekaligus: nomor
 * transaksi, NIS, sebagian nama, atau barcode buku yang belum kembali.
 * Petugas tidak perlu memilih mode. Hanya pinjaman yang masih punya buku
 * belum kembali yang tampil.
 */
export async function findLoansForReturn(
  query: string,
  today: IsoDate,
  executor: Executor = db,
): Promise<ReturnCandidate[]> {
  const keyword = query.trim();
  if (!keyword) return [];
  const upper = keyword.toUpperCase();
  const transactionMatch = normalizeTransactionNumber(keyword) ?? upper;
  const openItems = openItemCounts(executor);
  const byBarcode = executor
    .select({ loanId: loanItems.loanId })
    .from(loanItems)
    .innerJoin(bookCopies, eq(bookCopies.id, loanItems.bookCopyId))
    .where(and(isNull(loanItems.returnedAt), eq(bookCopies.barcode, upper)));

  const rows = await executor
    .select({
      id: loans.id,
      transactionNumber: loans.transactionNumber,
      studentName: students.name,
      studentNis: students.nis,
      studentClass: loans.studentClass,
      loanDate: loans.loanDate,
      dueDate: loans.dueDate,
      status: loans.status,
      openCount: openItems.openCount,
    })
    .from(loans)
    .innerJoin(students, eq(students.id, loans.studentId))
    .innerJoin(openItems, eq(openItems.loanId, loans.id))
    .where(or(
      eq(loans.transactionNumber, transactionMatch),
      eq(students.nis, keyword),
      ilike(students.name, containsPattern(keyword)),
      inArray(loans.id, byBarcode),
    ))
    .orderBy(asc(loans.dueDate), asc(loans.transactionNumber))
    .limit(CANDIDATE_LIMIT);

  return rows.map(({ status, ...row }) => ({
    ...row,
    openCount: Number(row.openCount),
    daysOverdue: overdueDays(status, row.dueDate, today),
  }));
}

export interface LoanRow {
  id: string;
  transactionNumber: string;
  loanDate: string;
  dueDate: string;
  status: LoanStatus;
  studentName: string;
  studentNis: string;
  studentClass: string;
  itemCount: number;
  openCount: number;
  totalFine: number;
  unpaidFine: number;
  daysOverdue: number;
}

export interface LoanFilter {
  q: string;
  status: HistoryStatus;
  page: number;
}

type PaidTotals = ReturnType<typeof paidTotals>;

/** Status "terlambat" dan "belum lunas" dihitung saat dibaca (spec 4.2, 5.4). */
function statusCondition(status: HistoryStatus, today: IsoDate, paid: PaidTotals) {
  switch (status) {
    case 'open':
      return ne(loans.status, 'SELESAI');
    case 'overdue':
      return and(ne(loans.status, 'SELESAI'), lt(loans.dueDate, today));
    case 'unpaid':
      return sql`${loans.totalFine} > coalesce(${paid.paid}, 0)`;
    case 'done':
      return eq(loans.status, 'SELESAI');
    case 'all':
      return undefined;
  }
}

export async function listLoans(
  filter: LoanFilter,
  today: IsoDate,
  executor: Executor = db,
): Promise<{ rows: LoanRow[]; total: number }> {
  const paid = paidTotals(executor);
  const itemCounts = loanItemCounts(executor);

  const keyword = filter.q.trim();
  const where = and(
    keyword
      ? or(
          eq(loans.transactionNumber, normalizeTransactionNumber(keyword) ?? keyword.toUpperCase()),
          eq(students.nis, keyword),
          ilike(students.name, containsPattern(keyword)),
        )
      : undefined,
    statusCondition(filter.status, today, paid),
  );

  const rows = await executor
    .select({
      id: loans.id,
      transactionNumber: loans.transactionNumber,
      loanDate: loans.loanDate,
      dueDate: loans.dueDate,
      status: loans.status,
      studentName: students.name,
      studentNis: students.nis,
      studentClass: loans.studentClass,
      itemCount: itemCounts.itemCount,
      openCount: itemCounts.openCount,
      totalFine: loans.totalFine,
      paid: sql<string>`coalesce(${paid.paid}, 0)`,
    })
    .from(loans)
    .innerJoin(students, eq(students.id, loans.studentId))
    .innerJoin(itemCounts, eq(itemCounts.loanId, loans.id))
    .leftJoin(paid, eq(paid.loanId, loans.id))
    .where(where)
    .orderBy(desc(loans.loanDate), desc(loans.transactionNumber))
    .limit(PAGE_SIZE)
    .offset(offsetOf(filter.page));

  const [{ total }] = await executor
    .select({ total: sql<number>`count(*)::int` })
    .from(loans)
    .innerJoin(students, eq(students.id, loans.studentId))
    .leftJoin(paid, eq(paid.loanId, loans.id))
    .where(where);

  return {
    rows: rows.map(({ paid: paidAmount, ...row }) => {
      const totalFine = Number(row.totalFine);
      return {
        ...row,
        itemCount: Number(row.itemCount),
        openCount: Number(row.openCount),
        totalFine,
        unpaidFine: Math.max(0, totalFine - Number(paidAmount)),
        daysOverdue: overdueDays(row.status, row.dueDate, today),
      };
    }),
    total: Number(total),
  };
}
