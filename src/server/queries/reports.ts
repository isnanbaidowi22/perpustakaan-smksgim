import {
  and, asc, between, eq, isNotNull, isNull, lt, ne, sql,
} from 'drizzle-orm';
import { diffDays, type IsoDate } from '@/domain/shared/date';
import type { LoanStatus, ReturnCondition } from '@/domain/shared/types';
import { REPORT_ROW_LIMIT } from '@/lib/report-period';
import type { Option } from '@/lib/options';
import { SCHOOL_TIME_ZONE } from '@/lib/school-date';
import { db } from '@/server/db/client';
import type { Executor } from '@/server/db/executor';
import {
  bookCopies, books, loanItems, loans, students,
} from '@/server/db/schema';
import { loanItemCounts } from './loan-aggregates';

/**
 * Kelas untuk filter laporan, dari kelas SAAT MEMINJAM (`loans.student_class`),
 * bukan kelas siswa sekarang: laporan per kelas tetap akurat setelah siswa
 * naik kelas (spec §13).
 */
export async function listReportClassOptions(executor: Executor = db): Promise<Option[]> {
  const rows = await executor
    .selectDistinct({ className: loans.studentClass })
    .from(loans)
    .orderBy(asc(loans.studentClass));
  return rows.map((row) => ({ value: row.className, label: row.className }));
}

/** Periode dan kelas. `className` kosong berarti semua kelas. */
export interface ReportFilter {
  from: IsoDate;
  to: IsoDate;
  className: string;
}

export interface LoanReportRow {
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
  daysOverdue: number;
}

export interface LoanReportSummary {
  loans: number;
  copies: number;
  students: number;
}

/** Peminjaman menurut tanggal pinjam. Ringkasan menghitung seluruh data yang cocok, bukan hanya baris yang tampil. */
export async function loanReport(
  filter: ReportFilter,
  today: IsoDate,
  executor: Executor = db,
  limit: number = REPORT_ROW_LIMIT,
): Promise<{ rows: LoanReportRow[]; summary: LoanReportSummary; truncated: boolean }> {
  const counts = loanItemCounts(executor);
  const where = and(
    between(loans.loanDate, filter.from, filter.to),
    filter.className ? eq(loans.studentClass, filter.className) : undefined,
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
      itemCount: counts.itemCount,
      openCount: counts.openCount,
    })
    .from(loans)
    .innerJoin(students, eq(students.id, loans.studentId))
    .innerJoin(counts, eq(counts.loanId, loans.id))
    .where(where)
    .orderBy(asc(loans.loanDate), asc(loans.transactionNumber))
    .limit(limit + 1);

  const [summary] = await executor
    .select({
      loans: sql<number>`count(distinct ${loans.id})::int`,
      copies: sql<number>`count(${loanItems.id})::int`,
      students: sql<number>`count(distinct ${loans.studentId})::int`,
    })
    .from(loans)
    .innerJoin(loanItems, eq(loanItems.loanId, loans.id))
    .where(where);

  return {
    rows: rows.slice(0, limit).map((row) => ({
      ...row,
      itemCount: Number(row.itemCount),
      openCount: Number(row.openCount),
      daysOverdue: row.status === 'SELESAI' ? 0 : Math.max(0, diffDays(row.dueDate, today)),
    })),
    summary: {
      loans: Number(summary?.loans ?? 0),
      copies: Number(summary?.copies ?? 0),
      students: Number(summary?.students ?? 0),
    },
    truncated: rows.length > limit,
  };
}

export interface ReturnReportRow {
  id: string;
  returnedAt: Date;
  loanId: string;
  transactionNumber: string;
  studentName: string;
  studentNis: string;
  studentClass: string;
  barcode: string;
  bookTitle: string;
  condition: ReturnCondition | null;
  daysLate: number;
  lateFine: number;
  replacementFee: number;
}

export interface ReturnReportSummary {
  copies: number;
  good: number;
  damaged: number;
  lost: number;
  lateFines: number;
  replacementFees: number;
}

/**
 * Eksemplar yang kembali pada periode, menurut tanggal WIB dari `returned_at`
 * (timestamptz), bukan tanggal UTC-nya: buku yang kembali pukul 00.30 WIB
 * masuk hari itu, bukan kemarin.
 */
