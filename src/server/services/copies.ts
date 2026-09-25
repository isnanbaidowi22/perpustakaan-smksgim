import { eq, sql } from 'drizzle-orm';
import { autoBarcodeRange } from '@/domain/copy/barcode';
import {
  MANUAL_ACTION_LABELS, planManualStatusChange, type ManualCopyAction,
} from '@/domain/copy/manual-status';
import type { Actor } from '@/domain/shared/types';
import { writeAudit } from '@/server/audit';
import { db } from '@/server/db/client';
import { uniqueViolation } from '@/server/db/errors';
import type { Executor, Transaction } from '@/server/db/executor';
import { bookCopies, books, counters } from '@/server/db/schema';
import { isUuid } from '@/server/validation/common';
import type { AddCopiesInput } from '@/server/validation/copy';
import { fail, ok, type ServiceResult } from './result';

const BOOK_NOT_FOUND = 'Buku tidak ditemukan. Muat ulang halaman daftar buku.';
const COPY_NOT_FOUND = 'Eksemplar tidak ditemukan. Muat ulang halaman buku.';
const COUNTER_SCOPE = 'copy_barcode';

const AUDIT_ACTIONS: Record<ManualCopyAction, string> = {
  RESTORE: 'copy.restore',
  DEACTIVATE: 'copy.deactivate',
  REACTIVATE: 'copy.reactivate',
};

/**
 * Mengalokasikan `count` nomor barcode dan mengembalikan nomor terakhirnya.
 *
 * `insert … on conflict do update … returning` mengunci baris counter sampai
 * transaksi selesai, sehingga dua petugas yang menambah eksemplar bersamaan
 * tidak pernah mendapat nomor yang sama. Saat baris belum ada, nilainya
 * dimulai dari nomor BK- terbesar yang sudah tersimpan (misalnya dari seed).
 */
async function allocateBarcodeSequence(tx: Transaction, count: number): Promise<number> {
  const [row] = await tx
    .insert(counters)
    .values({
      scope: COUNTER_SCOPE,
      value: sql`(select coalesce(max(substring(${bookCopies.barcode} from 4)::bigint), 0)
                  from ${bookCopies} where ${bookCopies.barcode} ~ '^BK-[0-9]+$') + ${count}`,
    })
    .onConflictDoUpdate({ target: counters.scope, set: { value: sql`${counters.value} + ${count}` } })
    .returning({ value: counters.value });
  return row.value;
}

function describeBarcodes(barcodes: string[]): string {
  const first = barcodes[0];
  const last = barcodes[barcodes.length - 1];
  return barcodes.length === 1 ? `Barcode: ${first}.` : `Barcode: ${first} s.d. ${last}.`;
}

export async function addCopies(
  bookId: string,
  input: AddCopiesInput,
  actor: Actor,
  executor: Executor = db,
): Promise<ServiceResult> {
  if (!isUuid(bookId)) return fail(BOOK_NOT_FOUND);
  try {
    return await executor.transaction(async (tx) => {
      // Kunci share: mencegah setBookStatus (yang memakai for('update')) menonaktifkan
      // buku ini di antara pemeriksaan status dan penyisipan eksemplar baru di bawah.
      const [book] = await tx
        .select({ title: books.title, status: books.status })
        .from(books)
        .where(eq(books.id, bookId))
        .for('share');
      if (!book) return fail(BOOK_NOT_FOUND);
      if (book.status !== 'active') {
        return fail(`Buku "${book.title}" nonaktif. Aktifkan bukunya terlebih dahulu sebelum menambah eksemplar.`);
      }

      const barcodes = input.barcode
        ? [input.barcode]
        : autoBarcodeRange(await allocateBarcodeSequence(tx, input.count), input.count);

      const inserted = await tx
        .insert(bookCopies)
        .values(barcodes.map((barcode) => ({
          bookId,
          barcode,
          acquisitionDate: input.acquisitionDate,
          notes: input.notes,
        })))
        .returning({ id: bookCopies.id });

      await writeAudit(tx, {
        actorId: actor.id,
        action: 'copy.create',
        entity: 'books',
        entityId: bookId,
        metadata: { barcodes },
      });
      return ok(inserted[0].id, describeBarcodes(barcodes));
    });
  } catch (error) {
    if (uniqueViolation(error) === 'book_copies_barcode_unique') {
      return input.barcode
        ? fail(`Barcode ${input.barcode} sudah dipakai eksemplar lain. Periksa label pada buku.`, 'barcode')
        : fail('Barcode otomatis bertabrakan dengan barcode yang sudah ada. Simpan sekali lagi; bila berulang, hubungi admin.');
    }
    throw error;
  }
}

/** Perubahan status manual oleh admin (spec 4.3). Aturannya ada di lapisan domain. */
export async function changeCopyStatus(
  copyId: string,
  action: ManualCopyAction,
  actor: Actor,
  executor: Executor = db,
): Promise<ServiceResult> {
  if (!isUuid(copyId)) return fail(COPY_NOT_FOUND);
  return executor.transaction(async (tx) => {
    // Kunci baris eksemplar: statusnya tidak boleh berubah oleh peminjaman
    // yang berjalan bersamaan di antara pemeriksaan dan penulisan.
    const [copy] = await tx
      .select({ barcode: bookCopies.barcode, status: bookCopies.status })
      .from(bookCopies)
      .where(eq(bookCopies.id, copyId))
      .for('update');
    if (!copy) return fail(COPY_NOT_FOUND);

    const plan = planManualStatusChange(copy.status, action);
    if (!plan.ok) {
      return fail(plan.reason === 'ON_LOAN'
        ? `Eksemplar ${copy.barcode} sedang dipinjam. Statusnya hanya dapat berubah melalui pengembalian.`
        : `Eksemplar ${copy.barcode} berstatus ${copy.status}, sehingga aksi "${MANUAL_ACTION_LABELS[action]}" tidak berlaku.`);
    }

    await tx
      .update(bookCopies)
      .set({ status: plan.next, updatedAt: new Date() })
      .where(eq(bookCopies.id, copyId));
    await writeAudit(tx, {
      actorId: actor.id,
      action: AUDIT_ACTIONS[action],
      entity: 'book_copies',
      entityId: copyId,
      metadata: { barcode: copy.barcode, from: copy.status, to: plan.next },
    });
    return ok(copyId);
  });
}
