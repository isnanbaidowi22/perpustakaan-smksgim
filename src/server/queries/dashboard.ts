import { and, asc, eq, lt, ne, sql } from 'drizzle-orm';
import type { IsoDate } from '@/domain/shared/date';
import { SCHOOL_TIME_ZONE } from '@/lib/school-date';
import { db } from '@/server/db/client';
import type { Executor } from '@/server/db/executor';
import { bookCopies, books, loanItems, loans, students } from '@/server/db/schema';
import { openItemCounts } from './loan-aggregates';

/** Angka dashboard (spec 8.4). Setiap angka dapat ditelusuri ke halaman lain. */
export interface DashboardStats {
  /** Eksemplar yang tidak NONAKTIF dari judul aktif (Task 6 ruling): judul nonaktif tidak dapat dipinjam. */
  totalCopies: number;
  /** Judul aktif. */
  totalTitles: number;
  /** Eksemplar TERSEDIA dari judul aktif: yang benar-benar dapat dipinjam sekarang. */
  availableCopies: number;
  borrowedCopies: number;
  /** Transaksi terbuka yang lewat jatuh tempo (spec 4.2: dihitung saat dibaca). */
  overdueLoans: number;
  /** Eksemplar yang belum kembali dari transaksi terlambat itu. */
  overdueCopies: number;
  loansToday: number;
  copiesLentToday: number;
  /** Menurut tanggal WIB dari `returned_at`, bukan tanggal UTC-nya. */
  copiesReturnedToday: number;
}

export interface DueTodayRow {
  id: string;
  transactionNumber: string;
  studentName: string;
  studentNis: string;
  studentClass: string;
  openCount: number;
}

const DUE_TODAY_LIMIT = 50;

export async function getDashboardStats(today: IsoDate, executor: Executor = db): Promise<DashboardStats> {
  const open = openItemCounts(executor);

  const [collection, [titles], [overdue], [lentToday], [returnedToday]] = await Promise.all([
    executor
      .select({
        total: sql<number>`(count(*) filter (where ${bookCopies.status} <> 'NONAKTIF' and ${books.status} = 'active'))::int`,
        available: sql<number>`(count(*) filter (where ${bookCopies.status} = 'TERSEDIA' and ${books.status} = 'active'))::int`,
        borrowed: sql<number>`(count(*) filter (where ${bookCopies.status} = 'DIPINJAM'))::int`,
      })
      .from(bookCopies)
      .innerJoin(books, eq(books.id, bookCopies.bookId)),
    executor
      .select({ total: sql<number>`count(*)::int` })
      .from(books)
      .where(eq(books.status, 'active')),
    executor
      .select({
        loans: sql<number>`count(*)::int`,
        copies: sql<number>`coalesce(sum(${open.openCount}), 0)::int`,
      })
      .from(loans)
      .innerJoin(open, eq(open.loanId, loans.id))
      .where(and(ne(loans.status, 'SELESAI'), lt(loans.dueDate, today))),
    executor
      .select({
        loans: sql<number>`count(distinct ${loans.id})::int`,
        copies: sql<number>`count(${loanItems.id})::int`,
      })
      .from(loans)
      .innerJoin(loanItems, eq(loanItems.loanId, loans.id))
      .where(eq(loans.loanDate, today)),
    executor
      .select({ copies: sql<number>`count(*)::int` })
      .from(loanItems)
      .where(sql`(${loanItems.returnedAt} at time zone ${SCHOOL_TIME_ZONE})::date = ${today}::date`),
  ]);
  const [copies] = collection;

  return {
    totalCopies: Number(copies?.total ?? 0),
    totalTitles: Number(titles?.total ?? 0),
    availableCopies: Number(copies?.available ?? 0),
    borrowedCopies: Number(copies?.borrowed ?? 0),
    overdueLoans: Number(overdue?.loans ?? 0),
    overdueCopies: Number(overdue?.copies ?? 0),
    loansToday: Number(lentToday?.loans ?? 0),
    copiesLentToday: Number(lentToday?.copies ?? 0),
    copiesReturnedToday: Number(returnedToday?.copies ?? 0),
  };
}

/** Pinjaman yang jatuh tempo hari ini dan masih punya buku di tangan siswa (spec 8.4). */
export async function listDueToday(today: IsoDate, executor: Executor = db): Promise<DueTodayRow[]> {
  const open = openItemCounts(executor);
  const rows = await executor
    .select({
      id: loans.id,
      transactionNumber: loans.transactionNumber,
      studentName: students.name,
      studentNis: students.nis,
      studentClass: loans.studentClass,
      openCount: open.openCount,
    })
    .from(loans)
    .innerJoin(students, eq(students.id, loans.studentId))
    .innerJoin(open, eq(open.loanId, loans.id))
    .where(and(ne(loans.status, 'SELESAI'), eq(loans.dueDate, today)))
    .orderBy(asc(students.name), asc(loans.transactionNumber))
    .limit(DUE_TODAY_LIMIT);

  return rows.map((row) => ({ ...row, openCount: Number(row.openCount) }));
}