export async function returnReport(
  filter: ReportFilter,
  executor: Executor = db,
  limit: number = REPORT_ROW_LIMIT,
): Promise<{ rows: ReturnReportRow[]; summary: ReturnReportSummary; truncated: boolean }> {
  const where = and(
    isNotNull(loanItems.returnedAt),
    sql`(${loanItems.returnedAt} at time zone ${SCHOOL_TIME_ZONE})::date between ${filter.from}::date and ${filter.to}::date`,
    filter.className ? eq(loans.studentClass, filter.className) : undefined,
  );

  const rows = await executor
    .select({
      id: loanItems.id,
      returnedAt: loanItems.returnedAt,
      loanId: loans.id,
      transactionNumber: loans.transactionNumber,
      studentName: students.name,
      studentNis: students.nis,
      studentClass: loans.studentClass,
      barcode: bookCopies.barcode,
      bookTitle: books.title,
      condition: loanItems.returnCondition,
      daysLate: loanItems.daysLate,
      lateFine: loanItems.lateFine,
      replacementFee: loanItems.replacementFee,
    })
    .from(loanItems)
    .innerJoin(loans, eq(loans.id, loanItems.loanId))
    .innerJoin(students, eq(students.id, loans.studentId))
    .innerJoin(bookCopies, eq(bookCopies.id, loanItems.bookCopyId))
    .innerJoin(books, eq(books.id, bookCopies.bookId))
    .where(where)
    .orderBy(asc(loanItems.returnedAt), asc(bookCopies.barcode))
    .limit(limit + 1);

  const [summary] = await executor
    .select({
      copies: sql<number>`count(*)::int`,
      good: sql<number>`(count(*) filter (where ${loanItems.returnCondition} = 'BAIK'))::int`,
      damaged: sql<number>`(count(*) filter (where ${loanItems.returnCondition} = 'RUSAK'))::int`,
      lost: sql<number>`(count(*) filter (where ${loanItems.returnCondition} = 'HILANG'))::int`,
      lateFines: sql<string>`coalesce(sum(${loanItems.lateFine}), 0)`,
      replacementFees: sql<string>`coalesce(sum(${loanItems.replacementFee}), 0)`,
    })
    .from(loanItems)
    .innerJoin(loans, eq(loans.id, loanItems.loanId))
    .where(where);

  return {
    rows: rows.slice(0, limit).map((row) => ({
      ...row,
      // Filter `isNotNull` menjamin nilainya ada.
      returnedAt: row.returnedAt as Date,
      lateFine: Number(row.lateFine),
      replacementFee: Number(row.replacementFee),
    })),
    summary: {
      copies: Number(summary?.copies ?? 0),
      good: Number(summary?.good ?? 0),
      damaged: Number(summary?.damaged ?? 0),
      lost: Number(summary?.lost ?? 0),
      lateFines: Number(summary?.lateFines ?? 0),
      replacementFees: Number(summary?.replacementFees ?? 0),
    },
    truncated: rows.length > limit,
  };
}

export interface OverdueReportRow {
  id: string;
  loanId: string;
  transactionNumber: string;
  studentName: string;
  studentNis: string;
  studentClass: string;
  barcode: string;
  bookTitle: string;
  dueDate: string;
  daysLate: number;
  estimatedFine: number;
}

export interface OverdueReportSummary {
  students: number;
  copies: number;
  estimatedFines: number;
}

/**
 * Eksemplar yang belum kembali dari pinjaman lewat jatuh tempo, per hari ini
 * (spec §4.2: keterlambatan dihitung saat dibaca). Perkiraan denda memakai
 * tarif saat ini; denda sesungguhnya dicatat saat pengembalian.
 */
export async function overdueReport(
  filter: { className: string },
  today: IsoDate,
  finePerDay: number,
  executor: Executor = db,
  limit: number = REPORT_ROW_LIMIT,
): Promise<{ rows: OverdueReportRow[]; summary: OverdueReportSummary; truncated: boolean }> {
  const where = and(
    isNull(loanItems.returnedAt),
    ne(loans.status, 'SELESAI'),
    lt(loans.dueDate, today),
    filter.className ? eq(loans.studentClass, filter.className) : undefined,
  );

  const rows = await executor
    .select({
      id: loanItems.id,
      loanId: loans.id,
      transactionNumber: loans.transactionNumber,
      studentName: students.name,
      studentNis: students.nis,
      studentClass: loans.studentClass,
      barcode: bookCopies.barcode,
      bookTitle: books.title,
      dueDate: loans.dueDate,
    })
    .from(loanItems)
    .innerJoin(loans, eq(loans.id, loanItems.loanId))
    .innerJoin(students, eq(students.id, loans.studentId))
    .innerJoin(bookCopies, eq(bookCopies.id, loanItems.bookCopyId))
    .innerJoin(books, eq(books.id, bookCopies.bookId))
    .where(where)
    .orderBy(asc(loans.dueDate), asc(students.name), asc(bookCopies.barcode))
    .limit(limit + 1);

  const [summary] = await executor
    .select({
      students: sql<number>`count(distinct ${loans.studentId})::int`,
      copies: sql<number>`count(*)::int`,
      totalDays: sql<number>`coalesce(sum(${today}::date - ${loans.dueDate}), 0)::int`,
    })
    .from(loanItems)
    .innerJoin(loans, eq(loans.id, loanItems.loanId))
    .where(where);

  return {
    rows: rows.slice(0, limit).map((row) => {
      const daysLate = diffDays(row.dueDate, today);
      return { ...row, daysLate, estimatedFine: daysLate * finePerDay };
    }),
    summary: {
      students: Number(summary?.students ?? 0),
      copies: Number(summary?.copies ?? 0),
      estimatedFines: Number(summary?.totalDays ?? 0) * finePerDay,
    },
    truncated: rows.length > limit,
  };
}
