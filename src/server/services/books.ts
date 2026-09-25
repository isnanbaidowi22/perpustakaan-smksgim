import { and, eq, sql } from 'drizzle-orm';
import type { Actor, RecordStatus } from '@/domain/shared/types';
import { writeAudit } from '@/server/audit';
import { db } from '@/server/db/client';
import type { Executor } from '@/server/db/executor';
import { bookCopies, books } from '@/server/db/schema';
import type { BookInput } from '@/server/validation/book';
import { isUuid } from '@/server/validation/common';
import { fail, ok, type ServiceResult } from './result';

const NOT_FOUND = 'Buku tidak ditemukan. Muat ulang halaman daftar buku.';

/** Spec Section 12: harga kosong membuat biaya ganti rusak/hilang ikut nol. */
export const ZERO_PRICE_NOTICE =
  'Perhatian: harga buku masih Rp0, sehingga biaya ganti bila eksemplar rusak atau hilang juga Rp0.';

/** Kolom `price` bertipe numeric; Drizzle menerimanya sebagai teks agar tidak kehilangan presisi. */
function toColumns(input: BookInput) {
  return { ...input, price: String(input.price) };
}

function priceNotice(input: BookInput): string | undefined {
  return input.price === 0 ? ZERO_PRICE_NOTICE : undefined;
}

export async function createBook(input: BookInput, actor: Actor, executor: Executor = db): Promise<ServiceResult> {
  return executor.transaction(async (tx) => {
    const [created] = await tx.insert(books).values(toColumns(input)).returning({ id: books.id });
    await writeAudit(tx, {
      actorId: actor.id,
      action: 'book.create',
      entity: 'books',
      entityId: created.id,
      metadata: { title: input.title, price: input.price },
    });
    return ok(created.id, priceNotice(input));
  });
}

export async function updateBook(
  id: string,
  input: BookInput,
  actor: Actor,
  executor: Executor = db,
): Promise<ServiceResult> {
  if (!isUuid(id)) return fail(NOT_FOUND);
  return executor.transaction(async (tx) => {
    const [current] = await tx
      .select({ title: books.title, price: books.price })
      .from(books)
      .where(eq(books.id, id))
      .for('update');
    if (!current) return fail(NOT_FOUND);

    const [updated] = await tx
      .update(books)
      .set({ ...toColumns(input), updatedAt: new Date() })
      .where(eq(books.id, id))
      .returning({ id: books.id });
    if (!updated) return fail(NOT_FOUND);

    await writeAudit(tx, {
      actorId: actor.id,
      action: 'book.update',
      entity: 'books',
      entityId: id,
      metadata: { before: current, after: { title: input.title, price: input.price } },
    });
    return ok(id, priceNotice(input));
  });
}

export async function setBookStatus(
  id: string,
  status: RecordStatus,
  actor: Actor,
  executor: Executor = db,
): Promise<ServiceResult> {
  if (!isUuid(id)) return fail(NOT_FOUND);
  return executor.transaction(async (tx) => {
    // Kunci baris buku agar penghitungan eksemplar di bawah tidak basi
    // ketika peminjaman berjalan bersamaan.
    const [book] = await tx
      .select({ title: books.title })
      .from(books)
      .where(eq(books.id, id))
      .for('update');
    if (!book) return fail(NOT_FOUND);

    if (status === 'inactive') {
      const [{ onLoan }] = await tx
        .select({ onLoan: sql<number>`count(*)::int` })
        .from(bookCopies)
        .where(and(eq(bookCopies.bookId, id), eq(bookCopies.status, 'DIPINJAM')));
      if (onLoan > 0) {
        return fail(
          `Buku "${book.title}" masih memiliki ${onLoan} eksemplar yang sedang dipinjam. ` +
          'Nonaktifkan setelah semuanya kembali.',
        );
      }
    }

    await tx.update(books).set({ status, updatedAt: new Date() }).where(eq(books.id, id));
    await writeAudit(tx, {
      actorId: actor.id,
      action: status === 'active' ? 'book.activate' : 'book.deactivate',
      entity: 'books',
      entityId: id,
      metadata: { title: book.title },
    });
    return ok(id);
  });
}
