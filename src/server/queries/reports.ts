import { and, asc, between, eq, sql } from 'drizzle-orm';
import { diffDays, type IsoDate } from '@/domain/shared/date';
import type { LoanStatus } from '@/domain/shared/types';
import { REPORT_ROW_LIMIT } from '@/lib/report-period';
import type { Option } from '@/lib/options';
import { db } from '@/server/db/client';
import type { Executor } from '@/server/db/executor';
import { loanItems, loans, students } from '@/server/db/schema';
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
