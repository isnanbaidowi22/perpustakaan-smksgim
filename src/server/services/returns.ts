import { and, asc, eq, isNull } from 'drizzle-orm';
import { nextCopyStatus, resolveLoanStatus } from '@/domain/return/copy-status';
import { calculateItemFine } from '@/domain/return/fine';
import type { IsoDate } from '@/domain/shared/date';
import type { Actor } from '@/domain/shared/types';
import { formatRupiah } from '@/lib/format';
import { writeAudit } from '@/server/audit';
import { db } from '@/server/db/client';
import type { Executor } from '@/server/db/executor';
import { bookCopies, books, loanItems, loans } from '@/server/db/schema';
import { getLibrarySettings } from '@/server/queries/settings';
import { isUuid } from '@/server/validation/common';
import type { ReturnInput } from '@/server/validation/return';
import { fail, ok, type ServiceResult } from './result';

const NOT_FOUND = 'Transaksi tidak ditemukan. Cari ulang dengan nomor transaksi, NIS, atau barcode buku.';
const STALE = 'Salah satu buku sudah dikembalikan atau bukan bagian dari transaksi ini. Muat ulang halaman lalu pilih lagi.';

/**
 * Spec 6.2. Denda dihitung per eksemplar dengan tarif saat ini, pada tanggal
 * sekolah `today`. Eksemplar rusak/hilang tidak pernah kembali TERSEDIA (BR-07).
 */
export async function processReturn(
  input: ReturnInput,
  actor: Actor,
  today: IsoDate,
  executor: Executor = db,
): Promise<ServiceResult> {
  if (!isUuid(input.loanId)) return fail(NOT_FOUND);
  if (input.items.length === 0) return fail('Centang minimal satu buku yang dikembalikan.');
  const itemIds = input.items.map((item) => item.loanItemId);
  if (new Set(itemIds).size !== itemIds.length) return fail('Setiap buku hanya boleh dipilih sekali. Muat ulang halaman.');

  return executor.transaction(async (tx) => {
    // 1. Kunci pinjaman, lalu item terbuka dan eksemplarnya (urut id eksemplar).
    const [loan] = await tx
      .select({ id: loans.id, transactionNumber: loans.transactionNumber, dueDate: loans.dueDate, status: loans.status })
      .from(loans)
      .where(eq(loans.id, input.loanId))
      .for('update');
    if (!loan) return fail(NOT_FOUND);
    if (loan.status === 'SELESAI') {
      return fail(`Transaksi ${loan.transactionNumber} sudah selesai; seluruh bukunya sudah kembali.`);
    }

    const openItems = await tx
      .select({ id: loanItems.id, copyId: loanItems.bookCopyId, barcode: bookCopies.barcode, price: books.price })
      .from(loanItems)
      .innerJoin(bookCopies, eq(bookCopies.id, loanItems.bookCopyId))
      .innerJoin(books, eq(books.id, bookCopies.bookId))
      .where(and(eq(loanItems.loanId, loan.id), isNull(loanItems.returnedAt)))
      .orderBy(asc(bookCopies.id))
      .for('update', { of: [loanItems, bookCopies] });
    const byId = new Map(openItems.map((row) => [row.id, row]));
    if (!itemIds.every((id) => byId.has(id))) return fail(STALE);

    const { finePerDay } = await getLibrarySettings(tx);
    const returnedAt = new Date();
    const summary: { barcode: string; condition: string; daysLate: number; lateFine: number; replacementFee: number }[] = [];

    for (const item of input.items) {
      const open = byId.get(item.loanItemId);
      if (!open) return fail(STALE);

      // 2. Denda per eksemplar.
      const fine = calculateItemFine({
        dueDate: loan.dueDate,
        returnDate: today,
        condition: item.condition,
        finePerDay,
        bookPrice: Number(open.price),
        replacementFeeOverride: item.replacementFee ?? undefined,
      });

      // 3–4. Hasil per item dan status eksemplar.
      await tx
        .update(loanItems)
        .set({
          returnedAt,
          returnCondition: item.condition,
          daysLate: fine.daysLate,
          lateFine: String(fine.lateFine),
          replacementFee: String(fine.replacementFee),
          conditionNote: item.note,
          returnedBy: actor.id,
        })
        .where(eq(loanItems.id, open.id));
      await tx
        .update(bookCopies)
        .set({ status: nextCopyStatus(item.condition), updatedAt: returnedAt })
        .where(eq(bookCopies.id, open.copyId));

      summary.push({
        barcode: open.barcode,
        condition: item.condition,
        daysLate: fine.daysLate,
        lateFine: fine.lateFine,
        replacementFee: fine.replacementFee,
      });
    }

    // 5. Hitung ulang total denda dan status pinjaman dari seluruh itemnya.
    const allItems = await tx
      .select({ returnedAt: loanItems.returnedAt, lateFine: loanItems.lateFine, replacementFee: loanItems.replacementFee })
      .from(loanItems)
      .where(eq(loanItems.loanId, loan.id));
    const totalFine = allItems.reduce((sum, row) => sum + Number(row.lateFine) + Number(row.replacementFee), 0);
    const status = resolveLoanStatus(allItems.map((row) => ({ returned: row.returnedAt !== null })));
    await tx
      .update(loans)
      .set({ totalFine: String(totalFine), status, updatedAt: returnedAt })
      .where(eq(loans.id, loan.id));

    // 6. Audit.
    await writeAudit(tx, {
      actorId: actor.id,
      action: 'return.process',
      entity: 'loans',
      entityId: loan.id,
      metadata: { transactionNumber: loan.transactionNumber, items: summary, totalFine, status },
    });
    return ok(loan.id, totalFine > 0 ? `Total denda transaksi ini ${formatRupiah(totalFine)}.` : 'Tidak ada denda.');
  });
}
