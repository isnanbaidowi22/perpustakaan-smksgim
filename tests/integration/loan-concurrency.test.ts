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
 *     status lama lalu ikut lolos. `sqlState` bernilai '55P03' saja TIDAK
 *     cukup membuktikan ini: transaksi kedua juga akan berakhir '55P03' bila
 *     ia tertahan pada baris counter harian atau constraint
 *     `one_open_loan_per_copy` yang sama-sama dipakai kedua transaksi.
 *     Buktinya harus menunjuk PERNYATAAN SQL tempat ia tertahan: dipoll dari
 *     koneksi ketiga (`db`) lewat `pg_stat_activity`, mencari pid transaksi
 *     kedua dengan `wait_event_type = 'Lock'` dan teks kueri yang cocok
 *     dengan pernyataan `for update of "book_copies"` yang dihasilkan
 *     `lockRequestedCopies` (lihat `src/server/services/loans.ts`).
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

function deferred<T = void>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/**
 * Fragmen pernyataan SQL yang dihasilkan `lockRequestedCopies` (dicek lewat
 * `.toSQL()` sekali secara manual): `... for update of "book_copies"`.
 * Dipakai baik di sisi Postgres (`ilike`, untuk hanya mengambil baris yang
 * cocok) maupun di sisi JS (diagnosa bila tidak cocok) untuk memastikan
 * transaksi kedua tertahan tepat di kunci eksemplar, bukan di baris counter
 * harian atau constraint lain yang juga ter-commit di transaksi yang sama.
 */
const COPY_LOCK_QUERY_FRAGMENT = 'for update of "book_copies"';

/**
 * Mem-poll `pg_stat_activity` dari koneksi terpisah (`db`, bukan salah satu
 * transaksi yang sedang diuji) sampai transaksi `pid` terlihat tertahan pada
 * pernyataan kunci eksemplar, atau `deadlineMs` habis. Mengembalikan teks
 * kueri terakhir yang teramati untuk membantu diagnosis bila gagal.
 */
async function waitForCopyLockWait(pid: number, deadlineMs: number): Promise<{ found: boolean; lastSeen: unknown }> {
  const pattern = `%${COPY_LOCK_QUERY_FRAGMENT}%`;
  const deadline = Date.now() + deadlineMs;
  let lastSeen: unknown = null;
  while (Date.now() < deadline) {
    const matched = await db.execute(sql`
      select wait_event_type as "waitEventType", query
      from pg_stat_activity
      where pid = ${pid} and wait_event_type = 'Lock' and query ilike ${pattern}
    `);
    if (matched[0]) return { found: true, lastSeen: matched[0] };

    // Tidak cocok kali ini: simpan apa pun yang teramati untuk pid ini,
    // supaya pesan galat menunjukkan di mana ia sesungguhnya tertahan.
    const all = await db.execute(sql`
      select wait_event_type as "waitEventType", query
      from pg_stat_activity
      where pid = ${pid}
    `);
    lastSeen = all[0] ?? lastSeen;
    await new Promise((resume) => setTimeout(resume, 100));
  }
  return { found: false, lastSeen };
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

    const pidBox = deferred<number>();
    let failure: unknown = null;
    let proof: { found: boolean; lastSeen: unknown } | null = null;
    try {
      const second = withRollback(async (tx) => {
        const actor = await testActor(tx);
        const studentId = await privateStudent(tx, 'UJI-K2');
        await tx.execute(sql`set local lock_timeout = '2s'`);
        const [{ pid }] = await tx.execute(sql`select pg_backend_pid() as pid`) as unknown as { pid: number }[];
        pidBox.resolve(pid);
        await createLoan({ studentId, copyIds: [copyId], notes: null }, actor, TODAY, tx);
      });

      // Dipoll SELAGI transaksi kedua masih tertahan menunggu respons dari
      // Postgres, sebelum `lock_timeout` menyerah dan melempar '55P03'.
      const pid = await pidBox.promise;
      proof = await waitForCopyLockWait(pid, 1500);

      await second;
    } catch (error) {
      failure = error;
    } finally {
      release.resolve();
      await first.done;
    }

    // Buktikan LOKASI tertahannya dulu: pernyataan kunci eksemplar, bukan
    // baris counter harian atau constraint unik lain yang sama-sama dipakai
    // kedua transaksi (keduanya juga akan berakhir '55P03', tetapi itu tidak
    // membuktikan kunci eksemplarnya bekerja).
    expect(proof?.found, `pg_stat_activity tidak pernah menunjukkan pid tertahan pada kunci eksemplar. Teramati terakhir: ${JSON.stringify(proof?.lastSeen)}`).toBe(true);
    // 55P03 = lock_not_available: yang kedua menunggu kunci, lalu menyerah.
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
      await tx.execute(sql`set local lock_timeout = '10s'`);
      outcome.result = await createLoan({ studentId, copyIds: [copyId], notes: null }, actor, TODAY, tx);
    }).finally(() => {
      outcome.settled = true;
    });

    try {
      await new Promise((resume) => setTimeout(resume, 1500));
      expect(outcome.settled).toBe(false);
    } finally {
      // Dilepas dalam `finally` supaya transaksi pertama tidak pernah
      // tertinggal terbuka di database cloud, bahkan bila assert di atas
      // gagal (temuan review putaran 1).
      release.resolve();
      await first.done;
    }

    await second;
    expect(outcome.result?.ok).toBe(true);
  });
});
