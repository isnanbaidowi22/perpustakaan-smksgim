import { eq, sql } from 'drizzle-orm';
import type { Actor } from '@/domain/shared/types';
import { formatRupiah } from '@/lib/format';
import { writeAudit } from '@/server/audit';
import { db } from '@/server/db/client';
import type { Executor } from '@/server/db/executor';
import { finePayments, loans } from '@/server/db/schema';
import { isUuid } from '@/server/validation/common';
import type { FinePaymentInput } from '@/server/validation/fine';
import { fail, ok, type ServiceResult } from './result';

const NOT_FOUND = 'Transaksi tidak ditemukan. Muat ulang halaman riwayat.';

/**
 * Spec 5.4. Baris pinjaman dikunci agar dua petugas yang menekan "Tandai
 * Lunas" bersamaan tidak sama-sama membayar sisa yang sama.
 */
export async function payFine(
  loanId: string,
  input: FinePaymentInput,
  actor: Actor,
  executor: Executor = db,
): Promise<ServiceResult> {
  if (!isUuid(loanId)) return fail(NOT_FOUND);
  return executor.transaction(async (tx) => {
    const [loan] = await tx
      .select({ transactionNumber: loans.transactionNumber, totalFine: loans.totalFine })
      .from(loans)
      .where(eq(loans.id, loanId))
      .for('update');
    if (!loan) return fail(NOT_FOUND);

    const totalFine = Number(loan.totalFine);
    if (totalFine <= 0) return fail(`Transaksi ${loan.transactionNumber} tidak memiliki denda.`);

    const [{ paid }] = await tx
      .select({ paid: sql<string>`coalesce(sum(${finePayments.amount}), 0)` })
      .from(finePayments)
      .where(eq(finePayments.loanId, loanId));
    const unpaid = totalFine - Number(paid);
    if (unpaid <= 0) return fail(`Denda transaksi ${loan.transactionNumber} sudah lunas.`);
    if (input.amount > unpaid) {
      return fail(`Nominal melebihi sisa tagihan ${formatRupiah(unpaid)}. Ubah nominalnya.`, 'amount');
    }

    await tx.insert(finePayments).values({
      loanId,
      amount: String(input.amount),
      receivedBy: actor.id,
      note: input.note,
    });
    const remaining = unpaid - input.amount;
    await writeAudit(tx, {
      actorId: actor.id,
      action: 'fine.pay',
      entity: 'loans',
      entityId: loanId,
      metadata: { transactionNumber: loan.transactionNumber, amount: input.amount, remaining },
    });
    return ok(loanId, remaining > 0 ? `Sisa tagihan ${formatRupiah(remaining)}.` : 'Denda lunas.');
  });
}
