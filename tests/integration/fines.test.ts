import { describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { Transaction } from '@/server/db/executor';
import { auditLogs, finePayments } from '@/server/db/schema';
import { getLoanDetail } from '@/server/queries/loans';
import { payFine } from '@/server/services/fines';
import { createLoan } from '@/server/services/loans';
import { processReturn } from '@/server/services/returns';
import { circulationFixture, TODAY, type CirculationFixture } from './circulation-fixture';
import { withRollback } from './helpers';

/** Pinjaman satu buku yang dikembalikan `returnDate`; terlambat 4 hari = denda Rp4.000. */
async function loanWithFine(tx: Transaction, fx: CirculationFixture, returnDate = '2090-03-09') {
  const created = await createLoan({ studentId: fx.students[0].id, copyIds: [fx.copies[0].id], notes: null }, fx.actor, TODAY, tx);
  if (!created.ok) throw new Error(JSON.stringify(created));
  const detail = await getLoanDetail(created.id, TODAY, tx);
  if (!detail) throw new Error('detail pinjaman tidak terbaca');
  await processReturn({
    loanId: created.id,
    items: [{ loanItemId: detail.items[0].id, condition: 'BAIK', replacementFee: null, note: null }],
  }, fx.actor, returnDate, tx);
  return { id: created.id, transactionNumber: created.transactionNumber };
}

describe('payFine', () => {
  it('mencatat pembayaran sebagian lalu pelunasan', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      const loan = await loanWithFine(tx, fx);

      expect(await payFine(loan.id, { amount: 1500, note: 'UJI cicil' }, fx.actor, tx))
        .toEqual({ ok: true, id: loan.id, notice: 'Sisa tagihan Rp2.500.' });
      expect(await payFine(loan.id, { amount: 2500, note: null }, fx.actor, tx))
        .toEqual({ ok: true, id: loan.id, notice: 'Denda lunas.' });

      const payments = await tx.select({ amount: finePayments.amount, receivedBy: finePayments.receivedBy })
        .from(finePayments).where(eq(finePayments.loanId, loan.id));
      expect(payments).toEqual([
        { amount: '1500.00', receivedBy: fx.actor.id },
        { amount: '2500.00', receivedBy: fx.actor.id },
      ]);
      expect((await getLoanDetail(loan.id, TODAY, tx))?.unpaidFine).toBe(0);

      const audit = await tx.select({ metadata: auditLogs.metadata }).from(auditLogs)
        .where(and(eq(auditLogs.entityId, loan.id), eq(auditLogs.action, 'fine.pay')));
      expect(audit.map((row) => row.metadata)).toEqual(expect.arrayContaining([
        { transactionNumber: loan.transactionNumber, amount: 1500, remaining: 2500 },
        { transactionNumber: loan.transactionNumber, amount: 2500, remaining: 0 },
      ]));
    });
  });

  it('menolak nominal di atas sisa tagihan dengan menyebut sisanya', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      const loan = await loanWithFine(tx, fx);

      expect(await payFine(loan.id, { amount: 5000, note: null }, fx.actor, tx)).toEqual({
        ok: false, field: 'amount', message: 'Nominal melebihi sisa tagihan Rp4.000. Ubah nominalnya.',
      });
    });
  });

  it('menolak pembayaran untuk denda yang sudah lunas atau pinjaman tanpa denda', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      const paid = await loanWithFine(tx, fx);
      await payFine(paid.id, { amount: 4000, note: null }, fx.actor, tx);
      const clean = await createLoan({ studentId: fx.students[1].id, copyIds: [fx.copies[1].id], notes: null }, fx.actor, TODAY, tx);
      if (!clean.ok) throw new Error(JSON.stringify(clean));

      expect(await payFine(paid.id, { amount: 1, note: null }, fx.actor, tx)).toEqual({
        ok: false, message: `Denda transaksi ${paid.transactionNumber} sudah lunas.`,
      });
      expect(await payFine(clean.id, { amount: 1, note: null }, fx.actor, tx)).toEqual({
        ok: false, message: `Transaksi ${clean.transactionNumber} tidak memiliki denda.`,
      });
      expect(await payFine(crypto.randomUUID(), { amount: 1, note: null }, fx.actor, tx)).toEqual({
        ok: false, message: 'Transaksi tidak ditemukan. Muat ulang halaman riwayat.',
      });
    });
  });
});
