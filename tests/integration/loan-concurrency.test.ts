import { describe, expect, it } from 'vitest';
import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { sqlState } from '@/server/db/errors';
import type { Transaction } from '@/server/db/executor';
import { academicYears, bookCopies, books, students } from '@/server/db/schema';
import { createLoan, type LoanResult } from '@/server/services/loans';
import { testActor, withRollback } from './helpers';

/**
 * Spec §10: dua peminjaman bersamaan atas eksemplar yang sama tidak boleh
 * sama-sama lolos. Database cloud tidak boleh menerima data uji yang
 * di-commit (keputusan pemilik produk, 25 September 2026), jadi buktinya:
 *
 *  1. Dua koneksi sungguhan. Selama peminjaman pertama belum selesai,
 *     peminjaman kedua TERTAHAN pada kunci baris eksemplar — ia tidak membaca
 *     status lama lalu ikut lolos.
 *  2. Setelah kunci dilepas, peminjaman kedua melanjutkan dengan status
 *     terbaru. (Karena yang pertama di-rollback, status terbarunya TERSEDIA
 *     dan yang kedua berhasil. Penolakan COPY_UNAVAILABLE atas eksemplar yang
 *     sudah DIPINJAM dibuktikan di loans.test.ts.)
 *
 * Satu-satunya baris yang dibagi kedua koneksi adalah eksemplar seed yang
 * sudah ter-commit. Setiap koneksi membuat siswanya sendiri, sehingga yang
 * diuji adalah kunci eksemplar, bukan kunci siswa. Keduanya di-rollback.
 */
const TODAY = '2090-03-02';

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function sharedCopyId(): Promise<string> {
  const [year] = await db.select({ id: academicYears.id }).from(academicYears).where(eq(academicYears.isActive, true)).limit(1);
  if (!year) throw new Error('Uji konkurensi butuh tahun ajaran aktif yang ter-commit. Aktifkan satu di Pengaturan → Tahun Ajaran.');

  const [copy] = await db
    .select({ id: bookCopies.id })
    .from(bookCopies)
    .innerJoin(books, eq(books.id, bookCopies.bookId))
    .where(and(eq(bookCopies.status, 'TERSEDIA'), eq(books.status, 'active')))
    .orderBy(asc(bookCopies.barcode))
    .limit(1);
  if (!copy) throw new Error('Tidak ada eksemplar TERSEDIA dari buku aktif. Jalankan "npm run db:seed" sebelum uji integrasi.');
  return copy.id;
}

/** Siswa yang hanya terlihat oleh transaksi `tx` sendiri. */
async function privateStudent(tx: Transaction, nis: string): Promise<string> {
  const [student] = await tx
    .insert(students)
    .values({ nis, name: `UJI Siswa ${nis}`, className: 'XI UJI' })
    .returning({ id: students.id });
  return student.id;
}

/** Peminjaman pertama: meminjam eksemplar, lalu menahan kuncinya sampai `release`. */
function holdLoan(copyId: string, release: Promise<void>) {
  const holding = deferred();
  const done = withRollback(async (tx) => {
    const actor = await testActor(tx);
    const result = await createLoan({ studentId: await privateStudent(tx, 'UJI-K1'), copyIds: [copyId], notes: null }, actor, TODAY, tx);
    expect(result.ok).toBe(true);
    holding.resolve();
    await release;
  });
  return { holding: holding.promise, done };
}

describe('createLoan bersamaan atas eksemplar yang sama', () => {
  it('menahan peminjaman kedua pada kunci eksemplar selama peminjaman pertama belum selesai', async () => {
    const copyId = await sharedCopyId();
    const release = deferred();
    const first = holdLoan(copyId, release.promise);
    await Promise.race([first.holding, first.done]);

    let failure: unknown = null;
    try {
      await withRollback(async (tx) => {
        const actor = await testActor(tx);
        const studentId = await privateStudent(tx, 'UJI-K2');
        await tx.execute(sql`set local lock_timeout = '2s'`);
        await createLoan({ studentId, copyIds: [copyId], notes: null }, actor, TODAY, tx);
      });
    } catch (error) {
      failure = error;
    } finally {
      release.resolve();
      await first.done;
    }

    // 55P03 = lock_not_available: yang kedua menunggu kunci, bukan lolos.
    expect(sqlState(failure)).toBe('55P03');
  });

  it('melanjutkan peminjaman kedua dengan status terbaru setelah kunci dilepas', async () => {
    const copyId = await sharedCopyId();
    const release = deferred();
    const first = holdLoan(copyId, release.promise);
    await Promise.race([first.holding, first.done]);

    const outcome: { settled: boolean; result?: LoanResult } = { settled: false };
    const second = withRollback(async (tx) => {
      const actor = await testActor(tx);
      const studentId = await privateStudent(tx, 'UJI-K2');
      outcome.result = await createLoan({ studentId, copyIds: [copyId], notes: null }, actor, TODAY, tx);
    }).finally(() => {
      outcome.settled = true;
    });

    await new Promise((resume) => setTimeout(resume, 1500));
    expect(outcome.settled).toBe(false);

    release.resolve();
    await first.done;
    await second;
    expect(outcome.result?.ok).toBe(true);
  });
});
