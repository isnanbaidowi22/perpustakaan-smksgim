import { isNull, sql } from 'drizzle-orm';
import type { Executor } from '@/server/db/executor';
import { finePayments, loanItems } from '@/server/db/schema';

/**
 * Jumlah eksemplar yang belum kembali per peminjaman. Dipakai sebagai tabel
 * turunan yang di-JOIN, bukan subquery berkorelasi: di drizzle-orm 0.45 kolom
 * di dalam template `sql` ditulis tanpa nama tabel pada select satu tabel,
 * sehingga subquery berkorelasi diam-diam merujuk kolom yang salah.
 */
export function openItemCounts(executor: Executor) {
  return executor
    .select({
      loanId: loanItems.loanId,
      openCount: sql<number>`count(*)::int`.as('open_count'),
    })
    .from(loanItems)
    .where(isNull(loanItems.returnedAt))
    .groupBy(loanItems.loanId)
    .as('open_items');
}

/** Total pembayaran denda per peminjaman. Numeric dibaca sebagai untai. */
export function paidTotals(executor: Executor) {
  return executor
    .select({
      loanId: finePayments.loanId,
      paid: sql<string>`sum(${finePayments.amount})`.as('paid_amount'),
    })
    .from(finePayments)
    .groupBy(finePayments.loanId)
    .as('paid_totals');
}

/** Jumlah seluruh buku dan yang belum kembali per peminjaman. */
export function loanItemCounts(executor: Executor) {
  return executor
    .select({
      loanId: loanItems.loanId,
      itemCount: sql<number>`count(*)::int`.as('item_count'),
      openCount: sql<number>`(count(*) filter (where ${loanItems.returnedAt} is null))::int`.as('open_count'),
    })
    .from(loanItems)
    .groupBy(loanItems.loanId)
    .as('item_counts');
}
