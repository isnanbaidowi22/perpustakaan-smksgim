# Perpustakaan — Rencana 02: Master Data

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Petugas dapat mengelola Kategori, Rak, Siswa, Buku, dan Eksemplar lewat layar sungguhan: tambah, ubah, cari, filter, nonaktifkan. Setiap perubahan tercatat di audit log.

**Architecture:** Setiap entitas terdiri atas lima lapis tipis dengan satu tanggung jawab masing-masing. `server/validation/` mengubah isian form menjadi data bertipe (zod). `server/services/` menulis ke database di dalam transaksi, sekaligus menulis audit log. `server/queries/` membaca data. `server/actions/` adalah Server Action tipis yang merangkai ketiganya lewat satu helper baku (`runFormAction`), sehingga urutan otorisasi → validasi → tulis → revalidasi tidak pernah tertukar. `app/` hanya menyusun layar dari komponen UI bersama. Service dan query menerima parameter `executor`, sehingga uji integrasi dapat menyuntikkan transaksi yang **selalu di-rollback**.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS 4 · Drizzle ORM 0.45 · Supabase Postgres · zod 4 · Vitest 5

**Spec:** `docs/superpowers/specs/2026-09-21-sistem-peminjaman-perpustakaan-design.md`
**Rencana sebelumnya:** `docs/superpowers/plans/2026-09-21-perpustakaan-01-fondasi-domain.md` (selesai, commit `d2a84a6`)

**Pembagian rencana.** Rencana 01 menyebut tiga rencana. Karena cakupan non-transaksi ternyata besar, pembagiannya menjadi:

| Rencana | Isi |
|---|---|
| 02 (ini) | Master Data: Kategori, Rak, Siswa, Buku, Eksemplar |
| 03 | Pengaturan: Tahun Ajaran, Pengguna, Konfigurasi |
| 04 | Transaksi: Peminjaman, Pengembalian, Pelunasan Denda, Riwayat |
| 05 | Dashboard, Cetak struk dan label barcode, Tampilan audit log |
| 06 | Laporan (PRD FR-10, bab 12.2): Peminjaman, Pengembalian, Keterlambatan, Koleksi, Riwayat Siswa |

Laporan sempat keluar dari lingkup spec (2.2) tanpa dicatat sebagai penyimpangan dari PRD. Pemilik produk memutuskan pada 25 September 2026 bahwa laporan tetap dibangun, sebagai Rencana 06 setelah transaksi tersedia. Rencana ini hanya menambahkan menu Laporan di sidebar (Task 3).

Transaksi (Rencana 04) tidak bergantung pada layar Rencana 03: tahun ajaran aktif, konfigurasi, dan akun sudah tersedia dari skrip seed.

## Global Constraints

- **Versi terpasang:** `next@16.3.5`, `react@19.2.8`, `drizzle-orm@0.45.3`, `vitest@5.0.1`, `zod@4.6.5` (dipasang di Task 2). Node.js 24.
- **Lingkungan Windows:** Node berada di `D:\nvm\nodejs` dan **tidak** ada di PATH shell agen. Awali setiap perintah `npm`/`npx` dengan `export PATH="/d/nvm/nodejs:$PATH";` (Git Bash) atau `$env:Path = "D:\nvm\nodejs;" + $env:Path;` (PowerShell).
- **TypeScript mode `strict`.** `any` implisit maupun eksplisit dilarang.
- **Tanggal kalender direpresentasikan sebagai untai `'YYYY-MM-DD'`,** bukan objek `Date`.
- **`src/domain/**` tetap murni:** dilarang mengimpor `src/server/**`, `src/app/**`, `src/components/**`, `drizzle-orm`, `@supabase/*`, `postgres`, atau `next`. Aturan ESLint dari Rencana 01 menegakkannya.
- **Nilai status, persis seperti tertulis:** status eksemplar `TERSEDIA` `DIPINJAM` `RUSAK` `HILANG` `NONAKTIF`; status data master `active` `inactive`; peran `admin` `petugas`.
- **Seluruh teks antarmuka berbahasa Indonesia.** Nama variabel, fungsi, dan tabel berbahasa Inggris.
- **Setiap pesan galat menyebut entitas dan tindakan yang harus diambil.** "Transaksi gagal" atau "Terjadi kesalahan" tidak diterima di mana pun.
- **DATABASE_URL menunjuk ke database pengembangan di Supabase cloud yang berisi data seed.** Uji integrasi **dilarang** memakai `truncate`, `delete` tanpa `where`, atau commit apa pun. Setiap uji integrasi berjalan di dalam `withRollback()` (Task 1). Nilai unik buatan uji selalu berawalan `UJI-` agar tidak bertabrakan dengan data seed.
- **Setiap Server Action penulis data memakai `runFormAction` atau `runCommand`** (Task 2). Tidak ada Server Action yang memanggil service langsung tanpa otorisasi.
- **Berkas `'use server'` hanya berisi Server Action.** Setiap ekspor fungsi dari berkas `'use server'` menjadi endpoint publik; service dan query yang menerima `executor` tidak boleh berada di sana.
- **Setiap perubahan data master menulis satu baris `audit_logs` di transaksi yang sama.**
- **Data master tidak pernah dihapus permanen;** dinonaktifkan lewat kolom `status`. (BR-08, PRD 13.3)
- **Otorisasi (spec Section 7):** kelola kategori, rak, siswa, buku, dan tambah eksemplar → `admin` dan `petugas`. Ubah status eksemplar secara manual (pulihkan rusak/hilang, tarik dari koleksi, aktifkan kembali) → hanya `admin`.
- **Next.js 16:** `params` dan `searchParams` pada halaman adalah `Promise` dan wajib di-`await`.
- **Desktop dan tablet (PRD bab 9):** setiap tabel daftar dibungkus `<ScrollTable>`; tata letak form memakai kolom ganda hanya dari breakpoint `sm` ke atas. Tidak ada elemen yang membuat halaman melebar melewati layar 768px.
- **Repo ini memasang hook tdd-guard.** Urutan langkah di setiap task (uji gagal → implementasi → uji lulus) wajib diikuti; hook menolak implementasi yang ditulis sebelum ujinya.
- **Setiap commit diakhiri baris:** `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

---

## Struktur Berkas

| Berkas | Tanggung jawab |
|---|---|
| `vitest.integration.config.ts` | Konfigurasi Vitest khusus uji integrasi |
| `tests/integration/load-env.ts` | Memuat `.env.local` sebelum uji integrasi |
| `tests/integration/helpers.ts` | `withRollback`, `testActor`, `expectConstraint` |
| `src/server/db/executor.ts` | Tipe `Database`, `Transaction`, `Executor` |
| `src/server/db/errors.ts` | Mengenali pelanggaran constraint unik Postgres |
| `src/server/audit.ts` | Menulis satu baris audit log |
| `src/lib/form-state.ts` | Bentuk state form yang dibagi server dan klien |
| `src/lib/options.ts` | Tipe opsi `<select>` |
| `src/lib/format.ts` | Format rupiah dan tanggal untuk tampilan |
| `src/lib/pagination.ts` | Perhitungan halaman |
| `src/lib/search-params.ts` | Membaca dan menyusun query string |
| `src/server/validation/common.ts` | Pembangun skema zod untuk kolom form |
| `src/server/validation/{category,rack,student,book,copy}.ts` | Skema form per entitas |
| `src/server/services/result.ts` | Bentuk hasil service |
| `src/server/services/{categories,racks,students,books,copies}.ts` | Penulisan data per entitas |
| `src/server/queries/like.ts` | Pola ILIKE yang aman dari wildcard pengguna |
| `src/server/queries/{categories,racks,students,books,copies,academic-years}.ts` | Pembacaan data per entitas |
| `src/server/forms/run-action.ts` | Urutan baku Server Action |
| `src/server/actions/{categories,racks,students,books,copies}.ts` | Server Action per entitas |
| `src/domain/copy/barcode.ts` | Format barcode otomatis `BK-000123` |
| `src/domain/copy/manual-status.ts` | Perubahan status eksemplar di luar pinjam-kembali |
| `src/components/ui/button-styles.ts` | Kelas tombol |
| `src/components/ui/table-styles.ts` | Kelas sel tabel |
| `src/components/ui/scroll-table.tsx` | Tabel yang dapat digulir ke samping di layar sempit |
| `src/components/layout/app-shell.tsx` | Kerangka responsif: sidebar tetap di desktop, tombol Menu di tablet |
| `src/components/ui/action-form.tsx` | Form dengan state dari Server Action |
| `src/components/ui/fields.tsx` | Kolom teks, pilihan, dan area teks yang menampilkan galatnya sendiri |
| `src/components/ui/action-button.tsx` | Tombol satu aksi dengan pesan hasil |
| `src/components/ui/page-header.tsx` | Judul halaman dan tombol aksinya |
| `src/components/ui/flash.tsx` | Pesan sukses dari `?pesan=` |
| `src/components/ui/filter-bar.tsx` | Form pencarian dan filter |
| `src/components/ui/pagination.tsx` | Navigasi halaman |
| `src/components/ui/record-status-badge.tsx` | Badge Aktif/Nonaktif |
| `src/app/(app)/master/kategori/**` | Layar kategori |
| `src/app/(app)/master/rak/**` | Layar rak |
| `src/app/(app)/master/siswa/**` | Layar siswa |
| `src/app/(app)/master/buku/**` | Layar buku dan eksemplar |

---

## Task 1: Harness Uji Integrasi dan Lapisan Database

Uji integrasi Rencana 01 memakai `truncate`. Sekarang DATABASE_URL menunjuk ke database cloud yang berisi data seed, jadi `truncate` menghapus data sungguhan. Task ini mengganti pendekatan itu dengan transaksi yang selalu di-rollback, sebelum ada uji integrasi baru yang ditulis.

**Files:**
- Create: `vitest.integration.config.ts`, `tests/integration/load-env.ts`, `tests/integration/helpers.ts`, `tests/integration/rollback.test.ts`, `tests/integration/audit.test.ts`
- Create: `src/server/db/executor.ts`, `src/server/db/errors.ts`, `src/server/db/errors.test.ts`, `src/server/audit.ts`
- Modify: `tests/integration/schema.test.ts` (ganti seluruh isi), `package.json` (skrip `test:integration`), `src/domain/shared/types.ts` (tambah `Actor`), `src/server/db/schema.ts` (tipe kolom status), `README.md`

**Interfaces:**
- Consumes: `db`, `schema` dari `src/server/db/client.ts`
- Produces:
  - `type Database`, `type Transaction`, `type Executor = Database | Transaction`
  - `uniqueViolation(error: unknown): string | null`
  - `interface AuditEntry { actorId: string; action: string; entity: string; entityId: string; metadata?: Record<string, unknown> }`
  - `writeAudit(executor: Executor, entry: AuditEntry): Promise<void>`
  - `interface Actor { id: string; role: UserRole }` di `src/domain/shared/types.ts`
  - `withRollback(fn: (tx: Transaction) => Promise<void>): Promise<void>`
  - `testActor(tx: Transaction, role?: UserRole): Promise<Actor>`
  - `expectConstraint(promise: Promise<unknown>, constraint: string): Promise<void>`
  - Kolom `status`/`role`/`gender`/`returnCondition` di `schema.ts` kini bertipe union (`RecordStatus`, `CopyStatus`, dst.), bukan `string`

- [x] **Step 1: Tulis uji pengenal pelanggaran unik yang gagal**

Buat `src/server/db/errors.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { uniqueViolation } from './errors';

describe('uniqueViolation', () => {
  it('mengenali galat Postgres yang dibungkus DrizzleQueryError', () => {
    const wrapped = Object.assign(new Error('Failed query: insert ...'), {
      cause: { code: '23505', constraint_name: 'categories_name_unique' },
    });
    expect(uniqueViolation(wrapped)).toBe('categories_name_unique');
  });

  it('mengenali galat Postgres yang tidak dibungkus', () => {
    expect(uniqueViolation({ code: '23505', constraint_name: 'racks_code_unique' })).toBe('racks_code_unique');
  });

  it('mengabaikan pelanggaran constraint selain unik', () => {
    expect(uniqueViolation({ code: '23503', constraint_name: 'books_category_id_categories_id_fk' })).toBeNull();
  });

  it('mengabaikan nilai yang bukan galat Postgres', () => {
    expect(uniqueViolation(new Error('jaringan putus'))).toBeNull();
    expect(uniqueViolation(null)).toBeNull();
    expect(uniqueViolation('23505')).toBeNull();
  });
});
```

Bentuk galat di atas diambil dari percobaan langsung terhadap database: Drizzle 0.45 membungkus galat `postgres` di dalam `DrizzleQueryError.cause`, dan galat aslinya membawa `code` serta `constraint_name`.

- [x] **Step 2: Jalankan uji untuk memastikan gagal**

Jalankan: `npx vitest run src/server/db/errors.test.ts`
Harapan: GAGAL dengan "Failed to resolve import './errors'".

- [x] **Step 3: Implementasikan pengenal pelanggaran unik**

Buat `src/server/db/errors.ts`:

```ts
interface PostgresErrorLike {
  code?: unknown;
  constraint_name?: unknown;
  cause?: unknown;
}

/**
 * Drizzle membungkus galat Postgres di dalam `DrizzleQueryError.cause`,
 * sedangkan galat dari klien `postgres` langsung tidak dibungkus.
 * Fungsi ini menelusuri rantai `cause` sampai menemukan kode SQLSTATE.
 */
function postgresError(error: unknown): PostgresErrorLike | null {
  if (typeof error !== 'object' || error === null) return null;
  const candidate = error as PostgresErrorLike;
  if (typeof candidate.code === 'string') return candidate;
  return postgresError(candidate.cause);
}

/** Nama constraint unik yang dilanggar, atau null bila galatnya bukan pelanggaran unik. */
export function uniqueViolation(error: unknown): string | null {
  const pg = postgresError(error);
  if (pg?.code !== '23505') return null;
  return typeof pg.constraint_name === 'string' ? pg.constraint_name : null;
}
```

- [x] **Step 4: Jalankan uji untuk memastikan lulus**

Jalankan: `npx vitest run src/server/db/errors.test.ts`
Harapan: LULUS, 4 uji.

- [x] **Step 5: Tambahkan tipe `Actor` dan tipe executor**

Tambahkan di akhir `src/domain/shared/types.ts`:

```ts
/** Pengguna yang sedang melakukan aksi, sebagaimana dilihat aturan bisnis dan audit log. */
export interface Actor {
  id: string;
  role: UserRole;
}
```

Buat `src/server/db/executor.ts`:

```ts
import type { db } from './client';

/** Instance Drizzle utama. */
export type Database = typeof db;

/** Transaksi Drizzle. Bila bersarang, Drizzle menjadikannya savepoint. */
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * Apa pun yang dapat menjalankan kueri. Service dan query menerima tipe ini
 * agar uji integrasi dapat menyuntikkan transaksi yang di-rollback, sementara
 * Server Action cukup memakai nilai bawaan `db`.
 */
export type Executor = Database | Transaction;
```

`import type` membuat berkas ini tidak pernah memuat `client.ts` saat runtime, sehingga tidak memicu pemeriksaan `DATABASE_URL`. Tipe gabungan ini sudah diverifikasi dengan `tsc`: `select`, `insert`, `update`, dan `transaction` dapat dipanggil pada `Executor` tanpa galat tipe.

- [x] **Step 6: Beri kolom status tipe union di skema**

Ubah `src/server/db/schema.ts`. Tambahkan impor di bagian atas:

```ts
import type {
  CopyStatus, LoanStatus, RecordStatus, ReturnCondition, UserRole,
} from '@/domain/shared/types';
```

Lalu ganti definisi kolom berikut. Hanya tipe TypeScript yang berubah; SQL yang dihasilkan tetap sama.

```ts
// profiles
role: text('role').$type<UserRole>().notNull(),
status: text('status').$type<RecordStatus>().notNull().default('active'),

// categories
status: text('status').$type<RecordStatus>().notNull().default('active'),

// racks
status: text('status').$type<RecordStatus>().notNull().default('active'),

// books
status: text('status').$type<RecordStatus>().notNull().default('active'),

// bookCopies
status: text('status').$type<CopyStatus>().notNull().default('TERSEDIA'),

// students
gender: text('gender').$type<'L' | 'P'>(),
status: text('status').$type<RecordStatus>().notNull().default('active'),

// loans
status: text('status').$type<LoanStatus>().notNull().default('AKTIF'),

// loanItems
returnCondition: text('return_condition').$type<ReturnCondition>(),
```

- [x] **Step 7: Pastikan skema database tidak berubah**

```bash
npm run db:generate
```

Harapan: Drizzle Kit melaporkan tidak ada perubahan skema dan tidak membuat berkas SQL baru di `drizzle/`. Bila berkas migrasi baru muncul, ada kolom yang salah diubah. Hapus berkas itu dan periksa ulang Step 6.

Lalu jalankan `npm test` dan `npx tsc --noEmit`.
Harapan: seluruh uji unit lulus, tanpa galat tipe.

- [x] **Step 8: Buat konfigurasi dan pemuat env uji integrasi**

Buat `vitest.integration.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

/**
 * Konfigurasi terpisah, bukan mergeConfig dari vitest.config.ts:
 * mergeConfig menggabungkan array `include`, sehingga uji unit ikut berjalan.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    setupFiles: ['tests/integration/load-env.ts'],
    // Satu berkas pada satu waktu: seluruh berkas berbagi satu database cloud.
    fileParallelism: false,
    // Setiap kueri menempuh perjalanan pulang-pergi ke Singapura.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
});
```

Buat `tests/integration/load-env.ts`:

```ts
import { config } from 'dotenv';

// Dijalankan Vitest sebelum setiap berkas uji integrasi mengimpor apa pun,
// sehingga `src/server/db/client.ts` sudah melihat DATABASE_URL.
config({ path: '.env.local', quiet: true });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL belum diatur di .env.local; uji integrasi tidak dapat berjalan.');
}
```

Ubah skrip di `package.json`:

```json
"test:integration": "vitest run --config vitest.integration.config.ts"
```

- [x] **Step 9: Tulis uji harness rollback yang gagal**

Buat `tests/integration/rollback.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { categories } from '@/server/db/schema';
import { testActor, withRollback } from './helpers';

describe('withRollback', () => {
  it('tidak meninggalkan data apa pun setelah uji selesai', async () => {
    const name = `UJI-${crypto.randomUUID()}`;

    await withRollback(async (tx) => {
      await tx.insert(categories).values({ name });
      const inside = await tx.select().from(categories).where(eq(categories.name, name));
      expect(inside).toHaveLength(1);
    });

    const after = await db.select().from(categories).where(eq(categories.name, name));
    expect(after).toEqual([]);
  });

  it('meneruskan kegagalan asersi di dalamnya', async () => {
    await expect(
      withRollback(async () => {
        expect(1).toBe(2);
      }),
    ).rejects.toThrow();
  });
});

describe('testActor', () => {
  it('mengembalikan profil admin aktif dari data seed', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      expect(actor.role).toBe('admin');
      expect(actor.id).toMatch(/^[0-9a-f-]{36}$/);
    });
  });
});
```

- [x] **Step 10: Jalankan uji untuk memastikan gagal**

Jalankan: `npm run test:integration -- tests/integration/rollback.test.ts`
Harapan: GAGAL dengan "Failed to resolve import './helpers'".

- [x] **Step 11: Implementasikan harness**

Buat `tests/integration/helpers.ts`:

```ts
import { expect } from 'vitest';
import { and, eq, TransactionRollbackError } from 'drizzle-orm';
import type { Actor, UserRole } from '@/domain/shared/types';
import { db } from '@/server/db/client';
import type { Transaction } from '@/server/db/executor';
import { profiles } from '@/server/db/schema';

/**
 * Menjalankan `fn` di dalam transaksi yang SELALU di-rollback.
 *
 * DATABASE_URL menunjuk ke database pengembangan di Supabase cloud yang
 * berisi data seed. Uji integrasi tidak boleh meninggalkan jejak di sana:
 * tidak ada `truncate`, tidak ada commit. Setiap uji hidup dan mati di dalam
 * satu transaksi. Service yang membuka transaksi sendiri akan mendapat
 * savepoint, sehingga galat di dalam service tidak merusak transaksi uji.
 */
export async function withRollback(fn: (tx: Transaction) => Promise<void>): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      await fn(tx);
      tx.rollback();
    });
  } catch (error) {
    if (error instanceof TransactionRollbackError) return;
    throw error;
  }
}

/**
 * Profil sungguhan untuk kolom yang mereferensikan `profiles`
 * (audit_logs.user_id, loans.created_by). Profil tidak dapat dibuat di dalam
 * uji karena `profiles.id` mereferensikan `auth.users` milik Supabase.
 */
export async function testActor(tx: Transaction, role: UserRole = 'admin'): Promise<Actor> {
  const [profile] = await tx
    .select({ id: profiles.id, role: profiles.role })
    .from(profiles)
    .where(and(eq(profiles.role, role), eq(profiles.status, 'active')))
    .limit(1);

  if (!profile) {
    throw new Error(`Tidak ada profil ${role} aktif. Jalankan "npm run db:seed" sebelum uji integrasi.`);
  }
  return profile;
}

/**
 * Memastikan sebuah kueri ditolak oleh constraint tertentu.
 * Pesan galat Drizzle hanya berisi SQL; nama constraint ada di `cause`.
 * Pernyataan yang gagal membatalkan transaksi, jadi panggil ini paling akhir.
 */
export async function expectConstraint(promise: Promise<unknown>, constraint: string): Promise<void> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  expect(error, `kueri seharusnya ditolak ${constraint}`).not.toBeNull();
  const cause = (error as { cause?: { constraint_name?: string } }).cause;
  expect(cause?.constraint_name).toBe(constraint);
}
```

- [x] **Step 12: Jalankan uji untuk memastikan lulus**

Jalankan: `npm run test:integration -- tests/integration/rollback.test.ts`
Harapan: LULUS, 3 uji. Bila `testActor` gagal dengan "Tidak ada profil admin aktif", jalankan `npm run db:seed` terlebih dahulu.

- [x] **Step 13: Tulis ulang uji batasan skema tanpa `truncate`**

Ganti seluruh isi `tests/integration/schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { expectConstraint, withRollback } from './helpers';

describe('batasan academic_years', () => {
  it('menolak dua tahun ajaran aktif sekaligus', async () => {
    await withRollback(async (tx) => {
      // Database pengembangan sudah punya tahun ajaran aktif dari seed.
      // Matikan dulu di dalam transaksi ini agar uji tidak bergantung padanya.
      await tx.execute(sql`update academic_years set is_active = false`);
      await tx.execute(sql`insert into academic_years (name, start_date, end_date, is_active)
                           values ('UJI-2090/2091', '2090-07-01', '2091-06-30', true)`);

      await expectConstraint(
        tx.execute(sql`insert into academic_years (name, start_date, end_date, is_active)
                       values ('UJI-2091/2092', '2091-07-01', '2092-06-30', true)`),
        'one_active_academic_year',
      );
    });
  });

  it('mengizinkan banyak tahun ajaran tidak aktif', async () => {
    await withRollback(async (tx) => {
      await tx.execute(sql`insert into academic_years (name, start_date, end_date, is_active)
                           values ('UJI-2088/2089', '2088-07-01', '2089-06-30', false),
                                  ('UJI-2089/2090', '2089-07-01', '2090-06-30', false)`);
      const rows = await tx.execute<{ n: number }>(
        sql`select count(*)::int as n from academic_years where name like 'UJI-%'`,
      );
      expect(rows[0].n).toBe(2);
    });
  });

  it('menolak tanggal selesai sebelum tanggal mulai', async () => {
    await withRollback(async (tx) => {
      await expectConstraint(
        tx.execute(sql`insert into academic_years (name, start_date, end_date)
                       values ('UJI-salah', '2091-06-30', '2090-07-01')`),
        'academic_years_range_valid',
      );
    });
  });
});

describe('batasan book_copies', () => {
  it('menolak status di luar daftar yang sah', async () => {
    await withRollback(async (tx) => {
      const [book] = await tx.execute<{ id: string }>(
        sql`insert into books (title, author) values ('UJI-Judul', 'UJI-Penulis') returning id`,
      );
      await expectConstraint(
        tx.execute(sql`insert into book_copies (book_id, barcode, status)
                       values (${book.id}, 'UJI-000001', 'ENTAH')`),
        'book_copies_status_valid',
      );
    });
  });

  it('menolak barcode ganda', async () => {
    await withRollback(async (tx) => {
      const [book] = await tx.execute<{ id: string }>(
        sql`insert into books (title, author) values ('UJI-Judul', 'UJI-Penulis') returning id`,
      );
      await tx.execute(sql`insert into book_copies (book_id, barcode) values (${book.id}, 'UJI-000001')`);
      await expectConstraint(
        tx.execute(sql`insert into book_copies (book_id, barcode) values (${book.id}, 'UJI-000001')`),
        'book_copies_barcode_unique',
      );
    });
  });
});
```

- [x] **Step 14: Jalankan uji batasan skema**

Jalankan: `npm run test:integration -- tests/integration/schema.test.ts`
Harapan: LULUS, 5 uji.

Lalu pastikan data seed tidak tersentuh:

```bash
npx tsx --env-file=.env.local -e "import('./src/server/db/client').then(async ({ db, schema }) => { console.log((await db.select().from(schema.books)).length, 'judul'); process.exit(0); })"
```

Harapan: jumlah judul sama dengan sebelum uji dijalankan (2 dari seed).

- [x] **Step 15: Tulis uji audit log yang gagal**

Buat `tests/integration/audit.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { writeAudit } from '@/server/audit';
import { auditLogs } from '@/server/db/schema';
import { testActor, withRollback } from './helpers';

describe('writeAudit', () => {
  it('menyimpan pelaku, aksi, entitas, dan metadata', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const entityId = crypto.randomUUID();

      await writeAudit(tx, {
        actorId: actor.id,
        action: 'category.create',
        entity: 'categories',
        entityId,
        metadata: { name: 'UJI-Fiksi' },
      });

      const [row] = await tx
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.entity, 'categories'), eq(auditLogs.entityId, entityId)));
      expect(row).toMatchObject({
        userId: actor.id,
        action: 'category.create',
        metadata: { name: 'UJI-Fiksi' },
      });
    });
  });
});
```

- [x] **Step 16: Jalankan uji untuk memastikan gagal**

Jalankan: `npm run test:integration -- tests/integration/audit.test.ts`
Harapan: GAGAL dengan "Failed to resolve import '@/server/audit'".

- [x] **Step 17: Implementasikan penulis audit log**

Buat `src/server/audit.ts`:

```ts
import type { Executor } from '@/server/db/executor';
import { auditLogs } from '@/server/db/schema';

export interface AuditEntry {
  actorId: string;
  /** Format `<entitas>.<aksi>`, misalnya `category.create`. */
  action: string;
  /** Nama tabel yang berubah, misalnya `categories`. */
  entity: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

/**
 * Dipanggil dengan transaksi yang sama dengan perubahan datanya,
 * sehingga perubahan tanpa jejak audit tidak mungkin ter-commit.
 */
export async function writeAudit(executor: Executor, entry: AuditEntry): Promise<void> {
  await executor.insert(auditLogs).values({
    userId: entry.actorId,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    metadata: entry.metadata ?? null,
  });
}
```

Tabel diimpor dari `schema.ts`, bukan dari `client.ts`, supaya berkas ini tidak memuat koneksi database hanya untuk mendapatkan definisi tabel.

- [x] **Step 18: Jalankan uji untuk memastikan lulus**

Jalankan: `npm run test:integration`
Harapan: LULUS, 9 uji (3 rollback, 5 skema, 1 audit).

- [x] **Step 19: Dokumentasikan cara kerja uji integrasi**

Tambahkan di akhir `README.md`:

```markdown
## Uji

| Perintah | Isi | Butuh database |
| --- | --- | --- |
| `npm test` | Uji unit di `src/` | Tidak |
| `npm run test:integration` | Uji integrasi di `tests/integration/` | Ya, dari `.env.local` |

`DATABASE_URL` menunjuk ke database pengembangan di Supabase cloud yang
berisi data seed. Karena itu setiap uji integrasi berjalan di dalam
`withRollback()` (`tests/integration/helpers.ts`): transaksi selalu
di-rollback, sehingga uji tidak meninggalkan jejak. **Jangan pernah menulis
`truncate` atau `delete` tanpa `where` di uji integrasi.** Beri awalan `UJI-`
pada nilai unik buatan uji agar tidak bertabrakan dengan data seed.

Uji integrasi membutuhkan akun `admin` dari `npm run db:seed`.
```

- [x] **Step 20: Jalankan seluruh uji dan commit**

```bash
npm test
npm run test:integration
npm run lint
git add -A
git commit -m "$(cat <<'EOF'
test(db): uji integrasi dengan transaksi yang selalu di-rollback

DATABASE_URL kini menunjuk ke database cloud berisi data seed, sehingga
truncate di uji integrasi menghapus data sungguhan. Setiap uji kini
berjalan di dalam withRollback(). Ditambah pengenal pelanggaran unik,
penulis audit log, dan tipe union untuk kolom status.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Lapisan Form: Validasi, Otorisasi, dan Urutan Baku Server Action

**Files:**
- Modify: `package.json` (dependensi `zod`), `src/server/auth/guard.ts`, `src/server/auth/guard.test.ts`
- Create: `src/lib/form-state.ts`, `src/lib/form-state.test.ts`, `src/server/validation/common.ts`, `src/server/validation/common.test.ts`, `src/server/services/result.ts`, `src/server/forms/run-action.ts`, `src/server/forms/run-action.test.ts`

**Interfaces:**
- Consumes: `Actor`, `UserRole`, `RecordStatus` dari `src/domain/shared/types.ts`; `requireProfile` dari `src/server/auth/guard.ts`
- Produces:
  - `type FieldErrors = Record<string, string[]>`
  - `type FormState = { status: 'idle' } | { status: 'success'; message: string } | { status: 'error'; message: string; fieldErrors: FieldErrors; values: Record<string, string> }`
  - `IDLE: FormState`, `formError(message, fieldErrors?, values?)`, `formSuccess(message)`, `formToObject(formData): Record<string, string>`
  - `requiredText(message, max?)`, `optionalText(max?)`, `optionalUuid(message)`, `optionalInteger(message, min, max)`, `rupiah(message)`, `isUuid(value): value is string`, `isRecordStatus(value): value is RecordStatus`
  - `type ServiceResult = { ok: true; id: string; notice?: string } | { ok: false; message: string; field?: string }`, `ok(id, notice?)`, `fail(message, field?)`
  - `authorize(roles: UserRole[]): Promise<{ ok: true; actor: Actor } | { ok: false; message: string }>`
  - `runFormAction(options): Promise<FormState>`, `runCommand(options): Promise<FormState>`

- [x] **Step 1: Pasang zod**

```bash
npm install zod@^4.6.5
```

zod sudah ada di `node_modules` sebagai dependensi transitif `eslint-config-next`. Memasangnya eksplisit mencegah versinya berubah diam-diam ketika dependensi lain diperbarui.

- [x] **Step 2: Tulis uji state form yang gagal**

Buat `src/lib/form-state.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formError, formSuccess, formToObject, IDLE } from './form-state';

describe('formToObject', () => {
  it('mengambil isian teks dan membuang kunci internal React', () => {
    const data = new FormData();
    data.set('name', 'Fiksi');
    data.set('$ACTION_ID_abc', '');
    expect(formToObject(data)).toEqual({ name: 'Fiksi' });
  });

  it('membuang berkas unggahan', () => {
    const data = new FormData();
    data.set('cover', new File(['x'], 'sampul.png'));
    data.set('title', 'Pemrograman Web');
    expect(formToObject(data)).toEqual({ title: 'Pemrograman Web' });
  });
});

describe('pembentuk state', () => {
  it('membentuk state galat dengan kolom dan isian sebelumnya', () => {
    expect(formError('Kategori belum dapat disimpan.', { name: ['Wajib diisi.'] }, { name: '' })).toEqual({
      status: 'error',
      message: 'Kategori belum dapat disimpan.',
      fieldErrors: { name: ['Wajib diisi.'] },
      values: { name: '' },
    });
  });

  it('memberi nilai kosong pada kolom dan isian bila tidak disebut', () => {
    expect(formError('Akses ditolak.')).toEqual({
      status: 'error', message: 'Akses ditolak.', fieldErrors: {}, values: {},
    });
  });

  it('membentuk state sukses dan state awal', () => {
    expect(formSuccess('Tersimpan.')).toEqual({ status: 'success', message: 'Tersimpan.' });
    expect(IDLE).toEqual({ status: 'idle' });
  });
});
```

- [x] **Step 3: Jalankan uji untuk memastikan gagal**

Jalankan: `npx vitest run src/lib/form-state.test.ts`
Harapan: GAGAL dengan "Failed to resolve import './form-state'".

- [x] **Step 4: Implementasikan state form**

Buat `src/lib/form-state.ts`:

```ts
export type FieldErrors = Record<string, string[]>;

/**
 * State yang dikembalikan Server Action ke `useActionState`.
 * Berada di `lib/`, bukan `server/`, karena komponen klien ikut membacanya.
 */
export type FormState =
  | { status: 'idle' }
  | { status: 'success'; message: string }
  | {
      status: 'error';
      message: string;
      fieldErrors: FieldErrors;
      /**
       * Isian terakhir. React 19 mengosongkan form setelah Server Action
       * selesai; tanpa ini petugas harus mengetik ulang seluruh isian
       * hanya karena satu kolom salah.
       */
      values: Record<string, string>;
    };

export const IDLE: FormState = { status: 'idle' };

export function formError(
  message: string,
  fieldErrors: FieldErrors = {},
  values: Record<string, string> = {},
): FormState {
  return { status: 'error', message, fieldErrors, values };
}

export function formSuccess(message: string): FormState {
  return { status: 'success', message };
}

/**
 * Mengambil isian teks dari FormData. Kunci internal React (`$ACTION_…`)
 * dan berkas unggahan dibuang, sehingga skema validasi hanya melihat isian.
 */
export function formToObject(formData: FormData): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('$ACTION_') || typeof value !== 'string') continue;
    result[key] = value;
  }
  return result;
}
```

- [x] **Step 5: Jalankan uji untuk memastikan lulus**

Jalankan: `npx vitest run src/lib/form-state.test.ts`
Harapan: LULUS, 5 uji.

- [x] **Step 6: Tulis uji pembangun skema yang gagal**

Buat `src/server/validation/common.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  isRecordStatus, isUuid, optionalInteger, optionalText, optionalUuid, requiredText, rupiah,
} from './common';

function messageOf(result: z.ZodSafeParseResult<unknown>): string | undefined {
  return result.success ? undefined : result.error.issues[0]?.message;
}

describe('requiredText', () => {
  const schema = requiredText('Nama kategori wajib diisi.', 10);

  it('membuang spasi di ujung', () => {
    expect(schema.parse('  Fiksi  ')).toBe('Fiksi');
  });

  it('menolak isian kosong atau hanya spasi dengan pesan yang diberikan', () => {
    expect(messageOf(schema.safeParse('   '))).toBe('Nama kategori wajib diisi.');
  });

  it('menolak isian yang tidak dikirim sama sekali dengan pesan yang sama', () => {
    expect(messageOf(schema.safeParse(undefined))).toBe('Nama kategori wajib diisi.');
  });

  it('menolak isian melebihi batas panjang', () => {
    expect(messageOf(schema.safeParse('Sebelas kar'))).toBe('Maksimal 10 karakter.');
  });
});

describe('optionalText', () => {
  it('menyimpan isian kosong sebagai null, bukan untai kosong', () => {
    expect(optionalText().parse('   ')).toBeNull();
    expect(optionalText().parse(undefined)).toBeNull();
  });

  it('membuang spasi di ujung isian yang terisi', () => {
    expect(optionalText().parse(' Ruang Utama ')).toBe('Ruang Utama');
  });
});

describe('optionalUuid', () => {
  const schema = optionalUuid('Kategori tidak valid. Pilih dari daftar.');

  it('menganggap opsi kosong sebagai null', () => {
    expect(schema.parse('')).toBeNull();
  });

  it('menerima UUID', () => {
    const id = '6f1c2b1e-4b1a-4c3e-9f7a-2d1e3c4b5a6f';
    expect(schema.parse(id)).toBe(id);
  });

  it('menolak nilai yang bukan UUID', () => {
    expect(messageOf(schema.safeParse('bukan-uuid'))).toBe('Kategori tidak valid. Pilih dari daftar.');
  });
});

describe('optionalInteger', () => {
  const schema = optionalInteger('Tahun terbit harus antara 1800 dan 2100.', 1800, 2100);

  it('menganggap isian kosong sebagai null', () => {
    expect(schema.parse('')).toBeNull();
  });

  it('mengubah teks angka menjadi bilangan', () => {
    expect(schema.parse('2024')).toBe(2024);
  });

  it.each(['19x', '1799', '2101', '2024.5'])('menolak %s', (value) => {
    expect(messageOf(schema.safeParse(value))).toBe('Tahun terbit harus antara 1800 dan 2100.');
  });
});

describe('rupiah', () => {
  const schema = rupiah('Harga harus bilangan bulat rupiah, minimal 0.');

  it('menerima titik pemisah ribuan yang biasa diketik petugas', () => {
    expect(schema.parse('85.000')).toBe(85_000);
  });

  it('menganggap isian kosong sebagai nol', () => {
    expect(schema.parse('')).toBe(0);
  });

  it.each(['-1', 'delapan', '1,5'])('menolak %s', (value) => {
    expect(messageOf(schema.safeParse(value))).toBe('Harga harus bilangan bulat rupiah, minimal 0.');
  });
});

describe('penjaga tipe', () => {
  it('isUuid mengenali UUID dan menolak selainnya', () => {
    expect(isUuid('6f1c2b1e-4b1a-4c3e-9f7a-2d1e3c4b5a6f')).toBe(true);
    expect(isUuid('c1')).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });

  it('isRecordStatus hanya menerima active dan inactive', () => {
    expect(isRecordStatus('active')).toBe(true);
    expect(isRecordStatus('inactive')).toBe(true);
    expect(isRecordStatus('deleted')).toBe(false);
  });
});
```

- [x] **Step 7: Jalankan uji untuk memastikan gagal**

Jalankan: `npx vitest run src/server/validation/common.test.ts`
Harapan: GAGAL dengan "Failed to resolve import './common'".

- [x] **Step 8: Implementasikan pembangun skema**

Buat `src/server/validation/common.ts`:

```ts
import { z } from 'zod';
import type { RecordStatus } from '@/domain/shared/types';

/** Teks wajib. Spasi di ujung dibuang sebelum diperiksa. */
export function requiredText(message: string, max = 200) {
  return z
    .string({ error: message })
    .trim()
    .min(1, message)
    .max(max, `Maksimal ${max} karakter.`);
}

/** Teks opsional. Isian kosong disimpan sebagai null, bukan ''. */
export function optionalText(max = 500) {
  return z
    .string()
    .optional()
    .transform((value) => (value ?? '').trim())
    .pipe(z.string().max(max, `Maksimal ${max} karakter.`))
    .transform((value) => (value === '' ? null : value));
}

/** Pilihan opsional dari `<select>`. Opsi kosong berarti null. */
export function optionalUuid(message: string) {
  return z
    .string()
    .optional()
    .transform((value) => (value ?? '').trim() || null)
    .pipe(z.uuid(message).nullable());
}

/** Bilangan bulat opsional dalam rentang tertutup. Isian kosong berarti null. */
export function optionalInteger(message: string, min: number, max: number) {
  return z
    .string()
    .optional()
    .transform((value) => {
      const trimmed = (value ?? '').trim();
      return trimmed === '' ? null : Number(trimmed);
    })
    .pipe(z.number({ error: message }).int(message).min(min, message).max(max, message).nullable());
}

/**
 * Nominal rupiah tanpa desimal. Titik pemisah ribuan diterima karena
 * petugas terbiasa mengetik "85.000". Isian kosong berarti 0.
 */
export function rupiah(message: string) {
  return z
    .string()
    .optional()
    .transform((value) => {
      const digits = (value ?? '').replace(/[.\s]/g, '');
      return digits === '' ? 0 : Number(digits);
    })
    .pipe(z.number({ error: message }).int(message).min(0, message));
}

const uuidSchema = z.uuid();

/**
 * Id yang datang dari URL atau argumen Server Action dapat diubah siapa saja.
 * Memeriksanya lebih dulu mencegah Postgres melempar galat sintaks UUID.
 */
export function isUuid(value: unknown): value is string {
  return uuidSchema.safeParse(value).success;
}

export function isRecordStatus(value: unknown): value is RecordStatus {
  return value === 'active' || value === 'inactive';
}
```

- [x] **Step 9: Jalankan uji untuk memastikan lulus**

Jalankan: `npx vitest run src/server/validation/common.test.ts`
Harapan: LULUS, 22 uji.

- [x] **Step 10: Tulis uji `authorize` yang gagal**

Tambahkan ke `src/server/auth/guard.test.ts`. Ubah baris impor menjadi `import { authorize, requireProfile, requireRole } from './guard';`, lalu tambahkan di akhir berkas:

```ts
describe('authorize', () => {
  it('mengembalikan pelaku ketika perannya diizinkan', async () => {
    mockGetCurrentProfile.mockResolvedValueOnce({ id: 'u1', role: 'petugas', status: 'active' });
    await expect(authorize(['admin', 'petugas'])).resolves.toEqual({
      ok: true,
      actor: { id: 'u1', role: 'petugas' },
    });
  });

  it('mengembalikan pesan penolakan, bukan melempar galat, ketika peran tidak diizinkan', async () => {
    mockGetCurrentProfile.mockResolvedValueOnce({ id: 'u1', role: 'petugas', status: 'active' });
    await expect(authorize(['admin'])).resolves.toEqual({
      ok: false,
      message: 'Akses ditolak. Aksi ini hanya untuk peran: admin. Akun Anda berperan petugas.',
    });
  });
});
```

- [x] **Step 11: Jalankan uji untuk memastikan gagal**

Jalankan: `npx vitest run src/server/auth/guard.test.ts`
Harapan: GAGAL; `authorize` belum diekspor.

- [x] **Step 12: Implementasikan `authorize`**

Ganti seluruh isi `src/server/auth/guard.ts`:

```ts
import { redirect } from 'next/navigation';
import type { Actor, UserRole } from '@/domain/shared/types';
import { getCurrentProfile, type Profile } from './session';

export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  return profile;
}

function deniedMessage(roles: UserRole[], role: UserRole): string {
  return `Akses ditolak. Aksi ini hanya untuk peran: ${roles.join(', ')}. Akun Anda berperan ${role}.`;
}

/**
 * Dipanggil di awal setiap Server Action yang mengubah data.
 * Otorisasi ditegakkan di server, bukan dengan menyembunyikan tombol.
 */
export async function requireRole(roles: UserRole[]): Promise<Profile> {
  const profile = await requireProfile();
  if (!roles.includes(profile.role)) {
    throw new Error(deniedMessage(roles, profile.role));
  }
  return profile;
}

export type Authorization =
  | { ok: true; actor: Actor }
  | { ok: false; message: string };

/**
 * Seperti requireRole, tetapi mengembalikan hasil alih-alih melempar galat.
 * Next.js menyamarkan galat yang dilempar Server Action di produksi menjadi
 * pesan generik; hasil yang dikembalikan tetap terbaca utuh oleh petugas.
 */
export async function authorize(roles: UserRole[]): Promise<Authorization> {
  const profile = await requireProfile();
  if (!roles.includes(profile.role)) {
    return { ok: false, message: deniedMessage(roles, profile.role) };
  }
  return { ok: true, actor: { id: profile.id, role: profile.role } };
}
```

`profile.role` kini bertipe `UserRole` berkat Task 1 Step 6, jadi cast `as UserRole` dari Rencana 01 tidak diperlukan lagi.

- [x] **Step 13: Jalankan uji untuk memastikan lulus**

Jalankan: `npx vitest run src/server/auth/guard.test.ts`
Harapan: LULUS, 4 uji.

- [x] **Step 14: Buat bentuk hasil service**

Buat `src/server/services/result.ts`:

```ts
/**
 * Hasil setiap service penulis data. Kegagalan yang dapat diperbaiki petugas
 * (nama ganda, data tidak ditemukan) dikembalikan sebagai nilai berisi pesan
 * siap tampil. Galat tak terduga tetap dilempar.
 */
export type ServiceResult =
  | { ok: true; id: string; notice?: string }
  | { ok: false; message: string; field?: string };

/** `notice` adalah catatan tambahan yang ditampilkan bersama pesan sukses. */
export function ok(id: string, notice?: string): ServiceResult {
  return notice ? { ok: true, id, notice } : { ok: true, id };
}

/** `field` adalah nama kolom form yang menyebabkan kegagalan, bila ada. */
export function fail(message: string, field?: string): ServiceResult {
  return field ? { ok: false, message, field } : { ok: false, message };
}
```

Berkas ini hanya berisi tipe dan dua pembentuk nilai; perilakunya teruji lewat `run-action.test.ts` dan uji integrasi setiap service.

- [x] **Step 15: Tulis uji urutan baku Server Action yang gagal**

Buat `src/server/forms/run-action.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { UserRole } from '@/domain/shared/types';
import { formError, formSuccess } from '@/lib/form-state';
import { requiredText } from '@/server/validation/common';
import type { ServiceResult } from '@/server/services/result';

const { mockAuthorize, mockRevalidatePath, mockRedirect } = vi.hoisted(() => ({
  mockAuthorize: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockRedirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

vi.mock('@/server/auth/guard', () => ({ authorize: mockAuthorize }));
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }));
vi.mock('next/navigation', () => ({ redirect: mockRedirect }));

import { runCommand, runFormAction } from './run-action';

const actor = { id: 'u1', role: 'petugas' as const };
const schema = z.object({ name: requiredText('Nama kategori wajib diisi.') });

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

function options(overrides: Partial<Parameters<typeof runFormAction<typeof schema>>[0]> = {}) {
  return {
    roles: ['admin', 'petugas'] as UserRole[],
    schema,
    formData: form({ name: 'Fiksi' }),
    invalidMessage: 'Kategori belum dapat disimpan. Periksa kolom yang ditandai.',
    execute: vi.fn(async (): Promise<ServiceResult> => ({ ok: true, id: 'c1' })),
    successMessage: 'Kategori berhasil disimpan.',
    revalidate: ['/master/kategori'],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthorize.mockResolvedValue({ ok: true, actor });
});

describe('runFormAction', () => {
  it('menolak sebelum membaca isian bila peran tidak diizinkan', async () => {
    mockAuthorize.mockResolvedValueOnce({ ok: false, message: 'Akses ditolak.' });
    const execute = vi.fn();

    const state = await runFormAction(options({ execute }));

    expect(state).toEqual(formError('Akses ditolak.'));
    expect(execute).not.toHaveBeenCalled();
  });

  it('mengembalikan galat per kolom beserta isian sebelumnya bila validasi gagal', async () => {
    const execute = vi.fn();

    const state = await runFormAction(options({ execute, formData: form({ name: '   ' }) }));

    expect(state).toEqual(formError(
      'Kategori belum dapat disimpan. Periksa kolom yang ditandai.',
      { name: ['Nama kategori wajib diisi.'] },
      { name: '   ' },
    ));
    expect(execute).not.toHaveBeenCalled();
  });

  it('meneruskan data tervalidasi dan pelaku ke service', async () => {
    const opts = options({ formData: form({ name: '  Fiksi  ' }) });

    await runFormAction(opts);

    expect(opts.execute).toHaveBeenCalledWith({ name: 'Fiksi' }, actor);
  });

  it('memetakan kegagalan service ke kolom yang disebut', async () => {
    const execute = vi.fn(async (): Promise<ServiceResult> => ({
      ok: false, message: 'Kategori "Fiksi" sudah ada.', field: 'name',
    }));

    const state = await runFormAction(options({ execute }));

    expect(state).toEqual(formError(
      'Kategori "Fiksi" sudah ada.',
      { name: ['Kategori "Fiksi" sudah ada.'] },
      { name: 'Fiksi' },
    ));
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('merevalidasi halaman lalu mengembalikan pesan sukses beserta catatan service', async () => {
    const execute = vi.fn(async (): Promise<ServiceResult> => ({
      ok: true, id: 'b1', notice: 'Perhatian: harga buku masih Rp0.',
    }));

    const state = await runFormAction(options({ execute }));

    expect(mockRevalidatePath).toHaveBeenCalledWith('/master/kategori');
    expect(state).toEqual(formSuccess('Kategori berhasil disimpan. Perhatian: harga buku masih Rp0.'));
  });

  it('pindah ke halaman tujuan dengan pesan sukses di query string', async () => {
    await expect(runFormAction(options({ redirectTo: '/master/kategori' }))).rejects.toThrow('NEXT_REDIRECT');
    expect(mockRedirect).toHaveBeenCalledWith('/master/kategori?pesan=Kategori%20berhasil%20disimpan.');
  });

  it('dapat menyusun halaman tujuan dari id yang baru disimpan', async () => {
    await expect(
      runFormAction(options({ redirectTo: (id: string) => `/master/buku/${id}` })),
    ).rejects.toThrow('NEXT_REDIRECT');
    expect(mockRedirect).toHaveBeenCalledWith('/master/buku/c1?pesan=Kategori%20berhasil%20disimpan.');
  });
});

describe('runCommand', () => {
  it('menolak tanpa memanggil service bila peran tidak diizinkan', async () => {
    mockAuthorize.mockResolvedValueOnce({ ok: false, message: 'Akses ditolak.' });
    const execute = vi.fn();

    const state = await runCommand({ roles: ['admin'], execute, successMessage: 'Selesai.', revalidate: [] });

    expect(state).toEqual(formError('Akses ditolak.'));
    expect(execute).not.toHaveBeenCalled();
  });

  it('menjalankan service dengan pelaku lalu merevalidasi', async () => {
    const execute = vi.fn(async (): Promise<ServiceResult> => ({ ok: true, id: 'c1' }));

    const state = await runCommand({
      roles: ['admin', 'petugas'], execute, successMessage: 'Kategori dinonaktifkan.', revalidate: ['/master/kategori'],
    });

    expect(execute).toHaveBeenCalledWith(actor);
    expect(mockRevalidatePath).toHaveBeenCalledWith('/master/kategori');
    expect(state).toEqual(formSuccess('Kategori dinonaktifkan.'));
  });
});
```

- [x] **Step 16: Jalankan uji untuk memastikan gagal**

Jalankan: `npx vitest run src/server/forms/run-action.test.ts`
Harapan: GAGAL dengan "Failed to resolve import './run-action'".

- [x] **Step 17: Implementasikan urutan baku Server Action**

Buat `src/server/forms/run-action.ts`:

```ts
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { z } from 'zod';
import type { Actor, UserRole } from '@/domain/shared/types';
import { formError, formSuccess, formToObject, type FieldErrors, type FormState } from '@/lib/form-state';
import { authorize } from '@/server/auth/guard';
import type { ServiceResult } from '@/server/services/result';

interface Completion {
  successMessage: string;
  /** Halaman yang datanya berubah; diperbarui setelah berhasil. */
  revalidate: string[];
  /**
   * Bila diisi, pindah ke halaman ini dan tampilkan pesan sukses di sana.
   * Bentuk fungsi menerima id data yang baru disimpan, misalnya untuk
   * membuka halaman detail buku yang baru dibuat.
   */
  redirectTo?: string | ((id: string) => string);
}

interface FormActionOptions<S extends z.ZodType> extends Completion {
  roles: UserRole[];
  schema: S;
  formData: FormData;
  /** Pesan umum saat ada kolom tidak valid, menyebut entitasnya. */
  invalidMessage: string;
  execute: (data: z.output<S>, actor: Actor) => Promise<ServiceResult>;
}

interface CommandOptions extends Completion {
  roles: UserRole[];
  execute: (actor: Actor) => Promise<ServiceResult>;
}

/**
 * Urutan baku setiap Server Action penulis data:
 * otorisasi → validasi → service → revalidasi → (pindah halaman).
 * Otorisasi selalu pertama, sebelum isian form dibaca sama sekali.
 */
export async function runFormAction<S extends z.ZodType>(options: FormActionOptions<S>): Promise<FormState> {
  const auth = await authorize(options.roles);
  if (!auth.ok) return formError(auth.message);

  const values = formToObject(options.formData);
  const parsed = options.schema.safeParse(values);
  if (!parsed.success) {
    return formError(options.invalidMessage, fieldErrorsOf(parsed.error), values);
  }

  const result = await options.execute(parsed.data, auth.actor);
  return complete(result, options, values);
}

/** Untuk aksi tanpa isian form, misalnya menonaktifkan data. */
export async function runCommand(options: CommandOptions): Promise<FormState> {
  const auth = await authorize(options.roles);
  if (!auth.ok) return formError(auth.message);

  const result = await options.execute(auth.actor);
  return complete(result, options, {});
}

function fieldErrorsOf(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? '');
    (errors[field] ??= []).push(issue.message);
  }
  return errors;
}

function complete(result: ServiceResult, completion: Completion, values: Record<string, string>): FormState {
  if (!result.ok) {
    const fieldErrors = result.field ? { [result.field]: [result.message] } : {};
    return formError(result.message, fieldErrors, values);
  }

  for (const path of completion.revalidate) revalidatePath(path);

  const message = result.notice ? `${completion.successMessage} ${result.notice}` : completion.successMessage;
  if (completion.redirectTo) {
    const target = typeof completion.redirectTo === 'function'
      ? completion.redirectTo(result.id)
      : completion.redirectTo;
    // redirect() melempar; sengaja berada di luar try/catch mana pun.
    redirect(`${target}?pesan=${encodeURIComponent(message)}`);
  }
  return formSuccess(message);
}
```

- [x] **Step 18: Jalankan uji untuk memastikan lulus**

Jalankan: `npx vitest run src/server/forms/run-action.test.ts`
Harapan: LULUS, 9 uji.

- [x] **Step 19: Jalankan seluruh uji unit dan lint, lalu commit**

```bash
npm test
npm run lint
npx tsc --noEmit
git add -A
git commit -m "$(cat <<'EOF'
feat(form): validasi zod, otorisasi tanpa lempar, dan urutan baku Server Action

runFormAction menjamin urutan otorisasi, validasi, tulis, lalu revalidasi
di setiap Server Action. Penolakan akses dikembalikan sebagai state, bukan
dilempar, karena Next.js menyamarkan galat yang dilempar di produksi.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Komponen UI Bersama dan Kerangka yang Sadar Peran

PRD bab 9 mewajibkan aplikasi dapat dipakai di **desktop dan tablet**. Di tablet tegak (768px), sidebar permanen 240px menyisakan sekitar 500px untuk tabel 6–7 kolom. Karena itu task ini juga membuat tabel yang dapat digulir ke samping (`ScrollTable`) dan sidebar yang tersembunyi di bawah lebar 1024px dan dibuka lewat tombol **Menu** (`AppShell`). PRD bab 11 juga mencantumkan grup menu **Laporan**; tautannya ditambahkan sekarang, halamannya dibuat di Rencana 06.

**Files:**
- Modify: `src/components/layout/sidebar.tsx`, `src/components/layout/sidebar.test.tsx`, `src/components/layout/topbar.tsx`, `src/components/layout/topbar.test.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/layout.test.tsx`
- Create: `src/components/layout/app-shell.tsx`, `src/components/layout/app-shell.test.tsx`
- Create: `src/lib/options.ts`, `src/lib/format.ts`, `src/lib/format.test.ts`, `src/lib/pagination.ts`, `src/lib/pagination.test.ts`, `src/lib/search-params.ts`, `src/lib/search-params.test.ts`
- Create: `src/components/ui/button-styles.ts`, `src/components/ui/table-styles.ts`, `src/components/ui/scroll-table.tsx`, `src/components/ui/action-form.tsx`, `src/components/ui/fields.tsx`, `src/components/ui/action-form.test.tsx`, `src/components/ui/action-button.tsx`, `src/components/ui/action-button.test.tsx`, `src/components/ui/page-header.tsx`, `src/components/ui/flash.tsx`, `src/components/ui/filter-bar.tsx`, `src/components/ui/pagination.tsx`, `src/components/ui/record-status-badge.tsx`, `src/components/ui/list-parts.test.tsx`

**Interfaces:**
- Consumes: `FormState`, `IDLE` dari `src/lib/form-state.ts`; `signOut` dari `src/server/actions/auth.ts`; `UserRole`, `RecordStatus` dari domain
- Produces:
  - `interface Option { value: string; label: string }`
  - `formatRupiah(amount: number | string): string`, `formatDate(value: string | null): string`
  - `PAGE_SIZE = 25`, `parsePage(value: string): number`, `pageCount(total: number): number`, `offsetOf(page: number): number`
  - `type SearchParams`, `type StatusFilter = 'active' | 'inactive' | 'all'`, `firstValue(value)`, `parseStatusFilter(value: string): StatusFilter`, `withQuery(path, params): string`
  - `buttonClass(variant?: 'primary' | 'secondary' | 'danger', size?: 'md' | 'sm'): string`, `TH`, `TD`
  - `<ScrollTable>`: pembungkus `<table>` yang dapat digulir ke samping; setiap tabel daftar di Task 4–8 memakainya
  - `type FormAction = (state: FormState, formData: FormData) => Promise<FormState>`
  - `<ActionForm action submitLabel cancelHref? initialState?>`, `useField(name, fallback)`
  - `<TextField>`, `<SelectField>`, `<TextAreaField>`
  - `<ActionButton action label pendingLabel? confirmText? variant?>`
  - `<PageHeader title description? actions?>`, `<Flash message>`, `<FilterBar q placeholder>`, `<FilterSelect name label value options>`, `STATUS_OPTIONS`, `<Pagination path page total query>`, `<RecordStatusBadge status>`
  - `<Sidebar role>`: grup Laporan untuk semua peran; grup Pengaturan hanya tampil untuk `admin`
  - `<Topbar>` kini memiliki tombol **Keluar**
  - `<AppShell sidebar topbar>`: kerangka responsif; di bawah `lg` (1024px) sidebar tersembunyi dan dibuka lewat tombol Menu

- [x] **Step 1: Tulis uji utilitas tampilan yang gagal**

Buat `src/lib/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatDate, formatRupiah } from './format';

describe('formatRupiah', () => {
  it('memakai titik pemisah ribuan tanpa spasi setelah Rp', () => {
    expect(formatRupiah(85_000)).toBe('Rp85.000');
  });

  it('menerima nilai numeric dari Postgres yang berbentuk teks', () => {
    expect(formatRupiah('92000.00')).toBe('Rp92.000');
  });

  it('menampilkan nol sebagai Rp0', () => {
    expect(formatRupiah(0)).toBe('Rp0');
  });
});

describe('formatDate', () => {
  it('mengubah YYYY-MM-DD menjadi DD/MM/YYYY', () => {
    expect(formatDate('2026-09-24')).toBe('24/09/2026');
  });

  it('menampilkan tanda pisah untuk tanggal kosong', () => {
    expect(formatDate(null)).toBe('—');
  });
});
```

Buat `src/lib/pagination.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { offsetOf, PAGE_SIZE, pageCount, parsePage } from './pagination';

describe('parsePage', () => {
  it('membaca nomor halaman yang sah', () => {
    expect(parsePage('3')).toBe(3);
  });

  it.each(['', '0', '-2', 'dua', '1.5'])('kembali ke halaman 1 untuk %j', (value) => {
    expect(parsePage(value)).toBe(1);
  });
});

describe('pageCount dan offsetOf', () => {
  it('selalu ada minimal satu halaman', () => {
    expect(pageCount(0)).toBe(1);
  });

  it('membulatkan ke atas', () => {
    expect(pageCount(PAGE_SIZE + 1)).toBe(2);
  });

  it('menghitung offset dari nomor halaman', () => {
    expect(offsetOf(1)).toBe(0);
    expect(offsetOf(3)).toBe(PAGE_SIZE * 2);
  });
});
```

Buat `src/lib/search-params.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { firstValue, parseStatusFilter, withQuery } from './search-params';

describe('firstValue', () => {
  it('mengambil nilai pertama dari parameter berulang', () => {
    expect(firstValue(['a', 'b'])).toBe('a');
  });

  it('mengubah parameter yang tidak ada menjadi untai kosong', () => {
    expect(firstValue(undefined)).toBe('');
  });
});

describe('parseStatusFilter', () => {
  it('menampilkan data aktif secara bawaan', () => {
    expect(parseStatusFilter('')).toBe('active');
    expect(parseStatusFilter('entah')).toBe('active');
  });

  it('menerima inactive dan all', () => {
    expect(parseStatusFilter('inactive')).toBe('inactive');
    expect(parseStatusFilter('all')).toBe('all');
  });
});

describe('withQuery', () => {
  it('menyusun query string dan membuang parameter kosong', () => {
    expect(withQuery('/master/kategori', { q: 'fiksi', status: '', hal: 2 })).toBe('/master/kategori?q=fiksi&hal=2');
  });

  it('mengembalikan path apa adanya bila tidak ada parameter', () => {
    expect(withQuery('/master/kategori', { q: '' })).toBe('/master/kategori');
  });
});
```

- [x] **Step 2: Jalankan uji untuk memastikan gagal**

Jalankan: `npx vitest run src/lib`
Harapan: GAGAL; `./format`, `./pagination`, dan `./search-params` belum ada.

- [x] **Step 3: Implementasikan utilitas tampilan**

Buat `src/lib/options.ts`:

```ts
/** Satu opsi `<select>`. Dibentuk oleh query, ditampilkan oleh komponen. */
export interface Option {
  value: string;
  label: string;
}
```

Buat `src/lib/format.ts`:

```ts
/** `Rp85.000`, penulisan yang dipakai spec dan PRD. */
export function formatRupiah(amount: number | string): string {
  return `Rp${Math.round(Number(amount)).toLocaleString('id-ID')}`;
}

/** `'2026-09-24'` → `'24/09/2026'`. Tanpa objek Date, jadi tanpa geser zona waktu. */
export function formatDate(value: string | null): string {
  if (!value) return '—';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}
```

Buat `src/lib/pagination.ts`:

```ts
export const PAGE_SIZE = 25;

export function parsePage(value: string): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

export function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

export function offsetOf(page: number): number {
  return (page - 1) * PAGE_SIZE;
}
```

Buat `src/lib/search-params.ts`:

```ts
/** Bentuk prop `searchParams` halaman Next.js 16 — sebuah Promise. */
export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export type StatusFilter = 'active' | 'inactive' | 'all';

export function firstValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

/** Daftar data master menampilkan yang aktif kecuali diminta lain. */
export function parseStatusFilter(value: string): StatusFilter {
  return value === 'inactive' || value === 'all' ? value : 'active';
}

export function withQuery(path: string, params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}
```

- [x] **Step 4: Jalankan uji untuk memastikan lulus**

Jalankan: `npx vitest run src/lib`
Harapan: LULUS, seluruh uji di `src/lib` (termasuk `form-state.test.ts` dari Task 2).

- [x] **Step 5: Tulis uji form dan kolom yang gagal**

Buat `src/components/ui/action-form.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { formError } from '@/lib/form-state';
import { ActionForm } from './action-form';
import { SelectField, TextAreaField, TextField } from './fields';

describe('ActionForm', () => {
  it('menampilkan kolom, tombol simpan, dan tautan batal', () => {
    const html = renderToStaticMarkup(
      <ActionForm action={vi.fn()} submitLabel="Simpan Kategori" cancelHref="/master/kategori">
        <TextField name="name" label="Nama kategori" required />
      </ActionForm>,
    );
    expect(html).toContain('name="name"');
    expect(html).toContain('Simpan Kategori');
    expect(html).toContain('href="/master/kategori"');
    expect(html).not.toContain('role="alert"');
  });

  it('menampilkan galat umum, galat kolom, dan isian terakhir setelah validasi gagal', () => {
    const state = formError(
      'Kategori belum dapat disimpan. Periksa kolom yang ditandai.',
      { name: ['Nama kategori wajib diisi.'] },
      { name: 'Fik', note: 'catatan lama' },
    );
    const html = renderToStaticMarkup(
      <ActionForm action={vi.fn()} submitLabel="Simpan" initialState={state}>
        <TextField name="name" label="Nama kategori" defaultValue="" />
        <TextAreaField name="note" label="Catatan" />
      </ActionForm>,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('Kategori belum dapat disimpan. Periksa kolom yang ditandai.');
    expect(html).toContain('Nama kategori wajib diisi.');
    expect(html).toContain('value="Fik"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('catatan lama');
  });

  it('SelectField menampilkan opsi kosong dan memilih nilai bawaan', () => {
    const html = renderToStaticMarkup(
      <ActionForm action={vi.fn()} submitLabel="Simpan">
        <SelectField
          name="categoryId"
          label="Kategori"
          placeholder="— Tanpa kategori —"
          defaultValue="c2"
          options={[{ value: 'c1', label: 'Fiksi' }, { value: 'c2', label: 'Sains' }]}
        />
      </ActionForm>,
    );
    expect(html).toContain('— Tanpa kategori —');
    expect(html).toMatch(/<option value="c2" selected="">Sains<\/option>/);
  });
});
```

- [x] **Step 6: Jalankan uji untuk memastikan gagal**

Jalankan: `npx vitest run src/components/ui/action-form.test.tsx`
Harapan: GAGAL dengan "Failed to resolve import './action-form'".

- [x] **Step 7: Implementasikan gaya tombol, form, dan kolom**

Buat `src/components/ui/button-styles.ts`:

```ts
type Variant = 'primary' | 'secondary' | 'danger';
type Size = 'md' | 'sm';

const BASE = 'inline-flex items-center justify-center rounded-md font-medium disabled:opacity-60';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-[var(--color-accent-600)] text-white hover:bg-[var(--color-accent-500)]',
  secondary:
    'border border-[var(--color-ink-300)] bg-white text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)]',
  danger:
    'border border-[var(--color-status-terlambat)] bg-white text-[var(--color-status-terlambat)] hover:bg-[var(--color-status-terlambat)]/10',
};

const SIZES: Record<Size, string> = {
  md: 'px-4 py-2 text-sm',
  sm: 'px-2.5 py-1 text-xs',
};

/** Satu sumber kelas tombol, dipakai `<button>` maupun `<Link>`. */
export function buttonClass(variant: Variant = 'primary', size: Size = 'md'): string {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]}`;
}
```

Buat `src/components/ui/table-styles.ts`:

```ts
/** Kelas sel tabel. Pembungkus tabelnya adalah `<ScrollTable>`. */
export const TH =
  'border-b border-[var(--color-ink-100)] bg-[var(--color-ink-50)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-500)]';
export const TD = 'border-b border-[var(--color-ink-100)] px-3 py-2 align-middle';
```

Buat `src/components/ui/action-form.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { createContext, useActionState, useContext, type ReactNode } from 'react';
import { IDLE, type FormState } from '@/lib/form-state';
import { buttonClass } from './button-styles';

export type FormAction = (state: FormState, formData: FormData) => Promise<FormState>;

const FormStateContext = createContext<FormState>(IDLE);

/**
 * Nilai dan galat sebuah kolom menurut state terakhir form.
 * Setelah validasi gagal, isian terakhir menggantikan nilai bawaan
 * sehingga petugas tidak mengetik ulang.
 */
export function useField(name: string, fallback: string): { value: string; error?: string } {
  const state = useContext(FormStateContext);
  if (state.status !== 'error') return { value: fallback };
  return { value: state.values[name] ?? fallback, error: state.fieldErrors[name]?.[0] };
}

export function ActionForm({
  action,
  submitLabel,
  cancelHref,
  children,
  initialState = IDLE,
}: {
  action: FormAction;
  submitLabel: string;
  cancelHref?: string;
  children: ReactNode;
  /** Hanya untuk uji; di aplikasi form selalu mulai dari IDLE. */
  initialState?: FormState;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <FormStateContext value={state}>
      <form
        action={formAction}
        className="max-w-2xl space-y-4 rounded-lg border border-[var(--color-ink-100)] bg-white p-6"
      >
        {state.status === 'error' && (
          <p
            role="alert"
            className="rounded-md bg-[var(--color-status-terlambat)]/10 px-3 py-2 text-sm text-[var(--color-status-terlambat)]"
          >
            {state.message}
          </p>
        )}
        {state.status === 'success' && (
          <p
            role="status"
            className="rounded-md bg-[var(--color-status-tersedia)]/10 px-3 py-2 text-sm text-[var(--color-status-tersedia)]"
          >
            {state.message}
          </p>
        )}
        {children}
        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={pending} className={buttonClass('primary')}>
            {pending ? 'Menyimpan…' : submitLabel}
          </button>
          {cancelHref && (
            <Link href={cancelHref} className={buttonClass('secondary')}>
              Batal
            </Link>
          )}
        </div>
      </form>
    </FormStateContext>
  );
}
```

Buat `src/components/ui/fields.tsx`:

```tsx
'use client';

import type { ReactNode } from 'react';
import type { Option } from '@/lib/options';
import { useField } from './action-form';

const CONTROL =
  'w-full rounded-md border border-[var(--color-ink-300)] bg-white px-3 py-2 text-sm aria-[invalid=true]:border-[var(--color-status-terlambat)]';

interface BaseProps {
  name: string;
  label: string;
  hint?: string;
  required?: boolean;
  defaultValue?: string;
}

function describedBy(name: string, error?: string, hint?: string): string | undefined {
  if (error) return `${name}-error`;
  return hint ? `${name}-hint` : undefined;
}

function FieldShell({
  name, label, hint, required, error, children,
}: Omit<BaseProps, 'defaultValue'> & { error?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium">
        {label}
        {required && <span aria-hidden="true" className="text-[var(--color-status-terlambat)]"> *</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${name}-hint`} className="mt-1 text-xs text-[var(--color-ink-500)]">{hint}</p>
      )}
      {error && (
        <p id={`${name}-error`} className="mt-1 text-xs font-medium text-[var(--color-status-terlambat)]">{error}</p>
      )}
    </div>
  );
}

export function TextField({
  name, label, hint, required, defaultValue = '', type = 'text', inputMode, autoFocus, maxLength,
}: BaseProps & {
  type?: 'text' | 'number' | 'date' | 'tel';
  inputMode?: 'text' | 'numeric' | 'tel';
  autoFocus?: boolean;
  maxLength?: number;
}) {
  const { value, error } = useField(name, defaultValue);
  return (
    <FieldShell name={name} label={label} hint={hint} required={required} error={error}>
      <input
        id={name}
        name={name}
        type={type}
        inputMode={inputMode}
        autoFocus={autoFocus}
        maxLength={maxLength}
        required={required}
        defaultValue={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, error, hint)}
        className={CONTROL}
      />
    </FieldShell>
  );
}

export function SelectField({
  name, label, hint, required, defaultValue = '', options, placeholder,
}: BaseProps & { options: Option[]; placeholder?: string }) {
  const { value, error } = useField(name, defaultValue);
  return (
    <FieldShell name={name} label={label} hint={hint} required={required} error={error}>
      {/* React memperbarui defaultValue <input> dan <textarea> saat prop berubah,
          tetapi tidak untuk <select>. Tanpa `key`, reset form bawaan React 19
          mengembalikan pilihan ke nilai awal setelah validasi gagal. */}
      <select
        key={value}
        id={name}
        name={name}
        required={required}
        defaultValue={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, error, hint)}
        className={CONTROL}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </FieldShell>
  );
}

export function TextAreaField({
  name, label, hint, required, defaultValue = '', rows = 3,
}: BaseProps & { rows?: number }) {
  const { value, error } = useField(name, defaultValue);
  return (
    <FieldShell name={name} label={label} hint={hint} required={required} error={error}>
      <textarea
        id={name}
        name={name}
        rows={rows}
        required={required}
        defaultValue={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, error, hint)}
        className={CONTROL}
      />
    </FieldShell>
  );
}
```

- [x] **Step 8: Jalankan uji untuk memastikan lulus**

Jalankan: `npx vitest run src/components/ui/action-form.test.tsx`
Harapan: LULUS, 3 uji.

- [x] **Step 9: Tulis uji tombol aksi yang gagal**

Buat `src/components/ui/action-button.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ActionButton } from './action-button';

describe('ActionButton', () => {
  it('menampilkan label tombol tanpa pesan sebelum ditekan', () => {
    const html = renderToStaticMarkup(<ActionButton action={vi.fn()} label="Nonaktifkan" />);
    expect(html).toContain('Nonaktifkan');
    expect(html).toContain('type="submit"');
    expect(html).not.toContain('role="alert"');
  });
});
```

- [x] **Step 10: Jalankan uji untuk memastikan gagal**

Jalankan: `npx vitest run src/components/ui/action-button.test.tsx`
Harapan: GAGAL dengan "Failed to resolve import './action-button'".

- [x] **Step 11: Implementasikan tombol aksi**

Buat `src/components/ui/action-button.tsx`:

```tsx
'use client';

import { useActionState } from 'react';
import { IDLE } from '@/lib/form-state';
import type { FormAction } from './action-form';
import { buttonClass } from './button-styles';

/**
 * Tombol untuk satu aksi tanpa isian, misalnya menonaktifkan data.
 * Hasilnya tampil tepat di bawah tombol. Galat yang dilempar Server Action
 * akan disamarkan Next.js di produksi, jadi aksi ini mengembalikan state.
 */
export function ActionButton({
  action,
  label,
  pendingLabel = 'Memproses…',
  confirmText,
  variant = 'secondary',
}: {
  action: FormAction;
  label: string;
  pendingLabel?: string;
  /** Bila diisi, petugas diminta konfirmasi sebelum aksi dijalankan. */
  confirmText?: string;
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  const [state, formAction, pending] = useActionState(action, IDLE);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (confirmText && !window.confirm(confirmText)) event.preventDefault();
      }}
      className="inline-flex flex-col items-end gap-1"
    >
      <button type="submit" disabled={pending} className={buttonClass(variant, 'sm')}>
        {pending ? pendingLabel : label}
      </button>
      {state.status === 'error' && (
        <span role="alert" className="max-w-64 text-right text-xs text-[var(--color-status-terlambat)]">
          {state.message}
        </span>
      )}
      {state.status === 'success' && (
        <span role="status" className="text-xs text-[var(--color-status-tersedia)]">{state.message}</span>
      )}
    </form>
  );
}
```

- [x] **Step 12: Jalankan uji untuk memastikan lulus**

Jalankan: `npx vitest run src/components/ui/action-button.test.tsx`
Harapan: LULUS, 1 uji.

- [x] **Step 13: Tulis uji komponen daftar yang gagal**

Buat `src/components/ui/list-parts.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PAGE_SIZE } from '@/lib/pagination';
import { FilterBar, FilterSelect, STATUS_OPTIONS } from './filter-bar';
import { Flash } from './flash';
import { PageHeader } from './page-header';
import { Pagination } from './pagination';
import { RecordStatusBadge } from './record-status-badge';
import { ScrollTable } from './scroll-table';

describe('PageHeader', () => {
  it('menampilkan judul, keterangan, dan aksi', () => {
    const html = renderToStaticMarkup(
      <PageHeader title="Kategori" description="Pengelompokan judul buku." actions={<a href="/x">Tambah</a>} />,
    );
    expect(html).toContain('<h1');
    expect(html).toContain('Pengelompokan judul buku.');
    expect(html).toContain('Tambah');
  });
});

describe('Flash', () => {
  it('menampilkan pesan sebagai status', () => {
    expect(renderToStaticMarkup(<Flash message="Kategori berhasil ditambahkan." />)).toContain('role="status"');
  });

  it('tidak menampilkan apa pun tanpa pesan', () => {
    expect(renderToStaticMarkup(<Flash message="" />)).toBe('');
  });
});

describe('FilterBar', () => {
  it('mengirim pencarian lewat GET dengan filter tambahan', () => {
    const html = renderToStaticMarkup(
      <FilterBar q="fiksi" placeholder="Cari nama kategori">
        <FilterSelect name="status" label="Filter status" value="all" options={STATUS_OPTIONS} />
      </FilterBar>,
    );
    expect(html).toContain('role="search"');
    expect(html).toContain('value="fiksi"');
    expect(html).toMatch(/<option value="all" selected="">Semua status<\/option>/);
  });
});

describe('Pagination', () => {
  it('tidak tampil bila hanya satu halaman', () => {
    expect(renderToStaticMarkup(<Pagination path="/master/kategori" page={1} total={3} query={{}} />)).toBe('');
  });

  it('membawa filter ke tautan halaman berikutnya', () => {
    const html = renderToStaticMarkup(
      <Pagination path="/master/kategori" page={1} total={PAGE_SIZE + 1} query={{ q: 'fiksi' }} />,
    );
    expect(html).toContain('Halaman 1 dari 2');
    expect(html).toContain('href="/master/kategori?q=fiksi&amp;hal=2"');
    expect(html).not.toContain('Sebelumnya');
  });
});

describe('RecordStatusBadge', () => {
  it('memakai teks dan ikon, tidak hanya warna', () => {
    expect(renderToStaticMarkup(<RecordStatusBadge status="active" />)).toContain('Aktif');
    expect(renderToStaticMarkup(<RecordStatusBadge status="inactive" />)).toContain('Nonaktif');
  });
});

describe('ScrollTable', () => {
  it('membungkus tabel dalam wadah yang dapat digulir ke samping di layar sempit', () => {
    const html = renderToStaticMarkup(
      <ScrollTable>
        <tbody><tr><td>isi</td></tr></tbody>
      </ScrollTable>,
    );
    expect(html).toMatch(/^<div class="[^"]*overflow-x-auto[^"]*"><table/);
    expect(html).toContain('<td>isi</td>');
  });
});
```

- [x] **Step 14: Jalankan uji untuk memastikan gagal**

Jalankan: `npx vitest run src/components/ui/list-parts.test.tsx`
Harapan: GAGAL; komponen-komponen belum ada.

- [x] **Step 15: Implementasikan komponen daftar**

Buat `src/components/ui/page-header.tsx`:

```tsx
import type { ReactNode } from 'react';

export function PageHeader({
  title, description, actions,
}: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="page-title text-2xl font-semibold">{title}</h1>
        {description && <p className="mt-1 text-sm text-[var(--color-ink-500)]">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
```

Buat `src/components/ui/flash.tsx`:

```tsx
/** Pesan sukses yang dibawa `?pesan=` setelah form berpindah halaman. */
export function Flash({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p
      role="status"
      className="mb-4 rounded-md bg-[var(--color-status-tersedia)]/10 px-3 py-2 text-sm text-[var(--color-status-tersedia)]"
    >
      {message}
    </p>
  );
}
```

Buat `src/components/ui/filter-bar.tsx`:

```tsx
import type { ReactNode } from 'react';
import type { Option } from '@/lib/options';
import { buttonClass } from './button-styles';

const CONTROL = 'rounded-md border border-[var(--color-ink-300)] bg-white px-3 py-2 text-sm';

export const STATUS_OPTIONS: Option[] = [
  { value: 'active', label: 'Aktif' },
  { value: 'inactive', label: 'Nonaktif' },
  { value: 'all', label: 'Semua status' },
];

/** Form GET: hasil pencarian dapat dibagikan dan di-bookmark lewat URL. */
export function FilterBar({ q, placeholder, children }: { q: string; placeholder: string; children?: ReactNode }) {
  return (
    <form role="search" className="mb-4 flex flex-wrap items-center gap-2">
      <input
        type="search"
        name="q"
        defaultValue={q}
        placeholder={placeholder}
        aria-label={placeholder}
        className={`${CONTROL} min-w-64 flex-1`}
      />
      {children}
      <button type="submit" className={buttonClass('secondary')}>Cari</button>
    </form>
  );
}

export function FilterSelect({
  name, label, value, options,
}: { name: string; label: string; value: string; options: Option[] }) {
  return (
    <select name={name} defaultValue={value} aria-label={label} className={CONTROL}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}
```

Buat `src/components/ui/pagination.tsx`:

```tsx
import Link from 'next/link';
import { pageCount } from '@/lib/pagination';
import { withQuery } from '@/lib/search-params';
import { buttonClass } from './button-styles';

export function Pagination({
  path, page, total, query,
}: { path: string; page: number; total: number; query: Record<string, string> }) {
  const pages = pageCount(total);
  if (pages <= 1) return null;

  return (
    <nav aria-label="Halaman" className="mt-4 flex items-center justify-between text-sm">
      <span className="text-[var(--color-ink-500)]">
        Halaman {page} dari {pages} · {total} data
      </span>
      <div className="flex gap-2">
        {page > 1 && (
          <Link href={withQuery(path, { ...query, hal: page - 1 })} className={buttonClass('secondary', 'sm')}>
            ← Sebelumnya
          </Link>
        )}
        {page < pages && (
          <Link href={withQuery(path, { ...query, hal: page + 1 })} className={buttonClass('secondary', 'sm')}>
            Berikutnya →
          </Link>
        )}
      </div>
    </nav>
  );
}
```

Buat `src/components/ui/record-status-badge.tsx`:

```tsx
import type { RecordStatus } from '@/domain/shared/types';

const BASE = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium';

/** Seperti StatusBadge eksemplar: ikon menyertai warna agar terbaca tanpa membedakan warna. */
export function RecordStatusBadge({ status }: { status: RecordStatus }) {
  if (status === 'active') {
    return (
      <span className={`${BASE} bg-[var(--color-status-tersedia)]/10 text-[var(--color-status-tersedia)]`}>
        <span aria-hidden="true">●</span>Aktif
      </span>
    );
  }
  return (
    <span className={`${BASE} bg-[var(--color-ink-100)] text-[var(--color-ink-500)]`}>
      <span aria-hidden="true">—</span>Nonaktif
    </span>
  );
}
```

Buat `src/components/ui/scroll-table.tsx`:

```tsx
import type { ReactNode } from 'react';

/**
 * Pembungkus setiap tabel daftar. PRD bab 9 mewajibkan aplikasi dapat dipakai
 * di tablet; tabel 6–7 kolom tidak muat di 768px, jadi tabel mempertahankan
 * lebar minimumnya dan wadahnya yang digulir ke samping, bukan halamannya.
 */
export function ScrollTable({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--color-ink-100)] bg-white">
      <table className="w-full min-w-[40rem] text-sm">{children}</table>
    </div>
  );
}
```

- [x] **Step 16: Jalankan uji untuk memastikan lulus**

Jalankan: `npx vitest run src/components/ui`
Harapan: LULUS, seluruh uji di `src/components/ui`.

- [x] **Step 17: Tulis uji kerangka yang sadar peran (gagal)**

Ganti seluruh isi `src/components/layout/sidebar.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Sidebar } from './sidebar';

const COMMON = [
  '/dashboard',
  '/master/buku',
  '/master/kategori',
  '/master/siswa',
  '/master/rak',
  '/transaksi/peminjaman',
  '/transaksi/pengembalian',
  '/transaksi/riwayat',
  // PRD bab 11 dan 5.1: laporan terlihat oleh admin dan petugas.
  '/laporan/peminjaman',
  '/laporan/pengembalian',
  '/laporan/keterlambatan',
  '/laporan/koleksi',
];

const ADMIN_ONLY = ['/pengaturan/tahun-ajaran', '/pengaturan/pengguna', '/pengaturan/konfigurasi'];

describe('Sidebar', () => {
  it('menampilkan seluruh menu untuk admin', () => {
    const html = renderToStaticMarkup(<Sidebar role="admin" />);
    for (const href of [...COMMON, ...ADMIN_ONLY]) {
      expect(html).toContain(`href="${href}"`);
    }
    expect(html).toContain('Pengaturan');
  });

  it('menyembunyikan grup Pengaturan dari petugas', () => {
    const html = renderToStaticMarkup(<Sidebar role="petugas" />);
    for (const href of COMMON) {
      expect(html).toContain(`href="${href}"`);
    }
    for (const href of ADMIN_ONLY) {
      expect(html).not.toContain(`href="${href}"`);
    }
    expect(html).not.toContain('Pengaturan');
  });
});
```

Ganti seluruh isi `src/components/layout/topbar.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// Topbar mengimpor Server Action signOut, yang memuat klien database.
vi.mock('@/server/actions/auth', () => ({ signOut: vi.fn() }));

import { Topbar } from './topbar';

describe('Topbar', () => {
  it('menampilkan tahun ajaran ketika tersedia', () => {
    const html = renderToStaticMarkup(<Topbar academicYear="2026/2027" userName="Petugas" />);
    expect(html).toContain('Tahun Ajaran');
    expect(html).toContain('2026/2027');
  });

  it('menampilkan peringatan ketika tidak ada tahun ajaran aktif', () => {
    const html = renderToStaticMarkup(<Topbar academicYear={null} userName="Petugas" />);
    expect(html).toContain('Belum ada tahun ajaran aktif');
    expect(html).not.toContain('Tahun Ajaran ');
  });

  it('menyediakan tombol keluar', () => {
    const html = renderToStaticMarkup(<Topbar academicYear="2026/2027" userName="Petugas" />);
    expect(html).toContain('Keluar');
  });
});
```

Buat `src/components/layout/app-shell.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({ usePathname: () => '/master/buku' }));

import { AppShell } from './app-shell';

function render() {
  return renderToStaticMarkup(
    <AppShell sidebar={<nav>isi sidebar</nav>} topbar={<header>isi topbar</header>}>
      <p>isi halaman</p>
    </AppShell>,
  );
}

describe('AppShell', () => {
  it('menyusun sidebar, top bar, dan isi halaman', () => {
    const html = render();
    expect(html).toContain('isi sidebar');
    expect(html).toContain('isi topbar');
    expect(html).toMatch(/<main[^>]*><p>isi halaman<\/p><\/main>/);
  });

  it('menyembunyikan sidebar di bawah lebar lg sampai tombol Menu ditekan', () => {
    const html = render();
    expect(html).toContain('id="navigasi-utama" class="hidden lg:flex"');
    expect(html).toMatch(/<button[^>]*aria-expanded="false"[^>]*aria-controls="navigasi-utama"/);
    expect(html).toContain('Menu');
  });
});
```

Perilaku membuka dan menutup menu diperiksa di peramban pada Task 9; uji ini memastikan susunan dan keadaan awalnya.

Di `src/app/(app)/layout.test.tsx`, tambahkan dua mock berikut tepat setelah `vi.mock('@/server/db/client', …)`:

```tsx
vi.mock('@/server/actions/auth', () => ({ signOut: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }));
```

Lalu ubah kedua `mockRequireProfile.mockResolvedValueOnce(...)` agar menyertakan peran:

```tsx
mockRequireProfile.mockResolvedValueOnce({ fullName: 'Petugas Perpustakaan', role: 'petugas' });
// …
mockRequireProfile.mockResolvedValueOnce({ fullName: 'Admin', role: 'admin' });
```

Dan tambahkan uji ketiga di dalam `describe('AppLayout')`:

```tsx
  it('meneruskan peran ke sidebar sehingga petugas tidak melihat Pengaturan', async () => {
    mockRequireProfile.mockResolvedValueOnce({ fullName: 'Petugas Perpustakaan', role: 'petugas' });
    mockLimit.mockResolvedValueOnce([{ name: '2026/2027' }]);

    const element = await AppLayout({ children: <div>isi</div> });
    const html = renderToStaticMarkup(element);

    expect(html).not.toContain('href="/pengaturan/pengguna"');
  });
```

- [x] **Step 18: Jalankan uji untuk memastikan gagal**

Jalankan: `npx vitest run src/components/layout "src/app/(app)/layout.test.tsx"`
Harapan: GAGAL; petugas masih melihat Pengaturan, menu Laporan dan tombol Keluar belum ada, dan `./app-shell` belum ada.

- [x] **Step 19: Implementasikan kerangka yang sadar peran**

Ganti seluruh isi `src/components/layout/sidebar.tsx`:

```tsx
import Link from 'next/link';
import type { UserRole } from '@/domain/shared/types';

interface NavSection {
  group: string | null;
  /** Bila diisi, grup hanya tampil untuk peran ini. Server tetap menegakkan aksesnya. */
  roles?: UserRole[];
  items: { href: string; label: string }[];
}

const NAV: NavSection[] = [
  { group: null, items: [{ href: '/dashboard', label: 'Dashboard' }] },
  {
    group: 'Master Data',
    items: [
      { href: '/master/buku', label: 'Buku' },
      { href: '/master/kategori', label: 'Kategori' },
      { href: '/master/siswa', label: 'Siswa' },
      { href: '/master/rak', label: 'Rak' },
    ],
  },
  {
    group: 'Transaksi',
    items: [
      { href: '/transaksi/peminjaman', label: 'Peminjaman' },
      { href: '/transaksi/pengembalian', label: 'Pengembalian' },
      { href: '/transaksi/riwayat', label: 'Riwayat' },
    ],
  },
  {
    // PRD bab 11. Halamannya dibuat di Rencana 06; sampai saat itu tautan ini 404.
    group: 'Laporan',
    items: [
      { href: '/laporan/peminjaman', label: 'Peminjaman' },
      { href: '/laporan/pengembalian', label: 'Pengembalian' },
      { href: '/laporan/keterlambatan', label: 'Keterlambatan' },
      { href: '/laporan/koleksi', label: 'Koleksi Buku' },
    ],
  },
  {
    group: 'Pengaturan',
    roles: ['admin'],
    items: [
      { href: '/pengaturan/tahun-ajaran', label: 'Tahun Ajaran' },
      { href: '/pengaturan/pengguna', label: 'Pengguna' },
      { href: '/pengaturan/konfigurasi', label: 'Konfigurasi' },
    ],
  },
];

export function Sidebar({ role }: { role: UserRole }) {
  const sections = NAV.filter((section) => !section.roles || section.roles.includes(role));

  return (
    <nav
      aria-label="Menu utama"
      className="h-full w-60 overflow-y-auto border-r border-[var(--color-ink-100)] bg-white px-3 py-5"
    >
      <div className="px-3 pb-6 font-serif text-lg font-semibold">Perpustakaan</div>
      {sections.map((section) => (
        <div key={section.group ?? 'utama'} className="mb-5">
          {section.group && (
            <div className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-500)]">
              {section.group}
            </div>
          )}
          {section.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-1.5 text-sm text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)]"
            >
              {item.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
```

Ganti seluruh isi `src/components/layout/topbar.tsx`:

```tsx
import { signOut } from '@/server/actions/auth';

export function Topbar({
  academicYear,
  userName,
}: {
  academicYear: string | null;
  userName: string;
}) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-[var(--color-ink-100)] bg-white px-6">
      {/* Tahun ajaran selalu terlihat: petugas harus tahu ke tahun mana
          transaksinya masuk, tanpa perlu membuka halaman lain. */}
      {academicYear ? (
        <span className="text-sm text-[var(--color-ink-700)]">
          Tahun Ajaran <strong className="font-semibold">{academicYear}</strong>
        </span>
      ) : (
        <span className="text-sm font-medium text-[var(--color-status-terlambat)]">
          Belum ada tahun ajaran aktif — transaksi tidak dapat dibuat
        </span>
      )}
      <div className="flex items-center gap-4">
        <span className="text-sm text-[var(--color-ink-700)]">{userName}</span>
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm text-[var(--color-ink-500)] underline-offset-2 hover:text-[var(--color-ink-900)] hover:underline"
          >
            Keluar
          </button>
        </form>
      </div>
    </header>
  );
}
```

Buat `src/components/layout/app-shell.tsx`:

```tsx
'use client';

import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { buttonClass } from '@/components/ui/button-styles';

/**
 * Kerangka responsif (PRD bab 9: desktop dan tablet). Mulai lebar 1024px (lg)
 * sidebar selalu tampil. Di bawahnya sidebar tersembunyi dan dibuka lewat
 * tombol Menu sebagai panel di atas konten.
 */
export function AppShell({
  sidebar,
  topbar,
  children,
}: {
  sidebar: ReactNode;
  topbar: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  // Menu dianggap terbuka hanya di halaman tempat ia dibuka. Begitu petugas
  // berpindah halaman lewat tautan sidebar, panel tertutup sendiri tanpa
  // efek yang menyinkronkan state dengan URL.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn !== null && openOn === pathname;

  return (
    <div className="flex min-h-screen">
      <div id="navigasi-utama" className={open ? 'fixed inset-0 z-30 flex lg:static lg:z-auto' : 'hidden lg:flex'}>
        <div className="h-full shrink-0">{sidebar}</div>
        {open && (
          <button
            type="button"
            aria-label="Tutup menu"
            onClick={() => setOpenOn(null)}
            className="flex-1 bg-[var(--color-ink-900)]/40 lg:hidden"
          />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center border-b border-[var(--color-ink-100)] bg-white px-4 py-2 lg:hidden">
          <button
            type="button"
            aria-expanded={open}
            aria-controls="navigasi-utama"
            onClick={() => setOpenOn(open ? null : pathname)}
            className={buttonClass('secondary', 'sm')}
          >
            <span aria-hidden="true">☰</span>&nbsp;Menu
          </button>
        </div>
        {topbar}
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
```

Ganti seluruh isi `src/app/(app)/layout.tsx`:

```tsx
import { eq } from 'drizzle-orm';
import { AppShell } from '@/components/layout/app-shell';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { requireProfile } from '@/server/auth/guard';
import { db, schema } from '@/server/db/client';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();

  const [year] = await db
    .select({ name: schema.academicYears.name })
    .from(schema.academicYears)
    .where(eq(schema.academicYears.isActive, true))
    .limit(1);

  return (
    <AppShell
      sidebar={<Sidebar role={profile.role} />}
      topbar={<Topbar academicYear={year?.name ?? null} userName={profile.fullName} />}
    >
      {children}
    </AppShell>
  );
}
```

`Sidebar` dan `Topbar` tetap Server Component; keduanya dikirim ke `AppShell` (Client Component) sebagai prop, sehingga Server Action `signOut` di Topbar tidak ikut menjadi kode klien.

- [x] **Step 20: Jalankan uji untuk memastikan lulus**

Jalankan: `npx vitest run src/components/layout "src/app/(app)/layout.test.tsx"`
Harapan: LULUS, 10 uji (2 sidebar, 3 topbar, 2 app-shell, 3 layout).

- [x] **Step 21: Jalankan seluruh uji, lint, dan commit**

```bash
npm test
npm run lint
npx tsc --noEmit
git add -A
git commit -m "$(cat <<'EOF'
feat(ui): komponen bersama, kerangka responsif, sidebar sadar peran

ActionForm menyimpan isian terakhir di state karena React 19 mengosongkan
form setelah Server Action selesai. Di bawah 1024px sidebar dibuka lewat
tombol Menu dan tabel digulir ke samping, agar dapat dipakai di tablet
(PRD bab 9). Menu Laporan ditambahkan sesuai PRD bab 11. Grup Pengaturan
disembunyikan dari petugas; aksesnya tetap ditegakkan di server.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Kategori

Task ini menetapkan pola lima lapis yang diikuti seluruh entitas berikutnya: skema validasi → service → query → Server Action → halaman.

**Files:**
- Create: `src/server/queries/like.ts`, `src/server/queries/like.test.ts`
- Create: `src/server/validation/category.ts`, `src/server/validation/category.test.ts`
- Create: `src/server/services/categories.ts`, `src/server/queries/categories.ts`, `tests/integration/categories.test.ts`
- Create: `src/server/actions/categories.ts`, `src/server/actions/categories.test.ts`
- Create: `src/app/(app)/master/kategori/page.tsx`, `page.test.tsx`, `baru/page.tsx`, `baru/page.test.tsx`, `[id]/page.tsx`, `[id]/page.test.tsx`

**Interfaces:**
- Consumes: seluruh keluaran Task 1–3
- Produces:
  - `containsPattern(keyword: string): string`
  - `categorySchema`, `type CategoryInput = { name: string }`
  - `createCategory(input, actor, executor?)`, `updateCategory(id, input, actor, executor?)`, `setCategoryStatus(id, status, actor, executor?)`: semuanya `Promise<ServiceResult>`
  - `interface CategoryRow { id; name; status: RecordStatus; bookCount: number }`, `interface Category { id; name; status }`
  - `listCategories(filter: { q; status: StatusFilter; page }, executor?): Promise<{ rows: CategoryRow[]; total: number }>`
  - `getCategory(id, executor?): Promise<Category | null>`
  - `listCategoryOptions(includeId?: string | null, executor?): Promise<Option[]>` (dipakai Task 7)
  - `createCategoryAction(state, formData)`, `updateCategoryAction(id, state, formData)`, `setCategoryStatusAction(id, status, state, formData)`

- [x] **Step 1: Tulis uji pola pencarian yang gagal**

Buat `src/server/queries/like.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { containsPattern } from './like';

describe('containsPattern', () => {
  it('membungkus kata kunci dengan wildcard di kedua sisi', () => {
    expect(containsPattern('fiksi')).toBe('%fiksi%');
  });

  it('memperlakukan % dan _ dari pengguna secara harfiah', () => {
    expect(containsPattern('50%')).toBe('%50\\%%');
    expect(containsPattern('a_b')).toBe('%a\\_b%');
  });

  it('meng-escape garis miring terbalik', () => {
    expect(containsPattern('a\\b')).toBe('%a\\\\b%');
  });
});
```

- [x] **Step 2: Jalankan uji untuk memastikan gagal**

Jalankan: `npx vitest run src/server/queries/like.test.ts`
Harapan: GAGAL dengan "Failed to resolve import './like'".

- [x] **Step 3: Implementasikan pola pencarian**

Buat `src/server/queries/like.ts`:

```ts
/**
 * Pola ILIKE "mengandung" untuk kata kunci pengguna. Karakter %, _, dan \
 * di-escape agar diperlakukan harfiah: mencari "50%" tidak boleh
 * mencocokkan seluruh baris. Backslash adalah karakter escape bawaan ILIKE.
 */
export function containsPattern(keyword: string): string {
  return `%${keyword.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}
```

- [x] **Step 4: Jalankan uji untuk memastikan lulus**

Jalankan: `npx vitest run src/server/queries/like.test.ts`
Harapan: LULUS, 3 uji.

- [x] **Step 5: Tulis uji skema kategori yang gagal**

Buat `src/server/validation/category.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { categorySchema } from './category';

describe('categorySchema', () => {
  it('membuang spasi di ujung nama', () => {
    expect(categorySchema.parse({ name: '  Fiksi ' })).toEqual({ name: 'Fiksi' });
  });

  it('menolak nama kosong dengan pesan yang menyebut kategori', () => {
    const result = categorySchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Nama kategori wajib diisi.');
  });
});
```

- [x] **Step 6: Jalankan uji untuk memastikan gagal**

Jalankan: `npx vitest run src/server/validation/category.test.ts`
Harapan: GAGAL dengan "Failed to resolve import './category'".

- [x] **Step 7: Implementasikan skema kategori**

Buat `src/server/validation/category.ts`:

```ts
import { z } from 'zod';
import { requiredText } from './common';

export const categorySchema = z.object({
  name: requiredText('Nama kategori wajib diisi.', 100),
});

export type CategoryInput = z.output<typeof categorySchema>;
```

- [x] **Step 8: Jalankan uji untuk memastikan lulus**

Jalankan: `npx vitest run src/server/validation/category.test.ts`
Harapan: LULUS, 2 uji.

- [x] **Step 9: Tulis uji integrasi kategori yang gagal**

Buat `tests/integration/categories.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { auditLogs, books } from '@/server/db/schema';
import { getCategory, listCategories, listCategoryOptions } from '@/server/queries/categories';
import { createCategory, setCategoryStatus, updateCategory } from '@/server/services/categories';
import { testActor, withRollback } from './helpers';

describe('createCategory', () => {
  it('menyimpan kategori dan menulis audit log di transaksi yang sama', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);

      const result = await createCategory({ name: 'UJI-Fiksi' }, actor, tx);

      if (!result.ok) throw new Error(result.message);
      expect(await getCategory(result.id, tx)).toEqual({ id: result.id, name: 'UJI-Fiksi', status: 'active' });
      const audit = await tx
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.entityId, result.id), eq(auditLogs.action, 'category.create')));
      expect(audit).toHaveLength(1);
      expect(audit[0]?.userId).toBe(actor.id);
    });
  });

  it('menolak nama ganda dengan pesan pada kolom nama', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      await createCategory({ name: 'UJI-Fiksi' }, actor, tx);

      const result = await createCategory({ name: 'UJI-Fiksi' }, actor, tx);

      expect(result).toEqual({
        ok: false,
        field: 'name',
        message: 'Kategori "UJI-Fiksi" sudah ada. Gunakan nama lain, atau aktifkan kembali kategori lama bila nonaktif.',
      });
    });
  });
});

describe('updateCategory', () => {
  it('mengganti nama kategori dan mencatatnya', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const created = await createCategory({ name: 'UJI-Fiksi' }, actor, tx);
      if (!created.ok) throw new Error(created.message);

      const result = await updateCategory(created.id, { name: 'UJI-Fiksi Remaja' }, actor, tx);

      expect(result).toEqual({ ok: true, id: created.id });
      expect((await getCategory(created.id, tx))?.name).toBe('UJI-Fiksi Remaja');
      const audit = await tx
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.entityId, created.id), eq(auditLogs.action, 'category.update')));
      expect(audit).toHaveLength(1);
    });
  });

  it('melaporkan kategori yang tidak ada', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);

      const result = await updateCategory(crypto.randomUUID(), { name: 'UJI-X' }, actor, tx);

      expect(result).toEqual({ ok: false, message: 'Kategori tidak ditemukan. Muat ulang halaman daftar kategori.' });
    });
  });

  it('memperlakukan id yang bukan UUID sebagai tidak ditemukan, bukan galat database', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);

      const result = await updateCategory('bukan-uuid', { name: 'UJI-X' }, actor, tx);

      expect(result.ok).toBe(false);
    });
  });
});

describe('setCategoryStatus', () => {
  it('menonaktifkan kategori dan mencatatnya di audit log', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const created = await createCategory({ name: 'UJI-Fiksi' }, actor, tx);
      if (!created.ok) throw new Error(created.message);

      const result = await setCategoryStatus(created.id, 'inactive', actor, tx);

      expect(result.ok).toBe(true);
      expect((await getCategory(created.id, tx))?.status).toBe('inactive');
      const audit = await tx
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.entityId, created.id), eq(auditLogs.action, 'category.deactivate')));
      expect(audit).toHaveLength(1);
    });
  });
});

describe('listCategories', () => {
  it('mencari tanpa membedakan huruf besar dan memfilter status', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      await createCategory({ name: 'UJI-Fiksi Remaja' }, actor, tx);
      const old = await createCategory({ name: 'UJI-Fiksi Lama' }, actor, tx);
      if (!old.ok) throw new Error(old.message);
      await setCategoryStatus(old.id, 'inactive', actor, tx);

      const active = await listCategories({ q: 'uji-fiksi', status: 'active', page: 1 }, tx);
      expect(active.rows.map((row) => row.name)).toEqual(['UJI-Fiksi Remaja']);
      expect(active.total).toBe(1);

      const all = await listCategories({ q: 'uji-fiksi', status: 'all', page: 1 }, tx);
      expect(all.rows.map((row) => row.name)).toEqual(['UJI-Fiksi Lama', 'UJI-Fiksi Remaja']);
      expect(all.total).toBe(2);
    });
  });

  it('menghitung jumlah judul buku di setiap kategori', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const created = await createCategory({ name: 'UJI-Sains' }, actor, tx);
      if (!created.ok) throw new Error(created.message);
      await tx.insert(books).values([
        { title: 'UJI-Fisika', author: 'UJI-Penulis', categoryId: created.id },
        { title: 'UJI-Kimia', author: 'UJI-Penulis', categoryId: created.id },
      ]);

      const { rows } = await listCategories({ q: 'UJI-Sains', status: 'active', page: 1 }, tx);

      expect(rows[0]?.bookCount).toBe(2);
    });
  });
});

describe('listCategoryOptions', () => {
  it('hanya menawarkan kategori aktif, kecuali kategori yang sedang dipakai', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const used = await createCategory({ name: 'UJI-Lama' }, actor, tx);
      if (!used.ok) throw new Error(used.message);
      await setCategoryStatus(used.id, 'inactive', actor, tx);

      const withoutCurrent = await listCategoryOptions(null, tx);
      expect(withoutCurrent.some((option) => option.value === used.id)).toBe(false);

      const withCurrent = await listCategoryOptions(used.id, tx);
      expect(withCurrent).toContainEqual({ value: used.id, label: 'UJI-Lama (nonaktif)' });
    });
  });
});
```

- [x] **Step 10: Jalankan uji untuk memastikan gagal**

Jalankan: `npm run test:integration -- tests/integration/categories.test.ts`
Harapan: GAGAL dengan "Failed to resolve import '@/server/queries/categories'".

- [x] **Step 11: Implementasikan service kategori**

Buat `src/server/services/categories.ts`:

```ts
import { eq } from 'drizzle-orm';
import type { Actor, RecordStatus } from '@/domain/shared/types';
import { writeAudit } from '@/server/audit';
import { db } from '@/server/db/client';
import { uniqueViolation } from '@/server/db/errors';
import type { Executor } from '@/server/db/executor';
import { categories } from '@/server/db/schema';
import type { CategoryInput } from '@/server/validation/category';
import { isUuid } from '@/server/validation/common';
import { fail, ok, type ServiceResult } from './result';

const NOT_FOUND = 'Kategori tidak ditemukan. Muat ulang halaman daftar kategori.';

function duplicate(name: string): ServiceResult {
  return fail(
    `Kategori "${name}" sudah ada. Gunakan nama lain, atau aktifkan kembali kategori lama bila nonaktif.`,
    'name',
  );
}

export async function createCategory(
  input: CategoryInput,
  actor: Actor,
  executor: Executor = db,
): Promise<ServiceResult> {
  try {
    // Transaksi bersarang menjadi savepoint bila `executor` sudah transaksi,
    // sehingga pelanggaran unik di sini tidak merusak transaksi pemanggil.
    return await executor.transaction(async (tx) => {
      const [created] = await tx.insert(categories).values({ name: input.name }).returning({ id: categories.id });
      await writeAudit(tx, {
        actorId: actor.id,
        action: 'category.create',
        entity: 'categories',
        entityId: created.id,
        metadata: { name: input.name },
      });
      return ok(created.id);
    });
  } catch (error) {
    if (uniqueViolation(error) === 'categories_name_unique') return duplicate(input.name);
    throw error;
  }
}

export async function updateCategory(
  id: string,
  input: CategoryInput,
  actor: Actor,
  executor: Executor = db,
): Promise<ServiceResult> {
  if (!isUuid(id)) return fail(NOT_FOUND);
  try {
    return await executor.transaction(async (tx) => {
      const [updated] = await tx
        .update(categories)
        .set({ name: input.name })
        .where(eq(categories.id, id))
        .returning({ id: categories.id });
      if (!updated) return fail(NOT_FOUND);

      await writeAudit(tx, {
        actorId: actor.id,
        action: 'category.update',
        entity: 'categories',
        entityId: id,
        metadata: { name: input.name },
      });
      return ok(id);
    });
  } catch (error) {
    if (uniqueViolation(error) === 'categories_name_unique') return duplicate(input.name);
    throw error;
  }
}

export async function setCategoryStatus(
  id: string,
  status: RecordStatus,
  actor: Actor,
  executor: Executor = db,
): Promise<ServiceResult> {
  if (!isUuid(id)) return fail(NOT_FOUND);
  return executor.transaction(async (tx) => {
    const [updated] = await tx
      .update(categories)
      .set({ status })
      .where(eq(categories.id, id))
      .returning({ id: categories.id, name: categories.name });
    if (!updated) return fail(NOT_FOUND);

    await writeAudit(tx, {
      actorId: actor.id,
      action: status === 'active' ? 'category.activate' : 'category.deactivate',
      entity: 'categories',
      entityId: id,
      metadata: { name: updated.name },
    });
    return ok(id);
  });
}
```

Kategori yang dinonaktifkan tetap melekat pada buku lamanya. Ia hanya tidak ditawarkan lagi saat buku baru dibuat (lihat `listCategoryOptions`).

- [x] **Step 12: Implementasikan query kategori**

Buat `src/server/queries/categories.ts`:

```ts
import { and, asc, eq, ilike, or, sql } from 'drizzle-orm';
import type { RecordStatus } from '@/domain/shared/types';
import type { Option } from '@/lib/options';
import { offsetOf, PAGE_SIZE } from '@/lib/pagination';
import type { StatusFilter } from '@/lib/search-params';
import { db } from '@/server/db/client';
import type { Executor } from '@/server/db/executor';
import { books, categories } from '@/server/db/schema';
import { isUuid } from '@/server/validation/common';
import { containsPattern } from './like';

export interface Category {
  id: string;
  name: string;
  status: RecordStatus;
}

export interface CategoryRow extends Category {
  bookCount: number;
}

export interface CategoryFilter {
  q: string;
  status: StatusFilter;
  page: number;
}

export async function listCategories(
  filter: CategoryFilter,
  executor: Executor = db,
): Promise<{ rows: CategoryRow[]; total: number }> {
  const where = and(
    filter.q ? ilike(categories.name, containsPattern(filter.q)) : undefined,
    filter.status === 'all' ? undefined : eq(categories.status, filter.status),
  );

  const rows = await executor
    .select({
      id: categories.id,
      name: categories.name,
      status: categories.status,
      bookCount: sql<number>`(select count(*)::int from ${books} where ${books.categoryId} = ${categories.id})`,
    })
    .from(categories)
    .where(where)
    .orderBy(asc(categories.name))
    .limit(PAGE_SIZE)
    .offset(offsetOf(filter.page));

  const [{ total }] = await executor
    .select({ total: sql<number>`count(*)::int` })
    .from(categories)
    .where(where);

  return { rows, total };
}

export async function getCategory(id: string, executor: Executor = db): Promise<Category | null> {
  if (!isUuid(id)) return null;
  const [category] = await executor
    .select({ id: categories.id, name: categories.name, status: categories.status })
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1);
  return category ?? null;
}

/**
 * Opsi kategori untuk form buku. Kategori nonaktif tidak ditawarkan,
 * kecuali kategori yang sedang dipakai buku yang diedit: tanpa itu,
 * menyimpan ulang buku lama akan diam-diam menghapus kategorinya.
 */
export async function listCategoryOptions(
  includeId: string | null = null,
  executor: Executor = db,
): Promise<Option[]> {
  const active = eq(categories.status, 'active');
  const rows = await executor
    .select({ id: categories.id, name: categories.name, status: categories.status })
    .from(categories)
    .where(includeId && isUuid(includeId) ? or(active, eq(categories.id, includeId)) : active)
    .orderBy(asc(categories.name));

  return rows.map((row) => ({
    value: row.id,
    label: row.status === 'active' ? row.name : `${row.name} (nonaktif)`,
  }));
}
```

- [x] **Step 13: Jalankan uji integrasi untuk memastikan lulus**

Jalankan: `npm run test:integration -- tests/integration/categories.test.ts`
Harapan: LULUS, 9 uji.

- [x] **Step 14: Tulis uji Server Action kategori yang gagal**

Buat `src/server/actions/categories.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formError, IDLE } from '@/lib/form-state';

const { mockRunFormAction, mockRunCommand, mockCreate, mockUpdate, mockSetStatus } = vi.hoisted(() => ({
  mockRunFormAction: vi.fn(),
  mockRunCommand: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockSetStatus: vi.fn(),
}));

vi.mock('@/server/forms/run-action', () => ({ runFormAction: mockRunFormAction, runCommand: mockRunCommand }));
vi.mock('@/server/services/categories', () => ({
  createCategory: mockCreate,
  updateCategory: mockUpdate,
  setCategoryStatus: mockSetStatus,
}));

import { createCategoryAction, setCategoryStatusAction, updateCategoryAction } from './categories';

const actor = { id: 'u1', role: 'petugas' as const };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createCategoryAction', () => {
  it('terbuka untuk admin dan petugas, lalu kembali ke daftar', async () => {
    await createCategoryAction(IDLE, new FormData());

    const options = mockRunFormAction.mock.calls[0]?.[0];
    expect(options.roles).toEqual(['admin', 'petugas']);
    expect(options.redirectTo).toBe('/master/kategori');
    expect(options.revalidate).toEqual(['/master/kategori']);

    await options.execute({ name: 'Fiksi' }, actor);
    expect(mockCreate).toHaveBeenCalledWith({ name: 'Fiksi' }, actor);
  });
});

describe('updateCategoryAction', () => {
  it('meneruskan id kategori ke service', async () => {
    await updateCategoryAction('c1', IDLE, new FormData());

    const options = mockRunFormAction.mock.calls[0]?.[0];
    await options.execute({ name: 'Sains' }, actor);
    expect(mockUpdate).toHaveBeenCalledWith('c1', { name: 'Sains' }, actor);
  });
});

describe('setCategoryStatusAction', () => {
  it('menolak status yang tidak dikenal tanpa memanggil service', async () => {
    const state = await setCategoryStatusAction('c1', 'deleted' as never, IDLE, new FormData());

    expect(state).toEqual(formError('Status kategori tidak dikenal. Muat ulang halaman lalu coba lagi.'));
    expect(mockRunCommand).not.toHaveBeenCalled();
  });

  it('meneruskan status yang sah ke service', async () => {
    await setCategoryStatusAction('c1', 'inactive', IDLE, new FormData());

    const options = mockRunCommand.mock.calls[0]?.[0];
    expect(options.roles).toEqual(['admin', 'petugas']);
    await options.execute(actor);
    expect(mockSetStatus).toHaveBeenCalledWith('c1', 'inactive', actor);
  });
});
```

- [x] **Step 15: Jalankan uji untuk memastikan gagal**

Jalankan: `npx vitest run src/server/actions/categories.test.ts`
Harapan: GAGAL dengan "Failed to resolve import './categories'".

- [x] **Step 16: Implementasikan Server Action kategori**

Buat `src/server/actions/categories.ts`:

```ts
'use server';

import type { RecordStatus, UserRole } from '@/domain/shared/types';
import { formError, type FormState } from '@/lib/form-state';
import { runCommand, runFormAction } from '@/server/forms/run-action';
import { createCategory, setCategoryStatus, updateCategory } from '@/server/services/categories';
import { categorySchema } from '@/server/validation/category';
import { isRecordStatus } from '@/server/validation/common';

const ROLES: UserRole[] = ['admin', 'petugas'];
const LIST = '/master/kategori';
const INVALID = 'Kategori belum dapat disimpan. Periksa kolom yang ditandai.';

export async function createCategoryAction(_state: FormState, formData: FormData): Promise<FormState> {
  return runFormAction({
    roles: ROLES,
    schema: categorySchema,
    formData,
    invalidMessage: INVALID,
    execute: (data, actor) => createCategory(data, actor),
    successMessage: 'Kategori berhasil ditambahkan.',
    revalidate: [LIST],
    redirectTo: LIST,
  });
}

export async function updateCategoryAction(id: string, _state: FormState, formData: FormData): Promise<FormState> {
  return runFormAction({
    roles: ROLES,
    schema: categorySchema,
    formData,
    invalidMessage: INVALID,
    execute: (data, actor) => updateCategory(id, data, actor),
    successMessage: 'Perubahan kategori tersimpan.',
    revalidate: [LIST],
    redirectTo: LIST,
  });
}

export async function setCategoryStatusAction(
  id: string,
  status: RecordStatus,
  _state: FormState,
  _formData: FormData,
): Promise<FormState> {
  // Argumen yang di-bind tetap dapat diubah dari peramban; periksa lagi di server.
  if (!isRecordStatus(status)) {
    return formError('Status kategori tidak dikenal. Muat ulang halaman lalu coba lagi.');
  }
  return runCommand({
    roles: ROLES,
    execute: (actor) => setCategoryStatus(id, status, actor),
    successMessage: status === 'active' ? 'Kategori diaktifkan.' : 'Kategori dinonaktifkan.',
    revalidate: [LIST],
  });
}
```

- [x] **Step 17: Jalankan uji untuk memastikan lulus**

Jalankan: `npx vitest run src/server/actions/categories.test.ts`
Harapan: LULUS, 4 uji.

- [x] **Step 18: Tulis uji halaman kategori yang gagal**

Buat `src/app/(app)/master/kategori/page.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockListCategories } = vi.hoisted(() => ({ mockListCategories: vi.fn() }));

vi.mock('@/server/queries/categories', () => ({ listCategories: mockListCategories }));
vi.mock('@/server/actions/categories', () => ({ setCategoryStatusAction: vi.fn() }));

import CategoriesPage from './page';

async function render(params: Record<string, string> = {}) {
  return renderToStaticMarkup(await CategoriesPage({ searchParams: Promise.resolve(params) }));
}

describe('CategoriesPage', () => {
  it('menampilkan kategori, jumlah judul, dan aksinya sesuai filter dari URL', async () => {
    mockListCategories.mockResolvedValueOnce({
      rows: [{ id: 'c1', name: 'Fiksi', status: 'active', bookCount: 4 }],
      total: 1,
    });

    const html = await render({ q: 'fik' });

    expect(mockListCategories).toHaveBeenCalledWith({ q: 'fik', status: 'active', page: 1 });
    expect(html).toContain('Fiksi');
    expect(html).toContain('>4<');
    expect(html).toContain('href="/master/kategori/c1"');
    expect(html).toContain('Nonaktifkan');
  });

  it('menampilkan pesan kosong dan pesan sukses dari ?pesan', async () => {
    mockListCategories.mockResolvedValueOnce({ rows: [], total: 0 });

    const html = await render({ pesan: 'Kategori berhasil ditambahkan.' });

    expect(html).toContain('Belum ada kategori yang cocok.');
    expect(html).toContain('Kategori berhasil ditambahkan.');
  });
});
```

Buat `src/app/(app)/master/kategori/baru/page.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@/server/actions/categories', () => ({ createCategoryAction: vi.fn() }));

import NewCategoryPage from './page';

describe('NewCategoryPage', () => {
  it('menampilkan kolom nama kategori dan tautan batal ke daftar', () => {
    const html = renderToStaticMarkup(<NewCategoryPage />);
    expect(html).toContain('name="name"');
    expect(html).toContain('Simpan Kategori');
    expect(html).toContain('href="/master/kategori"');
  });
});
```

Buat `src/app/(app)/master/kategori/[id]/page.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockGetCategory, mockNotFound } = vi.hoisted(() => ({
  mockGetCategory: vi.fn(),
  mockNotFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('@/server/queries/categories', () => ({ getCategory: mockGetCategory }));
vi.mock('@/server/actions/categories', () => ({ updateCategoryAction: vi.fn() }));
vi.mock('next/navigation', () => ({ notFound: mockNotFound }));

import EditCategoryPage from './page';

describe('EditCategoryPage', () => {
  it('mengisi form dengan nama kategori saat ini', async () => {
    mockGetCategory.mockResolvedValueOnce({ id: 'c1', name: 'Fiksi', status: 'active' });

    const html = renderToStaticMarkup(await EditCategoryPage({ params: Promise.resolve({ id: 'c1' }) }));

    expect(html).toContain('value="Fiksi"');
    expect(html).toContain('Simpan Perubahan');
  });

  it('menampilkan halaman tidak ditemukan untuk id yang tidak ada', async () => {
    mockGetCategory.mockResolvedValueOnce(null);

    await expect(EditCategoryPage({ params: Promise.resolve({ id: 'x' }) })).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
```

- [x] **Step 19: Jalankan uji untuk memastikan gagal**

Jalankan: `npx vitest run "src/app/(app)/master/kategori"`
Harapan: GAGAL; halaman belum ada.

- [x] **Step 20: Implementasikan halaman kategori**

Buat `src/app/(app)/master/kategori/page.tsx`:

```tsx
import Link from 'next/link';
import { ActionButton } from '@/components/ui/action-button';
import { buttonClass } from '@/components/ui/button-styles';
import { FilterBar, FilterSelect, STATUS_OPTIONS } from '@/components/ui/filter-bar';
import { Flash } from '@/components/ui/flash';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { RecordStatusBadge } from '@/components/ui/record-status-badge';
import { ScrollTable } from '@/components/ui/scroll-table';
import { TD, TH } from '@/components/ui/table-styles';
import { parsePage } from '@/lib/pagination';
import { firstValue, parseStatusFilter, type SearchParams } from '@/lib/search-params';
import { setCategoryStatusAction } from '@/server/actions/categories';
import { listCategories } from '@/server/queries/categories';

export default async function CategoriesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = firstValue(params.q);
  const status = parseStatusFilter(firstValue(params.status));
  const page = parsePage(firstValue(params.hal));
  const { rows, total } = await listCategories({ q, status, page });

  return (
    <>
      <PageHeader
        title="Kategori"
        description="Pengelompokan judul buku, misalnya Fiksi atau Teknologi Informasi."
        actions={<Link href="/master/kategori/baru" className={buttonClass('primary')}>Tambah Kategori</Link>}
      />
      <Flash message={firstValue(params.pesan)} />
      <FilterBar q={q} placeholder="Cari nama kategori">
        <FilterSelect name="status" label="Filter status" value={status} options={STATUS_OPTIONS} />
      </FilterBar>

      <ScrollTable>
        <thead>
          <tr>
            <th className={TH}>Nama</th>
            <th className={TH}>Jumlah Judul</th>
            <th className={TH}>Status</th>
            <th className={TH}><span className="sr-only">Aksi</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className={`${TD} text-center text-[var(--color-ink-500)]`}>
                Belum ada kategori yang cocok.
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.id}>
              <td className={TD}>{row.name}</td>
              <td className={TD}>{row.bookCount}</td>
              <td className={TD}><RecordStatusBadge status={row.status} /></td>
              <td className={TD}>
                <div className="flex items-start justify-end gap-2">
                  <Link href={`/master/kategori/${row.id}`} className={buttonClass('secondary', 'sm')}>Ubah</Link>
                  <ActionButton
                    action={setCategoryStatusAction.bind(null, row.id, row.status === 'active' ? 'inactive' : 'active')}
                    label={row.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </ScrollTable>

      <Pagination path="/master/kategori" page={page} total={total} query={{ q, status }} />
    </>
  );
}
```

Buat `src/app/(app)/master/kategori/baru/page.tsx`:

```tsx
import { ActionForm } from '@/components/ui/action-form';
import { TextField } from '@/components/ui/fields';
import { PageHeader } from '@/components/ui/page-header';
import { createCategoryAction } from '@/server/actions/categories';

export default function NewCategoryPage() {
  return (
    <>
      <PageHeader title="Tambah Kategori" />
      <ActionForm action={createCategoryAction} submitLabel="Simpan Kategori" cancelHref="/master/kategori">
        <TextField name="name" label="Nama kategori" required autoFocus maxLength={100} />
      </ActionForm>
    </>
  );
}
```

Buat `src/app/(app)/master/kategori/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/ui/action-form';
import { TextField } from '@/components/ui/fields';
import { PageHeader } from '@/components/ui/page-header';
import { updateCategoryAction } from '@/server/actions/categories';
import { getCategory } from '@/server/queries/categories';

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const category = await getCategory(id);
  if (!category) notFound();

  return (
    <>
      <PageHeader title="Ubah Kategori" description={category.name} />
      <ActionForm
        action={updateCategoryAction.bind(null, category.id)}
        submitLabel="Simpan Perubahan"
        cancelHref="/master/kategori"
      >
        <TextField name="name" label="Nama kategori" defaultValue={category.name} required maxLength={100} />
      </ActionForm>
    </>
  );
}
```

- [x] **Step 21: Jalankan uji untuk memastikan lulus**

Jalankan: `npx vitest run "src/app/(app)/master/kategori"`
Harapan: LULUS, 5 uji.

- [x] **Step 22: Periksa di peramban**

```bash
npm run dev
```

Masuk sebagai `petugas` / `perpus123`, buka `http://localhost:3000/master/kategori`, lalu periksa:
1. Tambah kategori `Contoh Fiksi` → kembali ke daftar dengan pesan "Kategori berhasil ditambahkan."
2. Tambah lagi `Contoh Fiksi` → tetap di form, muncul "Kategori "Contoh Fiksi" sudah ada…" di bawah kolom nama, dan isian tidak hilang.
3. Kosongkan nama lalu simpan → pesan "Nama kategori wajib diisi."
4. Nonaktifkan `Contoh Fiksi` → hilang dari daftar bawaan; muncul lagi saat filter "Nonaktif" dipilih.
5. Seluruh alur dapat diselesaikan hanya dengan Tab dan Enter.

Data yang dibuat di langkah ini tersimpan sungguhan; nonaktifkan kategori contoh setelah selesai.

- [x] **Step 23: Jalankan seluruh uji, lint, dan commit**

```bash
npm test
npm run test:integration
npm run lint
npx tsc --noEmit
git add -A
git commit -m "$(cat <<'EOF'
feat(master): kelola kategori

Pola lima lapis pertama: skema validasi, service beraudit, query,
Server Action lewat runFormAction, dan halaman daftar/tambah/ubah.
Kategori dinonaktifkan, tidak dihapus, dan tetap melekat pada buku lama.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Rak

Mengikuti pola Task 4. Perbedaannya: rak punya kode unik (`A-3`) yang dinormalkan ke huruf besar, dan lokasi opsional.

**Files:**
- Create: `src/server/validation/rack.ts`, `src/server/validation/rack.test.ts`
- Create: `src/server/services/racks.ts`, `src/server/queries/racks.ts`, `tests/integration/racks.test.ts`
- Create: `src/server/actions/racks.ts`, `src/server/actions/racks.test.ts`
- Create: `src/app/(app)/master/rak/page.tsx`, `page.test.tsx`, `rack-fields.tsx`, `baru/page.tsx`, `baru/page.test.tsx`, `[id]/page.tsx`, `[id]/page.test.tsx`

**Interfaces:**
- Consumes: seluruh keluaran Task 1–4 (termasuk `containsPattern`)
- Produces:
  - `rackSchema`, `type RackInput = { code: string; name: string; location: string | null }`
  - `createRack(input, actor, executor?)`, `updateRack(id, input, actor, executor?)`, `setRackStatus(id, status, actor, executor?)`
  - `interface Rack { id; code; name; location: string | null; status }`, `interface RackRow extends Rack { bookCount: number }`
  - `listRacks(filter, executor?)`, `getRack(id, executor?)`, `listRackOptions(includeId?, executor?): Promise<Option[]>` (dipakai Task 7)
  - `createRackAction`, `updateRackAction(id, …)`, `setRackStatusAction(id, status, …)`

- [x] **Step 1: Tulis uji skema rak yang gagal**

Buat `src/server/validation/rack.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { rackSchema } from './rack';

describe('rackSchema', () => {
  it('menormalkan kode ke huruf besar dan lokasi kosong menjadi null', () => {
    expect(rackSchema.parse({ code: ' a-3 ', name: 'Rak A Baris 3', location: '' })).toEqual({
      code: 'A-3',
      name: 'Rak A Baris 3',
      location: null,
    });
  });

  it('menolak kode berisi spasi dengan contoh format yang benar', () => {
    const result = rackSchema.safeParse({ code: 'A 3', name: 'Rak A' });
    expect(result.error?.issues[0]?.message).toBe(
      'Kode rak hanya boleh berisi huruf, angka, dan tanda hubung, misalnya A-3.',
    );
  });

  it('mewajibkan kode dan nama', () => {
    const result = rackSchema.safeParse({ code: '', name: '' });
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      'Kode rak wajib diisi.',
      'Nama rak wajib diisi.',
    ]);
  });
});
```

- [x] **Step 2: Jalankan uji untuk memastikan gagal**

Jalankan: `npx vitest run src/server/validation/rack.test.ts`
Harapan: GAGAL dengan "Failed to resolve import './rack'".

- [x] **Step 3: Implementasikan skema rak**

Buat `src/server/validation/rack.ts`:

```ts
import { z } from 'zod';
import { optionalText, requiredText } from './common';

export const rackSchema = z.object({
  code: requiredText('Kode rak wajib diisi.', 20)
    .transform((value) => value.toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9-]+$/, 'Kode rak hanya boleh berisi huruf, angka, dan tanda hubung, misalnya A-3.')),
  name: requiredText('Nama rak wajib diisi.', 100),
  location: optionalText(100),
});

export type RackInput = z.output<typeof rackSchema>;
```

- [x] **Step 4: Jalankan uji untuk memastikan lulus**

Jalankan: `npx vitest run src/server/validation/rack.test.ts`
Harapan: LULUS, 3 uji.

- [x] **Step 5: Tulis uji integrasi rak yang gagal**

Buat `tests/integration/racks.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { auditLogs, books } from '@/server/db/schema';
import { getRack, listRackOptions, listRacks } from '@/server/queries/racks';
import { createRack, setRackStatus, updateRack } from '@/server/services/racks';
import { testActor, withRollback } from './helpers';

const input = { code: 'UJI-A1', name: 'UJI Rak A Baris 1', location: 'Ruang Utama' };

describe('createRack', () => {
  it('menyimpan rak dan menulis audit log', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);

      const result = await createRack(input, actor, tx);

      if (!result.ok) throw new Error(result.message);
      expect(await getRack(result.id, tx)).toEqual({ id: result.id, ...input, status: 'active' });
      const audit = await tx
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.entityId, result.id), eq(auditLogs.action, 'rack.create')));
      expect(audit).toHaveLength(1);
    });
  });

  it('menolak kode ganda dengan pesan pada kolom kode', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      await createRack(input, actor, tx);

      const result = await createRack({ ...input, name: 'UJI Rak lain' }, actor, tx);

      expect(result).toEqual({
        ok: false,
        field: 'code',
        message: 'Kode rak "UJI-A1" sudah dipakai rak lain. Gunakan kode yang berbeda.',
      });
    });
  });
});

describe('updateRack dan setRackStatus', () => {
  it('mengubah data rak lalu menonaktifkannya', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const created = await createRack(input, actor, tx);
      if (!created.ok) throw new Error(created.message);

      expect(await updateRack(created.id, { ...input, location: null }, actor, tx)).toEqual({ ok: true, id: created.id });
      expect((await getRack(created.id, tx))?.location).toBeNull();

      expect((await setRackStatus(created.id, 'inactive', actor, tx)).ok).toBe(true);
      expect((await getRack(created.id, tx))?.status).toBe('inactive');
    });
  });

  it('melaporkan rak yang tidak ada', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      expect(await setRackStatus(crypto.randomUUID(), 'inactive', actor, tx)).toEqual({
        ok: false,
        message: 'Rak tidak ditemukan. Muat ulang halaman daftar rak.',
      });
    });
  });
});

describe('listRacks', () => {
  it('mencari berdasarkan kode atau nama dan menghitung judul buku', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const created = await createRack(input, actor, tx);
      if (!created.ok) throw new Error(created.message);
      await tx.insert(books).values({ title: 'UJI-Judul', author: 'UJI-Penulis', rackId: created.id });

      const byCode = await listRacks({ q: 'uji-a1', status: 'active', page: 1 }, tx);
      expect(byCode.rows).toEqual([{ id: created.id, ...input, status: 'active', bookCount: 1 }]);

      const byName = await listRacks({ q: 'Rak A Baris', status: 'all', page: 1 }, tx);
      expect(byName.rows.some((row) => row.id === created.id)).toBe(true);
    });
  });
});

describe('listRackOptions', () => {
  it('memberi label kode dan nama, dan menyertakan rak nonaktif yang sedang dipakai', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const created = await createRack(input, actor, tx);
      if (!created.ok) throw new Error(created.message);
      await setRackStatus(created.id, 'inactive', actor, tx);

      expect((await listRackOptions(null, tx)).some((option) => option.value === created.id)).toBe(false);
      expect(await listRackOptions(created.id, tx)).toContainEqual({
        value: created.id,
        label: 'UJI-A1 — UJI Rak A Baris 1 (nonaktif)',
      });
    });
  });
});
```

- [x] **Step 6: Jalankan uji untuk memastikan gagal**

Jalankan: `npm run test:integration -- tests/integration/racks.test.ts`
Harapan: GAGAL dengan "Failed to resolve import '@/server/queries/racks'".

- [x] **Step 7: Implementasikan service rak**

Buat `src/server/services/racks.ts`:

```ts
import { eq } from 'drizzle-orm';
import type { Actor, RecordStatus } from '@/domain/shared/types';
import { writeAudit } from '@/server/audit';
import { db } from '@/server/db/client';
import { uniqueViolation } from '@/server/db/errors';
import type { Executor } from '@/server/db/executor';
import { racks } from '@/server/db/schema';
import { isUuid } from '@/server/validation/common';
import type { RackInput } from '@/server/validation/rack';
import { fail, ok, type ServiceResult } from './result';

const NOT_FOUND = 'Rak tidak ditemukan. Muat ulang halaman daftar rak.';

function duplicate(code: string): ServiceResult {
  return fail(`Kode rak "${code}" sudah dipakai rak lain. Gunakan kode yang berbeda.`, 'code');
}

export async function createRack(input: RackInput, actor: Actor, executor: Executor = db): Promise<ServiceResult> {
  try {
    return await executor.transaction(async (tx) => {
      const [created] = await tx.insert(racks).values(input).returning({ id: racks.id });
      await writeAudit(tx, {
        actorId: actor.id,
        action: 'rack.create',
        entity: 'racks',
        entityId: created.id,
        metadata: { ...input },
      });
      return ok(created.id);
    });
  } catch (error) {
    if (uniqueViolation(error) === 'racks_code_unique') return duplicate(input.code);
    throw error;
  }
}

export async function updateRack(
  id: string,
  input: RackInput,
  actor: Actor,
  executor: Executor = db,
): Promise<ServiceResult> {
  if (!isUuid(id)) return fail(NOT_FOUND);
  try {
    return await executor.transaction(async (tx) => {
      const [updated] = await tx.update(racks).set(input).where(eq(racks.id, id)).returning({ id: racks.id });
      if (!updated) return fail(NOT_FOUND);

      await writeAudit(tx, {
        actorId: actor.id,
        action: 'rack.update',
        entity: 'racks',
        entityId: id,
        metadata: { ...input },
      });
      return ok(id);
    });
  } catch (error) {
    if (uniqueViolation(error) === 'racks_code_unique') return duplicate(input.code);
    throw error;
  }
}

export async function setRackStatus(
  id: string,
  status: RecordStatus,
  actor: Actor,
  executor: Executor = db,
): Promise<ServiceResult> {
  if (!isUuid(id)) return fail(NOT_FOUND);
  return executor.transaction(async (tx) => {
    const [updated] = await tx
      .update(racks)
      .set({ status })
      .where(eq(racks.id, id))
      .returning({ id: racks.id, code: racks.code });
    if (!updated) return fail(NOT_FOUND);

    await writeAudit(tx, {
      actorId: actor.id,
      action: status === 'active' ? 'rack.activate' : 'rack.deactivate',
      entity: 'racks',
      entityId: id,
      metadata: { code: updated.code },
    });
    return ok(id);
  });
}
```

- [x] **Step 8: Implementasikan query rak**

Buat `src/server/queries/racks.ts`:

```ts
import { and, asc, eq, ilike, or, sql } from 'drizzle-orm';
import type { RecordStatus } from '@/domain/shared/types';
import type { Option } from '@/lib/options';
import { offsetOf, PAGE_SIZE } from '@/lib/pagination';
import type { StatusFilter } from '@/lib/search-params';
import { db } from '@/server/db/client';
import type { Executor } from '@/server/db/executor';
import { books, racks } from '@/server/db/schema';
import { isUuid } from '@/server/validation/common';
import { containsPattern } from './like';

export interface Rack {
  id: string;
  code: string;
  name: string;
  location: string | null;
  status: RecordStatus;
}

export interface RackRow extends Rack {
  bookCount: number;
}

export interface RackFilter {
  q: string;
  status: StatusFilter;
  page: number;
}

const rackColumns = {
  id: racks.id,
  code: racks.code,
  name: racks.name,
  location: racks.location,
  status: racks.status,
};

export async function listRacks(filter: RackFilter, executor: Executor = db): Promise<{ rows: RackRow[]; total: number }> {
  const pattern = containsPattern(filter.q);
  const where = and(
    filter.q ? or(ilike(racks.code, pattern), ilike(racks.name, pattern)) : undefined,
    filter.status === 'all' ? undefined : eq(racks.status, filter.status),
  );

  const rows = await executor
    .select({
      ...rackColumns,
      bookCount: sql<number>`(select count(*)::int from ${books} where ${books.rackId} = ${racks.id})`,
    })
    .from(racks)
    .where(where)
    .orderBy(asc(racks.code))
    .limit(PAGE_SIZE)
    .offset(offsetOf(filter.page));

  const [{ total }] = await executor.select({ total: sql<number>`count(*)::int` }).from(racks).where(where);
  return { rows, total };
}

export async function getRack(id: string, executor: Executor = db): Promise<Rack | null> {
  if (!isUuid(id)) return null;
  const [rack] = await executor.select(rackColumns).from(racks).where(eq(racks.id, id)).limit(1);
  return rack ?? null;
}

/** Sama seperti listCategoryOptions: rak nonaktif hanya muncul bila sedang dipakai. */
export async function listRackOptions(includeId: string | null = null, executor: Executor = db): Promise<Option[]> {
  const active = eq(racks.status, 'active');
  const rows = await executor
    .select(rackColumns)
    .from(racks)
    .where(includeId && isUuid(includeId) ? or(active, eq(racks.id, includeId)) : active)
    .orderBy(asc(racks.code));

  return rows.map((row) => ({
    value: row.id,
    label: `${row.code} — ${row.name}${row.status === 'active' ? '' : ' (nonaktif)'}`,
  }));
}
```

- [x] **Step 9: Jalankan uji integrasi untuk memastikan lulus**

Jalankan: `npm run test:integration -- tests/integration/racks.test.ts`
Harapan: LULUS, 6 uji.

- [x] **Step 10: Tulis uji Server Action rak yang gagal**

Buat `src/server/actions/racks.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formError, IDLE } from '@/lib/form-state';

const { mockRunFormAction, mockRunCommand, mockCreate, mockUpdate, mockSetStatus } = vi.hoisted(() => ({
  mockRunFormAction: vi.fn(),
  mockRunCommand: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockSetStatus: vi.fn(),
}));

vi.mock('@/server/forms/run-action', () => ({ runFormAction: mockRunFormAction, runCommand: mockRunCommand }));
vi.mock('@/server/services/racks', () => ({
  createRack: mockCreate,
  updateRack: mockUpdate,
  setRackStatus: mockSetStatus,
}));

import { createRackAction, setRackStatusAction, updateRackAction } from './racks';

const actor = { id: 'u1', role: 'petugas' as const };
const data = { code: 'A-3', name: 'Rak A Baris 3', location: null };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Server Action rak', () => {
  it('createRackAction terbuka untuk admin dan petugas, lalu kembali ke daftar', async () => {
    await createRackAction(IDLE, new FormData());

    const options = mockRunFormAction.mock.calls[0]?.[0];
    expect(options.roles).toEqual(['admin', 'petugas']);
    expect(options.redirectTo).toBe('/master/rak');
    await options.execute(data, actor);
    expect(mockCreate).toHaveBeenCalledWith(data, actor);
  });

  it('updateRackAction meneruskan id rak ke service', async () => {
    await updateRackAction('r1', IDLE, new FormData());

    await mockRunFormAction.mock.calls[0]?.[0].execute(data, actor);
    expect(mockUpdate).toHaveBeenCalledWith('r1', data, actor);
  });

  it('setRackStatusAction menolak status yang tidak dikenal', async () => {
    const state = await setRackStatusAction('r1', 'deleted' as never, IDLE, new FormData());

    expect(state).toEqual(formError('Status rak tidak dikenal. Muat ulang halaman lalu coba lagi.'));
    expect(mockRunCommand).not.toHaveBeenCalled();
  });

  it('setRackStatusAction meneruskan status yang sah ke service', async () => {
    await setRackStatusAction('r1', 'inactive', IDLE, new FormData());

    await mockRunCommand.mock.calls[0]?.[0].execute(actor);
    expect(mockSetStatus).toHaveBeenCalledWith('r1', 'inactive', actor);
  });
});
```

- [x] **Step 11: Jalankan uji untuk memastikan gagal**

Jalankan: `npx vitest run src/server/actions/racks.test.ts`
Harapan: GAGAL dengan "Failed to resolve import './racks'".

- [x] **Step 12: Implementasikan Server Action rak**

Buat `src/server/actions/racks.ts`:

```ts
'use server';

import type { RecordStatus, UserRole } from '@/domain/shared/types';
import { formError, type FormState } from '@/lib/form-state';
import { runCommand, runFormAction } from '@/server/forms/run-action';
import { createRack, setRackStatus, updateRack } from '@/server/services/racks';
import { isRecordStatus } from '@/server/validation/common';
import { rackSchema } from '@/server/validation/rack';

const ROLES: UserRole[] = ['admin', 'petugas'];
const LIST = '/master/rak';
const INVALID = 'Rak belum dapat disimpan. Periksa kolom yang ditandai.';

export async function createRackAction(_state: FormState, formData: FormData): Promise<FormState> {
  return runFormAction({
    roles: ROLES,
    schema: rackSchema,
    formData,
    invalidMessage: INVALID,
    execute: (data, actor) => createRack(data, actor),
    successMessage: 'Rak berhasil ditambahkan.',
    revalidate: [LIST],
    redirectTo: LIST,
  });
}

export async function updateRackAction(id: string, _state: FormState, formData: FormData): Promise<FormState> {
  return runFormAction({
    roles: ROLES,
    schema: rackSchema,
    formData,
    invalidMessage: INVALID,
    execute: (data, actor) => updateRack(id, data, actor),
    successMessage: 'Perubahan rak tersimpan.',
    revalidate: [LIST],
    redirectTo: LIST,
  });
}

export async function setRackStatusAction(
  id: string,
  status: RecordStatus,
  _state: FormState,
  _formData: FormData,
): Promise<FormState> {
  if (!isRecordStatus(status)) {
    return formError('Status rak tidak dikenal. Muat ulang halaman lalu coba lagi.');
  }
  return runCommand({
    roles: ROLES,
    execute: (actor) => setRackStatus(id, status, actor),
    successMessage: status === 'active' ? 'Rak diaktifkan.' : 'Rak dinonaktifkan.',
    revalidate: [LIST],
  });
}
```

- [x] **Step 13: Jalankan uji untuk memastikan lulus**

Jalankan: `npx vitest run src/server/actions/racks.test.ts`
Harapan: LULUS, 4 uji.

- [x] **Step 14: Tulis uji halaman rak yang gagal**

Buat `src/app/(app)/master/rak/page.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockListRacks } = vi.hoisted(() => ({ mockListRacks: vi.fn() }));

vi.mock('@/server/queries/racks', () => ({ listRacks: mockListRacks }));
vi.mock('@/server/actions/racks', () => ({ setRackStatusAction: vi.fn() }));

import RacksPage from './page';

async function render(params: Record<string, string> = {}) {
  return renderToStaticMarkup(await RacksPage({ searchParams: Promise.resolve(params) }));
}

describe('RacksPage', () => {
  it('menampilkan kode, nama, lokasi, dan jumlah judul', async () => {
    mockListRacks.mockResolvedValueOnce({
      rows: [{ id: 'r1', code: 'A-3', name: 'Rak A Baris 3', location: null, status: 'inactive', bookCount: 2 }],
      total: 1,
    });

    const html = await render({ status: 'all' });

    expect(mockListRacks).toHaveBeenCalledWith({ q: '', status: 'all', page: 1 });
    expect(html).toContain('A-3');
    expect(html).toContain('Rak A Baris 3');
    expect(html).toContain('—');
    expect(html).toContain('Aktifkan');
  });

  it('menampilkan pesan kosong', async () => {
    mockListRacks.mockResolvedValueOnce({ rows: [], total: 0 });
    expect(await render()).toContain('Belum ada rak yang cocok.');
  });
});
```

Buat `src/app/(app)/master/rak/baru/page.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@/server/actions/racks', () => ({ createRackAction: vi.fn() }));

import NewRackPage from './page';

describe('NewRackPage', () => {
  it('menampilkan kolom kode, nama, dan lokasi', () => {
    const html = renderToStaticMarkup(<NewRackPage />);
    for (const name of ['code', 'name', 'location']) {
      expect(html).toContain(`name="${name}"`);
    }
    expect(html).toContain('href="/master/rak"');
  });
});
```

Buat `src/app/(app)/master/rak/[id]/page.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockGetRack, mockNotFound } = vi.hoisted(() => ({
  mockGetRack: vi.fn(),
  mockNotFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('@/server/queries/racks', () => ({ getRack: mockGetRack }));
vi.mock('@/server/actions/racks', () => ({ updateRackAction: vi.fn() }));
vi.mock('next/navigation', () => ({ notFound: mockNotFound }));

import EditRackPage from './page';

describe('EditRackPage', () => {
  it('mengisi form dengan data rak saat ini', async () => {
    mockGetRack.mockResolvedValueOnce({
      id: 'r1', code: 'A-3', name: 'Rak A Baris 3', location: 'Ruang Utama', status: 'active',
    });

    const html = renderToStaticMarkup(await EditRackPage({ params: Promise.resolve({ id: 'r1' }) }));

    expect(html).toContain('value="A-3"');
    expect(html).toContain('value="Ruang Utama"');
  });

  it('menampilkan halaman tidak ditemukan untuk id yang tidak ada', async () => {
    mockGetRack.mockResolvedValueOnce(null);
    await expect(EditRackPage({ params: Promise.resolve({ id: 'x' }) })).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
```

- [x] **Step 15: Jalankan uji untuk memastikan gagal**

Jalankan: `npx vitest run "src/app/(app)/master/rak"`
Harapan: GAGAL; halaman belum ada.

- [x] **Step 16: Implementasikan halaman rak**

Buat `src/app/(app)/master/rak/rack-fields.tsx`:

```tsx
import { TextField } from '@/components/ui/fields';
import type { Rack } from '@/server/queries/racks';

/** Kolom form rak, dipakai bersama halaman tambah dan ubah. */
export function RackFields({ rack }: { rack?: Rack }) {
  return (
    <>
      <TextField
        name="code"
        label="Kode rak"
        defaultValue={rack?.code}
        required
        autoFocus={!rack}
        maxLength={20}
        hint="Huruf, angka, dan tanda hubung, misalnya A-3. Dicetak pada label buku."
      />
      <TextField name="name" label="Nama rak" defaultValue={rack?.name} required maxLength={100} />
      <TextField name="location" label="Lokasi" defaultValue={rack?.location ?? ''} maxLength={100} />
    </>
  );
}
```

Buat `src/app/(app)/master/rak/page.tsx`:

```tsx
import Link from 'next/link';
import { ActionButton } from '@/components/ui/action-button';
import { buttonClass } from '@/components/ui/button-styles';
import { FilterBar, FilterSelect, STATUS_OPTIONS } from '@/components/ui/filter-bar';
import { Flash } from '@/components/ui/flash';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { RecordStatusBadge } from '@/components/ui/record-status-badge';
import { ScrollTable } from '@/components/ui/scroll-table';
import { TD, TH } from '@/components/ui/table-styles';
import { parsePage } from '@/lib/pagination';
import { firstValue, parseStatusFilter, type SearchParams } from '@/lib/search-params';
import { setRackStatusAction } from '@/server/actions/racks';
import { listRacks } from '@/server/queries/racks';

export default async function RacksPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = firstValue(params.q);
  const status = parseStatusFilter(firstValue(params.status));
  const page = parsePage(firstValue(params.hal));
  const { rows, total } = await listRacks({ q, status, page });

  return (
    <>
      <PageHeader
        title="Rak"
        description="Lokasi fisik buku di perpustakaan."
        actions={<Link href="/master/rak/baru" className={buttonClass('primary')}>Tambah Rak</Link>}
      />
      <Flash message={firstValue(params.pesan)} />
      <FilterBar q={q} placeholder="Cari kode atau nama rak">
        <FilterSelect name="status" label="Filter status" value={status} options={STATUS_OPTIONS} />
      </FilterBar>

      <ScrollTable>
        <thead>
          <tr>
            <th className={TH}>Kode</th>
            <th className={TH}>Nama</th>
            <th className={TH}>Lokasi</th>
            <th className={TH}>Jumlah Judul</th>
            <th className={TH}>Status</th>
            <th className={TH}><span className="sr-only">Aksi</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className={`${TD} text-center text-[var(--color-ink-500)]`}>Belum ada rak yang cocok.</td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.id}>
              <td className={`${TD} font-mono`}>{row.code}</td>
              <td className={TD}>{row.name}</td>
              <td className={TD}>{row.location ?? '—'}</td>
              <td className={TD}>{row.bookCount}</td>
              <td className={TD}><RecordStatusBadge status={row.status} /></td>
              <td className={TD}>
                <div className="flex items-start justify-end gap-2">
                  <Link href={`/master/rak/${row.id}`} className={buttonClass('secondary', 'sm')}>Ubah</Link>
                  <ActionButton
                    action={setRackStatusAction.bind(null, row.id, row.status === 'active' ? 'inactive' : 'active')}
                    label={row.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </ScrollTable>

      <Pagination path="/master/rak" page={page} total={total} query={{ q, status }} />
    </>
  );
}
```

Buat `src/app/(app)/master/rak/baru/page.tsx`:

```tsx
import { ActionForm } from '@/components/ui/action-form';
import { PageHeader } from '@/components/ui/page-header';
import { createRackAction } from '@/server/actions/racks';
import { RackFields } from '../rack-fields';

export default function NewRackPage() {
  return (
    <>
      <PageHeader title="Tambah Rak" />
      <ActionForm action={createRackAction} submitLabel="Simpan Rak" cancelHref="/master/rak">
        <RackFields />
      </ActionForm>
    </>
  );
}
```

Buat `src/app/(app)/master/rak/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/ui/action-form';
import { PageHeader } from '@/components/ui/page-header';
import { updateRackAction } from '@/server/actions/racks';
import { getRack } from '@/server/queries/racks';
import { RackFields } from '../rack-fields';

export default async function EditRackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rack = await getRack(id);
  if (!rack) notFound();

  return (
    <>
      <PageHeader title="Ubah Rak" description={`${rack.code} — ${rack.name}`} />
      <ActionForm action={updateRackAction.bind(null, rack.id)} submitLabel="Simpan Perubahan" cancelHref="/master/rak">
        <RackFields rack={rack} />
      </ActionForm>
    </>
  );
}
```

- [x] **Step 17: Jalankan uji untuk memastikan lulus**

Jalankan: `npx vitest run "src/app/(app)/master/rak"`
Harapan: LULUS, 5 uji.

- [x] **Step 18: Periksa di peramban, lalu commit**

Dengan `npm run dev`, buka `/master/rak`: tambah rak `c-9` (tersimpan sebagai `C-9`), coba tambah `C-9` lagi (galat di kolom kode, isian tetap), ubah lokasinya, lalu nonaktifkan.

```bash
npm test
npm run test:integration
npm run lint
npx tsc --noEmit
git add -A
git commit -m "$(cat <<'EOF'
feat(master): kelola rak

Kode rak dinormalkan ke huruf besar agar "a-3" dan "A-3" tidak menjadi
dua rak. Rak nonaktif tetap ditawarkan untuk buku yang sedang memakainya.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Siswa

Mengikuti pola Task 4. Tambahannya: NIS unik yang pesan galatnya menyebut pemilik NIS tersebut, filter kelas, dan tahun ajaran bawaan dari tahun ajaran aktif. Layar kelola tahun ajaran sendiri baru dibuat di Rencana 03; di sini hanya dibaca.

**Files:**
- Create: `src/server/validation/student.ts`, `src/server/validation/student.test.ts`
- Create: `src/server/queries/academic-years.ts`, `tests/integration/academic-years.test.ts`
- Create: `src/server/services/students.ts`, `src/server/queries/students.ts`, `tests/integration/students.test.ts`
- Create: `src/server/actions/students.ts`, `src/server/actions/students.test.ts`
- Create: `src/app/(app)/master/siswa/page.tsx`, `page.test.tsx`, `student-fields.tsx`, `baru/page.tsx`, `baru/page.test.tsx`, `[id]/page.tsx`, `[id]/page.test.tsx`

**Interfaces:**
- Consumes: seluruh keluaran Task 1–4
- Produces:
  - `studentSchema`, `type StudentInput = { nis; name; className; major: string | null; gender: 'L' | 'P' | null; phone: string | null; academicYearId: string | null }`
  - `interface AcademicYearSummary { id: string; name: string }`
  - `getActiveAcademicYear(executor?): Promise<AcademicYearSummary | null>`, `listAcademicYearOptions(executor?): Promise<Option[]>` (dipakai Rencana 03 dan 04)
  - `createStudent`, `updateStudent`, `setStudentStatus`: pola yang sama dengan kategori
  - `interface Student`, `interface StudentRow`, `listStudents(filter: { q; className; status; page }, executor?)`, `listClassNames(executor?): Promise<string[]>`, `getStudent(id, executor?)`
  - `createStudentAction`, `updateStudentAction(id, …)`, `setStudentStatusAction(id, status, …)`

- [x] **Step 1: Tulis uji skema siswa yang gagal**

Buat `src/server/validation/student.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { studentSchema } from './student';

const valid = {
  nis: '202600123',
  name: 'Ahmad Fauzi',
  className: 'XI RPL 1',
  major: 'RPL',
  gender: 'L',
  phone: '0812-3456-7890',
  academicYearId: '',
};

function messages(input: Record<string, string>) {
  const result = studentSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe('studentSchema', () => {
  it('menerima data siswa lengkap dan mengubah pilihan kosong menjadi null', () => {
    expect(studentSchema.parse(valid)).toEqual({ ...valid, academicYearId: null });
  });

  it('menyimpan kolom opsional yang kosong sebagai null', () => {
    const parsed = studentSchema.parse({ nis: '202600124', name: 'Siti', className: 'X TKJ 2' });
    expect(parsed).toEqual({
      nis: '202600124', name: 'Siti', className: 'X TKJ 2',
      major: null, gender: null, phone: null, academicYearId: null,
    });
  });

  it('menolak NIS berisi spasi', () => {
    expect(messages({ ...valid, nis: '2026 00123' })).toEqual([
      'NIS hanya boleh berisi angka, huruf, titik, dan tanda hubung.',
    ]);
  });

  it('menolak jenis kelamin selain L dan P', () => {
    expect(messages({ ...valid, gender: 'X' })).toEqual(['Jenis kelamin harus L atau P.']);
  });

  it('menolak nomor telepon berisi huruf', () => {
    expect(messages({ ...valid, phone: 'nol delapan' })).toEqual([
      'Nomor telepon hanya boleh berisi angka, spasi, +, dan tanda hubung.',
    ]);
  });
});
```

- [x] **Step 2: Jalankan uji untuk memastikan gagal**

Jalankan: `npx vitest run src/server/validation/student.test.ts`
Harapan: GAGAL dengan "Failed to resolve import './student'".

- [x] **Step 3: Implementasikan skema siswa**

Buat `src/server/validation/student.ts`:

```ts
import { z } from 'zod';
import { optionalText, optionalUuid, requiredText } from './common';

export const studentSchema = z.object({
  nis: requiredText('NIS wajib diisi.', 30).pipe(
    z.string().regex(/^[0-9A-Za-z.-]+$/, 'NIS hanya boleh berisi angka, huruf, titik, dan tanda hubung.'),
  ),
  name: requiredText('Nama siswa wajib diisi.', 150),
  className: requiredText('Kelas wajib diisi, misalnya XI RPL 1.', 30),
  major: optionalText(50),
  gender: z
    .string()
    .optional()
    .transform((value) => (value ?? '') || null)
    .pipe(z.enum(['L', 'P'], 'Jenis kelamin harus L atau P.').nullable()),
  phone: optionalText(20).pipe(
    z.string()
      .regex(/^[0-9+\-\s]+$/, 'Nomor telepon hanya boleh berisi angka, spasi, +, dan tanda hubung.')
      .nullable(),
  ),
  academicYearId: optionalUuid('Tahun ajaran tidak valid. Pilih dari daftar.'),
});

export type StudentInput = z.output<typeof studentSchema>;
```

- [x] **Step 4: Jalankan uji untuk memastikan lulus**

Jalankan: `npx vitest run src/server/validation/student.test.ts`
Harapan: LULUS, 5 uji.

- [x] **Step 5: Tulis uji query tahun ajaran yang gagal**

Buat `tests/integration/academic-years.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { academicYears } from '@/server/db/schema';
import { getActiveAcademicYear, listAcademicYearOptions } from '@/server/queries/academic-years';
import { withRollback } from './helpers';

describe('query tahun ajaran', () => {
  it('mengembalikan tahun ajaran aktif dan menandainya di daftar opsi', async () => {
    await withRollback(async (tx) => {
      await tx.execute(sql`update academic_years set is_active = false`);
      const [active] = await tx
        .insert(academicYears)
        .values({ name: 'UJI-2090/2091', startDate: '2090-07-01', endDate: '2091-06-30', isActive: true })
        .returning({ id: academicYears.id });

      expect(await getActiveAcademicYear(tx)).toEqual({ id: active.id, name: 'UJI-2090/2091' });

      const options = await listAcademicYearOptions(tx);
      expect(options[0]).toEqual({ value: active.id, label: 'UJI-2090/2091 (aktif)' });
    });
  });

  it('mengembalikan null bila tidak ada tahun ajaran aktif', async () => {
    await withRollback(async (tx) => {
      await tx.execute(sql`update academic_years set is_active = false`);
      expect(await getActiveAcademicYear(tx)).toBeNull();
    });
  });
});
```

Opsi diurutkan dari tanggal mulai terbaru, sehingga tahun ajaran 2090/2091 buatan uji selalu berada di urutan pertama.

- [x] **Step 6: Jalankan uji untuk memastikan gagal**

Jalankan: `npm run test:integration -- tests/integration/academic-years.test.ts`
Harapan: GAGAL dengan "Failed to resolve import '@/server/queries/academic-years'".

- [x] **Step 7: Implementasikan query tahun ajaran**

Buat `src/server/queries/academic-years.ts`:

```ts
import { desc, eq } from 'drizzle-orm';
import type { Option } from '@/lib/options';
import { db } from '@/server/db/client';
import type { Executor } from '@/server/db/executor';
import { academicYears } from '@/server/db/schema';

export interface AcademicYearSummary {
  id: string;
  name: string;
}

export async function getActiveAcademicYear(executor: Executor = db): Promise<AcademicYearSummary | null> {
  const [year] = await executor
    .select({ id: academicYears.id, name: academicYears.name })
    .from(academicYears)
    .where(eq(academicYears.isActive, true))
    .limit(1);
  return year ?? null;
}

/** Terbaru lebih dulu; tahun ajaran aktif diberi tanda agar mudah dipilih. */
export async function listAcademicYearOptions(executor: Executor = db): Promise<Option[]> {
  const rows = await executor
    .select({ id: academicYears.id, name: academicYears.name, isActive: academicYears.isActive })
    .from(academicYears)
    .orderBy(desc(academicYears.startDate));

  return rows.map((row) => ({ value: row.id, label: row.isActive ? `${row.name} (aktif)` : row.name }));
}
```

- [x] **Step 8: Jalankan uji untuk memastikan lulus**

Jalankan: `npm run test:integration -- tests/integration/academic-years.test.ts`
Harapan: LULUS, 2 uji.

- [x] **Step 9: Tulis uji integrasi siswa yang gagal**

Buat `tests/integration/students.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import type { StudentInput } from '@/server/validation/student';
import { academicYears, auditLogs } from '@/server/db/schema';
import { getStudent, listClassNames, listStudents } from '@/server/queries/students';
import { createStudent, setStudentStatus, updateStudent } from '@/server/services/students';
import type { Transaction } from '@/server/db/executor';
import { testActor, withRollback } from './helpers';

const input: StudentInput = {
  nis: 'UJI-0001',
  name: 'UJI Ahmad Fauzi',
  className: 'UJI-XI RPL 1',
  major: 'RPL',
  gender: 'L',
  phone: null,
  academicYearId: null,
};

async function activeTestYear(tx: Transaction): Promise<string> {
  await tx.execute(sql`update academic_years set is_active = false`);
  const [year] = await tx
    .insert(academicYears)
    .values({ name: 'UJI-2090/2091', startDate: '2090-07-01', endDate: '2091-06-30', isActive: true })
    .returning({ id: academicYears.id });
  return year.id;
}

describe('createStudent', () => {
  it('memakai tahun ajaran aktif bila tidak dipilih, dan menulis audit log', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const yearId = await activeTestYear(tx);

      const result = await createStudent(input, actor, tx);

      if (!result.ok) throw new Error(result.message);
      expect(await getStudent(result.id, tx)).toMatchObject({ nis: 'UJI-0001', academicYearId: yearId, status: 'active' });
      const audit = await tx
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.entityId, result.id), eq(auditLogs.action, 'student.create')));
      expect(audit).toHaveLength(1);
    });
  });

  it('menolak NIS ganda dengan menyebut nama pemiliknya', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      await createStudent(input, actor, tx);

      const result = await createStudent({ ...input, name: 'UJI Orang Lain' }, actor, tx);

      expect(result).toEqual({
        ok: false,
        field: 'nis',
        message:
          'NIS UJI-0001 sudah terdaftar atas nama UJI Ahmad Fauzi. Periksa kembali NIS, atau cari siswa tersebut di daftar.',
      });
    });
  });
});

describe('updateStudent dan setStudentStatus', () => {
  it('memindahkan kelas lalu menonaktifkan siswa', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const created = await createStudent(input, actor, tx);
      if (!created.ok) throw new Error(created.message);

      const moved = await updateStudent(created.id, { ...input, className: 'UJI-XII RPL 1' }, actor, tx);
      expect(moved).toEqual({ ok: true, id: created.id });
      expect((await getStudent(created.id, tx))?.className).toBe('UJI-XII RPL 1');

      expect((await setStudentStatus(created.id, 'inactive', actor, tx)).ok).toBe(true);
      expect((await getStudent(created.id, tx))?.status).toBe('inactive');
    });
  });

  it('melaporkan siswa yang tidak ada', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      expect(await updateStudent(crypto.randomUUID(), input, actor, tx)).toEqual({
        ok: false,
        message: 'Siswa tidak ditemukan. Muat ulang halaman daftar siswa.',
      });
    });
  });
});

describe('listStudents dan listClassNames', () => {
  it('mencari berdasarkan NIS atau nama, dan memfilter kelas', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      await activeTestYear(tx);
      await createStudent(input, actor, tx);
      await createStudent({ ...input, nis: 'UJI-0002', name: 'UJI Siti Aminah', className: 'UJI-X TKJ 2' }, actor, tx);

      const byNis = await listStudents({ q: 'uji-0001', className: '', status: 'active', page: 1 }, tx);
      expect(byNis.rows.map((row) => row.name)).toEqual(['UJI Ahmad Fauzi']);
      expect(byNis.rows[0]?.academicYearName).toBe('UJI-2090/2091');

      // "UJI Siti", bukan "Siti Aminah": data seed juga punya siswa bernama Siti Aminah.
      const byName = await listStudents({ q: 'uji siti', className: '', status: 'active', page: 1 }, tx);
      expect(byName.rows.map((row) => row.nis)).toEqual(['UJI-0002']);

      const byClass = await listStudents({ q: 'UJI', className: 'UJI-X TKJ 2', status: 'active', page: 1 }, tx);
      expect(byClass.total).toBe(1);

      const classes = await listClassNames(tx);
      expect(classes).toContain('UJI-XI RPL 1');
      expect(classes).toContain('UJI-X TKJ 2');
    });
  });
});
```

- [x] **Step 10: Jalankan uji untuk memastikan gagal**

Jalankan: `npm run test:integration -- tests/integration/students.test.ts`
Harapan: GAGAL dengan "Failed to resolve import '@/server/queries/students'".

- [x] **Step 11: Implementasikan service siswa**

Buat `src/server/services/students.ts`:

```ts
import { eq } from 'drizzle-orm';
import type { Actor, RecordStatus } from '@/domain/shared/types';
import { writeAudit } from '@/server/audit';
import { db } from '@/server/db/client';
import { uniqueViolation } from '@/server/db/errors';
import type { Executor } from '@/server/db/executor';
import { students } from '@/server/db/schema';
import { getActiveAcademicYear } from '@/server/queries/academic-years';
import { isUuid } from '@/server/validation/common';
import type { StudentInput } from '@/server/validation/student';
import { fail, ok, type ServiceResult } from './result';

const NOT_FOUND = 'Siswa tidak ditemukan. Muat ulang halaman daftar siswa.';

/**
 * NIS ganda paling sering berarti siswa itu sudah terdaftar. Menyebut
 * namanya membantu petugas memutuskan: salah ketik, atau data lama.
 */
async function duplicateNis(nis: string, executor: Executor): Promise<ServiceResult> {
  const [owner] = await executor
    .select({ name: students.name })
    .from(students)
    .where(eq(students.nis, nis))
    .limit(1);
  const who = owner ? ` atas nama ${owner.name}` : '';
  return fail(`NIS ${nis} sudah terdaftar${who}. Periksa kembali NIS, atau cari siswa tersebut di daftar.`, 'nis');
}

export async function createStudent(
  input: StudentInput,
  actor: Actor,
  executor: Executor = db,
): Promise<ServiceResult> {
  try {
    return await executor.transaction(async (tx) => {
      const academicYearId = input.academicYearId ?? (await getActiveAcademicYear(tx))?.id ?? null;
      const [created] = await tx
        .insert(students)
        .values({ ...input, academicYearId })
        .returning({ id: students.id });

      await writeAudit(tx, {
        actorId: actor.id,
        action: 'student.create',
        entity: 'students',
        entityId: created.id,
        metadata: { nis: input.nis, name: input.name, className: input.className },
      });
      return ok(created.id);
    });
  } catch (error) {
    // Savepoint sudah di-rollback; `executor` masih dapat dipakai untuk mencari pemilik NIS.
    if (uniqueViolation(error) === 'students_nis_unique') return duplicateNis(input.nis, executor);
    throw error;
  }
}

export async function updateStudent(
  id: string,
  input: StudentInput,
  actor: Actor,
  executor: Executor = db,
): Promise<ServiceResult> {
  if (!isUuid(id)) return fail(NOT_FOUND);
  try {
    return await executor.transaction(async (tx) => {
      const [updated] = await tx
        .update(students)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(students.id, id))
        .returning({ id: students.id });
      if (!updated) return fail(NOT_FOUND);

      await writeAudit(tx, {
        actorId: actor.id,
        action: 'student.update',
        entity: 'students',
        entityId: id,
        metadata: { nis: input.nis, name: input.name, className: input.className },
      });
      return ok(id);
    });
  } catch (error) {
    if (uniqueViolation(error) === 'students_nis_unique') return duplicateNis(input.nis, executor);
    throw error;
  }
}

export async function setStudentStatus(
  id: string,
  status: RecordStatus,
  actor: Actor,
  executor: Executor = db,
): Promise<ServiceResult> {
  if (!isUuid(id)) return fail(NOT_FOUND);
  return executor.transaction(async (tx) => {
    const [updated] = await tx
      .update(students)
      .set({ status, updatedAt: new Date() })
      .where(eq(students.id, id))
      .returning({ id: students.id, nis: students.nis });
    if (!updated) return fail(NOT_FOUND);

    await writeAudit(tx, {
      actorId: actor.id,
      action: status === 'active' ? 'student.activate' : 'student.deactivate',
      entity: 'students',
      entityId: id,
      metadata: { nis: updated.nis },
    });
    return ok(id);
  });
}
```

Menonaktifkan siswa yang masih punya pinjaman terbuka sengaja diizinkan: siswa nonaktif tetap wajib mengembalikan buku, dan aturan `STUDENT_INACTIVE` di lapisan domain sudah mencegahnya meminjam lagi.

- [x] **Step 12: Implementasikan query siswa**

Buat `src/server/queries/students.ts`:

```ts
import { and, asc, eq, ilike, or, sql } from 'drizzle-orm';
import type { RecordStatus } from '@/domain/shared/types';
import { offsetOf, PAGE_SIZE } from '@/lib/pagination';
import type { StatusFilter } from '@/lib/search-params';
import { db } from '@/server/db/client';
import type { Executor } from '@/server/db/executor';
import { academicYears, students } from '@/server/db/schema';
import { isUuid } from '@/server/validation/common';
import { containsPattern } from './like';

export interface Student {
  id: string;
  nis: string;
  name: string;
  className: string;
  major: string | null;
  gender: 'L' | 'P' | null;
  phone: string | null;
  academicYearId: string | null;
  status: RecordStatus;
}

export interface StudentRow {
  id: string;
  nis: string;
  name: string;
  className: string;
  major: string | null;
  academicYearName: string | null;
  status: RecordStatus;
}

export interface StudentFilter {
  q: string;
  /** Kosong berarti semua kelas. */
  className: string;
  status: StatusFilter;
  page: number;
}

export async function listStudents(
  filter: StudentFilter,
  executor: Executor = db,
): Promise<{ rows: StudentRow[]; total: number }> {
  const pattern = containsPattern(filter.q);
  const where = and(
    filter.q ? or(ilike(students.nis, pattern), ilike(students.name, pattern)) : undefined,
    filter.className ? eq(students.className, filter.className) : undefined,
    filter.status === 'all' ? undefined : eq(students.status, filter.status),
  );

  const rows = await executor
    .select({
      id: students.id,
      nis: students.nis,
      name: students.name,
      className: students.className,
      major: students.major,
      academicYearName: academicYears.name,
      status: students.status,
    })
    .from(students)
    .leftJoin(academicYears, eq(academicYears.id, students.academicYearId))
    .where(where)
    .orderBy(asc(students.className), asc(students.name))
    .limit(PAGE_SIZE)
    .offset(offsetOf(filter.page));

  const [{ total }] = await executor.select({ total: sql<number>`count(*)::int` }).from(students).where(where);
  return { rows, total };
}

/** Kelas yang pernah dipakai, untuk filter daftar siswa. */
export async function listClassNames(executor: Executor = db): Promise<string[]> {
  const rows = await executor
    .selectDistinct({ className: students.className })
    .from(students)
    .orderBy(asc(students.className));
  return rows.map((row) => row.className);
}

export async function getStudent(id: string, executor: Executor = db): Promise<Student | null> {
  if (!isUuid(id)) return null;
  const [student] = await executor
    .select({
      id: students.id,
      nis: students.nis,
      name: students.name,
      className: students.className,
      major: students.major,
      gender: students.gender,
      phone: students.phone,
      academicYearId: students.academicYearId,
      status: students.status,
    })
    .from(students)
    .where(eq(students.id, id))
    .limit(1);
  return student ?? null;
}
```

- [x] **Step 13: Jalankan uji integrasi untuk memastikan lulus**

Jalankan: `npm run test:integration -- tests/integration/students.test.ts`
Harapan: LULUS, 5 uji.

- [x] **Step 14: Tulis uji Server Action siswa yang gagal**

Buat `src/server/actions/students.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formError, IDLE } from '@/lib/form-state';

const { mockRunFormAction, mockRunCommand, mockCreate, mockUpdate, mockSetStatus } = vi.hoisted(() => ({
  mockRunFormAction: vi.fn(),
  mockRunCommand: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockSetStatus: vi.fn(),
}));

vi.mock('@/server/forms/run-action', () => ({ runFormAction: mockRunFormAction, runCommand: mockRunCommand }));
vi.mock('@/server/services/students', () => ({
  createStudent: mockCreate,
  updateStudent: mockUpdate,
  setStudentStatus: mockSetStatus,
}));

import { createStudentAction, setStudentStatusAction, updateStudentAction } from './students';

const actor = { id: 'u1', role: 'petugas' as const };
const data = {
  nis: '202600123', name: 'Ahmad Fauzi', className: 'XI RPL 1',
  major: null, gender: null, phone: null, academicYearId: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Server Action siswa', () => {
  it('createStudentAction terbuka untuk admin dan petugas, lalu kembali ke daftar', async () => {
    await createStudentAction(IDLE, new FormData());

    const options = mockRunFormAction.mock.calls[0]?.[0];
    expect(options.roles).toEqual(['admin', 'petugas']);
    expect(options.redirectTo).toBe('/master/siswa');
    await options.execute(data, actor);
    expect(mockCreate).toHaveBeenCalledWith(data, actor);
  });

  it('updateStudentAction meneruskan id siswa ke service', async () => {
    await updateStudentAction('s1', IDLE, new FormData());

    await mockRunFormAction.mock.calls[0]?.[0].execute(data, actor);
    expect(mockUpdate).toHaveBeenCalledWith('s1', data, actor);
  });

  it('setStudentStatusAction menolak status yang tidak dikenal', async () => {
    const state = await setStudentStatusAction('s1', 'lulus' as never, IDLE, new FormData());

    expect(state).toEqual(formError('Status siswa tidak dikenal. Muat ulang halaman lalu coba lagi.'));
    expect(mockRunCommand).not.toHaveBeenCalled();
  });

  it('setStudentStatusAction meneruskan status yang sah ke service', async () => {
    await setStudentStatusAction('s1', 'inactive', IDLE, new FormData());

    await mockRunCommand.mock.calls[0]?.[0].execute(actor);
    expect(mockSetStatus).toHaveBeenCalledWith('s1', 'inactive', actor);
  });
});
```

- [x] **Step 15: Jalankan uji untuk memastikan gagal**

Jalankan: `npx vitest run src/server/actions/students.test.ts`
Harapan: GAGAL dengan "Failed to resolve import './students'".

- [x] **Step 16: Implementasikan Server Action siswa**

Buat `src/server/actions/students.ts`:

```ts
'use server';

import type { RecordStatus, UserRole } from '@/domain/shared/types';
import { formError, type FormState } from '@/lib/form-state';
import { runCommand, runFormAction } from '@/server/forms/run-action';
import { createStudent, setStudentStatus, updateStudent } from '@/server/services/students';
import { isRecordStatus } from '@/server/validation/common';
import { studentSchema } from '@/server/validation/student';

const ROLES: UserRole[] = ['admin', 'petugas'];
const LIST = '/master/siswa';
const INVALID = 'Data siswa belum dapat disimpan. Periksa kolom yang ditandai.';

export async function createStudentAction(_state: FormState, formData: FormData): Promise<FormState> {
  return runFormAction({
    roles: ROLES,
    schema: studentSchema,
    formData,
    invalidMessage: INVALID,
    execute: (data, actor) => createStudent(data, actor),
    successMessage: 'Siswa berhasil ditambahkan.',
    revalidate: [LIST],
    redirectTo: LIST,
  });
}

export async function updateStudentAction(id: string, _state: FormState, formData: FormData): Promise<FormState> {
  return runFormAction({
    roles: ROLES,
    schema: studentSchema,
    formData,
    invalidMessage: INVALID,
    execute: (data, actor) => updateStudent(id, data, actor),
    successMessage: 'Perubahan data siswa tersimpan.',
    revalidate: [LIST],
    redirectTo: LIST,
  });
}

export async function setStudentStatusAction(
  id: string,
  status: RecordStatus,
  _state: FormState,
  _formData: FormData,
): Promise<FormState> {
  if (!isRecordStatus(status)) {
    return formError('Status siswa tidak dikenal. Muat ulang halaman lalu coba lagi.');
  }
  return runCommand({
    roles: ROLES,
    execute: (actor) => setStudentStatus(id, status, actor),
    successMessage: status === 'active' ? 'Siswa diaktifkan.' : 'Siswa dinonaktifkan.',
    revalidate: [LIST],
  });
}
```

- [x] **Step 17: Jalankan uji untuk memastikan lulus**

Jalankan: `npx vitest run src/server/actions/students.test.ts`
Harapan: LULUS, 4 uji.

- [x] **Step 18: Tulis uji halaman siswa yang gagal**

Buat `src/app/(app)/master/siswa/page.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockListStudents, mockListClassNames } = vi.hoisted(() => ({
  mockListStudents: vi.fn(),
  mockListClassNames: vi.fn(),
}));

vi.mock('@/server/queries/students', () => ({
  listStudents: mockListStudents,
  listClassNames: mockListClassNames,
}));
vi.mock('@/server/actions/students', () => ({ setStudentStatusAction: vi.fn() }));

import StudentsPage from './page';

async function render(params: Record<string, string> = {}) {
  return renderToStaticMarkup(await StudentsPage({ searchParams: Promise.resolve(params) }));
}

describe('StudentsPage', () => {
  it('menampilkan siswa dan meneruskan filter kelas dari URL', async () => {
    mockListClassNames.mockResolvedValueOnce(['X TKJ 2', 'XI RPL 1']);
    mockListStudents.mockResolvedValueOnce({
      rows: [{
        id: 's1', nis: '202600123', name: 'Ahmad Fauzi', className: 'XI RPL 1',
        major: 'RPL', academicYearName: '2026/2027', status: 'active',
      }],
      total: 1,
    });

    const html = await render({ kelas: 'XI RPL 1' });

    expect(mockListStudents).toHaveBeenCalledWith({ q: '', className: 'XI RPL 1', status: 'active', page: 1 });
    expect(html).toContain('202600123');
    expect(html).toContain('Ahmad Fauzi');
    expect(html).toContain('2026/2027');
    expect(html).toMatch(/<option value="XI RPL 1" selected="">XI RPL 1<\/option>/);
  });

  it('menampilkan pesan kosong', async () => {
    mockListClassNames.mockResolvedValueOnce([]);
    mockListStudents.mockResolvedValueOnce({ rows: [], total: 0 });
    expect(await render()).toContain('Belum ada siswa yang cocok.');
  });
});
```

Buat `src/app/(app)/master/siswa/baru/page.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@/server/actions/students', () => ({ createStudentAction: vi.fn() }));
vi.mock('@/server/queries/academic-years', () => ({
  listAcademicYearOptions: vi.fn(async () => [{ value: 'y1', label: '2026/2027 (aktif)' }]),
  getActiveAcademicYear: vi.fn(async () => ({ id: 'y1', name: '2026/2027' })),
}));

import NewStudentPage from './page';

describe('NewStudentPage', () => {
  it('menampilkan seluruh kolom siswa dengan tahun ajaran aktif terpilih', async () => {
    const html = renderToStaticMarkup(await NewStudentPage());
    for (const name of ['nis', 'name', 'className', 'major', 'gender', 'phone', 'academicYearId']) {
      expect(html).toContain(`name="${name}"`);
    }
    expect(html).toMatch(/<option value="y1" selected="">2026\/2027 \(aktif\)<\/option>/);
  });
});
```

Buat `src/app/(app)/master/siswa/[id]/page.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockGetStudent, mockNotFound } = vi.hoisted(() => ({
  mockGetStudent: vi.fn(),
  mockNotFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('@/server/queries/students', () => ({ getStudent: mockGetStudent }));
vi.mock('@/server/queries/academic-years', () => ({
  listAcademicYearOptions: vi.fn(async () => [{ value: 'y1', label: '2026/2027 (aktif)' }]),
}));
vi.mock('@/server/actions/students', () => ({ updateStudentAction: vi.fn() }));
vi.mock('next/navigation', () => ({ notFound: mockNotFound }));

import EditStudentPage from './page';

describe('EditStudentPage', () => {
  it('mengisi form dengan data siswa saat ini', async () => {
    mockGetStudent.mockResolvedValueOnce({
      id: 's1', nis: '202600123', name: 'Ahmad Fauzi', className: 'XI RPL 1',
      major: 'RPL', gender: 'L', phone: null, academicYearId: 'y1', status: 'active',
    });

    const html = renderToStaticMarkup(await EditStudentPage({ params: Promise.resolve({ id: 's1' }) }));

    expect(html).toContain('value="202600123"');
    expect(html).toContain('value="XI RPL 1"');
    expect(html).toMatch(/<option value="L" selected="">/);
  });

  it('menampilkan halaman tidak ditemukan untuk id yang tidak ada', async () => {
    mockGetStudent.mockResolvedValueOnce(null);
    await expect(EditStudentPage({ params: Promise.resolve({ id: 'x' }) })).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
```

- [x] **Step 19: Jalankan uji untuk memastikan gagal**

Jalankan: `npx vitest run "src/app/(app)/master/siswa"`
Harapan: GAGAL; halaman belum ada.

- [x] **Step 20: Implementasikan halaman siswa**

Buat `src/app/(app)/master/siswa/student-fields.tsx`:

```tsx
import { SelectField, TextField } from '@/components/ui/fields';
import type { Option } from '@/lib/options';
import type { Student } from '@/server/queries/students';

const GENDER_OPTIONS: Option[] = [
  { value: 'L', label: 'Laki-laki' },
  { value: 'P', label: 'Perempuan' },
];

/** Kolom form siswa, dipakai bersama halaman tambah dan ubah. */
export function StudentFields({
  student,
  yearOptions,
  defaultYearId,
}: {
  student?: Student;
  yearOptions: Option[];
  defaultYearId: string | null;
}) {
  return (
    <>
      <TextField name="nis" label="NIS" defaultValue={student?.nis} required autoFocus={!student} maxLength={30} />
      <TextField name="name" label="Nama lengkap" defaultValue={student?.name} required maxLength={150} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="className"
          label="Kelas"
          defaultValue={student?.className}
          required
          maxLength={30}
          hint="Tulis persis seperti di data sekolah, misalnya XI RPL 1."
        />
        <TextField name="major" label="Jurusan" defaultValue={student?.major ?? ''} maxLength={50} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          name="gender"
          label="Jenis kelamin"
          placeholder="— Tidak diisi —"
          defaultValue={student?.gender ?? ''}
          options={GENDER_OPTIONS}
        />
        <TextField
          name="phone"
          label="Nomor telepon"
          type="tel"
          inputMode="tel"
          defaultValue={student?.phone ?? ''}
          maxLength={20}
        />
      </div>
      <SelectField
        name="academicYearId"
        label="Tahun ajaran"
        placeholder="— Tanpa tahun ajaran —"
        defaultValue={student?.academicYearId ?? defaultYearId ?? ''}
        options={yearOptions}
      />
    </>
  );
}
```

Buat `src/app/(app)/master/siswa/page.tsx`:

```tsx
import Link from 'next/link';
import { ActionButton } from '@/components/ui/action-button';
import { buttonClass } from '@/components/ui/button-styles';
import { FilterBar, FilterSelect, STATUS_OPTIONS } from '@/components/ui/filter-bar';
import { Flash } from '@/components/ui/flash';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { RecordStatusBadge } from '@/components/ui/record-status-badge';
import { ScrollTable } from '@/components/ui/scroll-table';
import { TD, TH } from '@/components/ui/table-styles';
import { parsePage } from '@/lib/pagination';
import { firstValue, parseStatusFilter, type SearchParams } from '@/lib/search-params';
import { setStudentStatusAction } from '@/server/actions/students';
import { listClassNames, listStudents } from '@/server/queries/students';

export default async function StudentsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = firstValue(params.q);
  const className = firstValue(params.kelas);
  const status = parseStatusFilter(firstValue(params.status));
  const page = parsePage(firstValue(params.hal));

  const [classNames, { rows, total }] = await Promise.all([
    listClassNames(),
    listStudents({ q, className, status, page }),
  ]);
  const classOptions = [
    { value: '', label: 'Semua kelas' },
    ...classNames.map((name) => ({ value: name, label: name })),
  ];

  return (
    <>
      <PageHeader
        title="Siswa"
        description="Data peminjam. Siswa nonaktif tidak dapat meminjam buku baru."
        actions={<Link href="/master/siswa/baru" className={buttonClass('primary')}>Tambah Siswa</Link>}
      />
      <Flash message={firstValue(params.pesan)} />
      <FilterBar q={q} placeholder="Cari NIS atau nama siswa">
        <FilterSelect name="kelas" label="Filter kelas" value={className} options={classOptions} />
        <FilterSelect name="status" label="Filter status" value={status} options={STATUS_OPTIONS} />
      </FilterBar>

      <ScrollTable>
        <thead>
          <tr>
            <th className={TH}>NIS</th>
            <th className={TH}>Nama</th>
            <th className={TH}>Kelas</th>
            <th className={TH}>Jurusan</th>
            <th className={TH}>Tahun Ajaran</th>
            <th className={TH}>Status</th>
            <th className={TH}><span className="sr-only">Aksi</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className={`${TD} text-center text-[var(--color-ink-500)]`}>Belum ada siswa yang cocok.</td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.id}>
              <td className={`${TD} font-mono`}>{row.nis}</td>
              <td className={TD}>{row.name}</td>
              <td className={TD}>{row.className}</td>
              <td className={TD}>{row.major ?? '—'}</td>
              <td className={TD}>{row.academicYearName ?? '—'}</td>
              <td className={TD}><RecordStatusBadge status={row.status} /></td>
              <td className={TD}>
                <div className="flex items-start justify-end gap-2">
                  <Link href={`/master/siswa/${row.id}`} className={buttonClass('secondary', 'sm')}>Ubah</Link>
                  <ActionButton
                    action={setStudentStatusAction.bind(null, row.id, row.status === 'active' ? 'inactive' : 'active')}
                    label={row.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </ScrollTable>

      <Pagination path="/master/siswa" page={page} total={total} query={{ q, kelas: className, status }} />
    </>
  );
}
```

Buat `src/app/(app)/master/siswa/baru/page.tsx`:

```tsx
import { ActionForm } from '@/components/ui/action-form';
import { PageHeader } from '@/components/ui/page-header';
import { createStudentAction } from '@/server/actions/students';
import { getActiveAcademicYear, listAcademicYearOptions } from '@/server/queries/academic-years';
import { StudentFields } from '../student-fields';

export default async function NewStudentPage() {
  const [yearOptions, activeYear] = await Promise.all([listAcademicYearOptions(), getActiveAcademicYear()]);

  return (
    <>
      <PageHeader title="Tambah Siswa" />
      <ActionForm action={createStudentAction} submitLabel="Simpan Siswa" cancelHref="/master/siswa">
        <StudentFields yearOptions={yearOptions} defaultYearId={activeYear?.id ?? null} />
      </ActionForm>
    </>
  );
}
```

Buat `src/app/(app)/master/siswa/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/ui/action-form';
import { PageHeader } from '@/components/ui/page-header';
import { updateStudentAction } from '@/server/actions/students';
import { listAcademicYearOptions } from '@/server/queries/academic-years';
import { getStudent } from '@/server/queries/students';
import { StudentFields } from '../student-fields';

export default async function EditStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [student, yearOptions] = await Promise.all([getStudent(id), listAcademicYearOptions()]);
  if (!student) notFound();

  return (
    <>
      <PageHeader title="Ubah Data Siswa" description={`${student.nis} · ${student.name}`} />
      <ActionForm
        action={updateStudentAction.bind(null, student.id)}
        submitLabel="Simpan Perubahan"
        cancelHref="/master/siswa"
      >
        <StudentFields student={student} yearOptions={yearOptions} defaultYearId={null} />
      </ActionForm>
    </>
  );
}
```

- [x] **Step 21: Jalankan uji untuk memastikan lulus**

Jalankan: `npx vitest run "src/app/(app)/master/siswa"`
Harapan: LULUS, 5 uji.

- [x] **Step 22: Periksa di peramban, lalu commit**

Dengan `npm run dev`, buka `/master/siswa`:
1. Tambah siswa dengan NIS `202600123` → galat di kolom NIS yang menyebut "atas nama Ahmad Fauzi" (siswa seed); isian lain tetap.
2. Tambah siswa baru dengan NIS unik → tahun ajaran 2026/2027 sudah terpilih; setelah simpan, siswa muncul di daftar.
3. Filter kelas `XI RPL 1` → hanya siswa kelas itu yang tampil; pindah halaman mempertahankan filter.

Nonaktifkan siswa contoh setelah selesai.

```bash
npm test
npm run test:integration
npm run lint
npx tsc --noEmit
git add -A
git commit -m "$(cat <<'EOF'
feat(master): kelola siswa

NIS ganda dilaporkan beserta nama pemiliknya agar petugas tahu apakah itu
salah ketik atau siswa lama. Siswa baru otomatis masuk tahun ajaran aktif.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Buku (Judul)

Buku di sini adalah **judul**; eksemplar fisiknya dikelola di Task 8. Tambahannya dibanding pola Task 4: harga sebagai dasar biaya ganti, peringatan bila harga nol (spec Section 12), jumlah eksemplar yang **dihitung** dari `book_copies` (spec 4.2), dan penolakan menonaktifkan buku yang eksemplarnya sedang dipinjam.

**Files:**
- Create: `src/server/validation/book.ts`, `src/server/validation/book.test.ts`
- Create: `src/server/services/books.ts`, `src/server/queries/books.ts`, `tests/integration/books.test.ts`
- Create: `src/server/actions/books.ts`, `src/server/actions/books.test.ts`
- Create: `src/app/(app)/master/buku/page.tsx`, `page.test.tsx`, `book-fields.tsx`, `baru/page.tsx`, `baru/page.test.tsx`, `[id]/page.tsx`, `[id]/page.test.tsx`

**Interfaces:**
- Consumes: seluruh keluaran Task 1–6, termasuk `listCategoryOptions` (Task 4) dan `listRackOptions` (Task 5)
- Produces:
  - `bookSchema`, `type BookInput = { isbn: string | null; title; author; publisher: string | null; publishYear: number | null; categoryId: string | null; rackId: string | null; price: number; description: string | null }`
  - `createBook`, `updateBook`, `setBookStatus`: `Promise<ServiceResult>`; `ZERO_PRICE_NOTICE`
  - `interface Book { id; isbn; title; author; publisher; publishYear; categoryId; rackId; price: string; description; status }`
  - `interface BookRow { id; title; author; isbn; categoryName; rackCode; price: string; status; totalCopies: number; availableCopies: number }`
  - `listBooks(filter: { q; categoryId; status; page }, executor?)`, `getBook(id, executor?)`
  - `createBookAction`, `updateBookAction(id, …)`, `setBookStatusAction(id, status, …)`
  - Halaman `/master/buku/[id]` (diperluas Task 8 dengan bagian eksemplar)

- [x] **Step 1: Tulis uji skema buku yang gagal**

Buat `src/server/validation/book.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { bookSchema } from './book';

const valid = {
  isbn: '978-602-1234-56-7',
  title: 'Pemrograman Web',
  author: 'Budi Raharjo',
  publisher: 'Informatika',
  publishYear: '2024',
  categoryId: '',
  rackId: '',
  price: '85.000',
  description: '',
};

function messages(input: Record<string, string>) {
  const result = bookSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe('bookSchema', () => {
  it('menormalkan ISBN, tahun, harga, dan pilihan kosong', () => {
    expect(bookSchema.parse(valid)).toEqual({
      isbn: '9786021234567',
      title: 'Pemrograman Web',
      author: 'Budi Raharjo',
      publisher: 'Informatika',
      publishYear: 2024,
      categoryId: null,
      rackId: null,
      price: 85_000,
      description: null,
    });
  });

  it('menerima ISBN-10 dengan digit pemeriksa X kecil', () => {
    expect(bookSchema.parse({ ...valid, isbn: '0-306-40615-x' }).isbn).toBe('030640615X');
  });

  it('mengizinkan ISBN dan harga kosong', () => {
    const parsed = bookSchema.parse({ ...valid, isbn: '', price: '' });
    expect(parsed.isbn).toBeNull();
    expect(parsed.price).toBe(0);
  });

  it('menolak ISBN yang panjangnya salah', () => {
    expect(messages({ ...valid, isbn: '12345' })).toEqual([
      'ISBN harus 10 atau 13 digit. Tanda hubung boleh diketik.',
    ]);
  });

  it('mewajibkan judul dan penulis', () => {
    expect(messages({ ...valid, title: '', author: ' ' })).toEqual([
      'Judul buku wajib diisi.',
      'Penulis wajib diisi.',
    ]);
  });
});
```

- [x] **Step 2: Jalankan uji untuk memastikan gagal**

Jalankan: `npx vitest run src/server/validation/book.test.ts`
Harapan: GAGAL dengan "Failed to resolve import './book'".

- [x] **Step 3: Implementasikan skema buku**

Buat `src/server/validation/book.ts`:

```ts
import { z } from 'zod';
import { optionalInteger, optionalText, optionalUuid, requiredText, rupiah } from './common';

export const bookSchema = z.object({
  isbn: optionalText(20)
    .transform((value) => (value === null ? null : value.replace(/[-\s]/g, '').toUpperCase()))
    .pipe(
      z.string()
        .regex(/^(\d{9}[\dX]|\d{13})$/, 'ISBN harus 10 atau 13 digit. Tanda hubung boleh diketik.')
        .nullable(),
    ),
  title: requiredText('Judul buku wajib diisi.', 200),
  author: requiredText('Penulis wajib diisi.', 150),
  publisher: optionalText(150),
  publishYear: optionalInteger('Tahun terbit harus bilangan antara 1800 dan 2100.', 1800, 2100),
  categoryId: optionalUuid('Kategori tidak valid. Pilih dari daftar.'),
  rackId: optionalUuid('Rak tidak valid. Pilih dari daftar.'),
  price: rupiah('Harga harus berupa bilangan bulat rupiah, minimal 0.'),
  description: optionalText(2000),
});

export type BookInput = z.output<typeof bookSchema>;
```

- [x] **Step 4: Jalankan uji untuk memastikan lulus**

Jalankan: `npx vitest run src/server/validation/book.test.ts`
Harapan: LULUS, 5 uji.

- [x] **Step 5: Tulis uji integrasi buku yang gagal**

Buat `tests/integration/books.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { auditLogs, bookCopies } from '@/server/db/schema';
import { getBook, listBooks } from '@/server/queries/books';
import { createCategory } from '@/server/services/categories';
import { createBook, setBookStatus, updateBook, ZERO_PRICE_NOTICE } from '@/server/services/books';
import type { BookInput } from '@/server/validation/book';
import { testActor, withRollback } from './helpers';

const input: BookInput = {
  isbn: '9786021234567',
  title: 'UJI-Pemrograman Web',
  author: 'UJI Budi Raharjo',
  publisher: 'Informatika',
  publishYear: 2024,
  categoryId: null,
  rackId: null,
  price: 85_000,
  description: null,
};

describe('createBook', () => {
  it('menyimpan buku beserta harganya dan menulis audit log', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);

      const result = await createBook(input, actor, tx);

      expect(result).toEqual({ ok: true, id: expect.any(String) });
      if (!result.ok) return;
      expect(await getBook(result.id, tx)).toMatchObject({ title: 'UJI-Pemrograman Web', price: '85000.00', status: 'active' });
      const audit = await tx
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.entityId, result.id), eq(auditLogs.action, 'book.create')));
      expect(audit).toHaveLength(1);
    });
  });

  it('memperingatkan bila harga nol karena biaya ganti ikut nol', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const result = await createBook({ ...input, price: 0 }, actor, tx);
      expect(result).toEqual({ ok: true, id: expect.any(String), notice: ZERO_PRICE_NOTICE });
    });
  });
});

describe('updateBook', () => {
  it('mengubah data buku', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const created = await createBook(input, actor, tx);
      if (!created.ok) throw new Error(created.message);

      const result = await updateBook(created.id, { ...input, price: 92_000, publishYear: 2025 }, actor, tx);

      expect(result).toEqual({ ok: true, id: created.id });
      expect(await getBook(created.id, tx)).toMatchObject({ price: '92000.00', publishYear: 2025 });
    });
  });

  it('melaporkan buku yang tidak ada', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      expect(await updateBook(crypto.randomUUID(), input, actor, tx)).toEqual({
        ok: false,
        message: 'Buku tidak ditemukan. Muat ulang halaman daftar buku.',
      });
    });
  });
});

describe('setBookStatus', () => {
  it('menolak menonaktifkan buku yang eksemplarnya sedang dipinjam', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const created = await createBook(input, actor, tx);
      if (!created.ok) throw new Error(created.message);
      await tx.insert(bookCopies).values([
        { bookId: created.id, barcode: 'UJI-000001', status: 'DIPINJAM' },
        { bookId: created.id, barcode: 'UJI-000002', status: 'TERSEDIA' },
      ]);

      const result = await setBookStatus(created.id, 'inactive', actor, tx);

      expect(result).toEqual({
        ok: false,
        message:
          'Buku "UJI-Pemrograman Web" masih memiliki 1 eksemplar yang sedang dipinjam. Nonaktifkan setelah semuanya kembali.',
      });
      expect((await getBook(created.id, tx))?.status).toBe('active');
    });
  });

  it('menonaktifkan buku tanpa eksemplar yang dipinjam', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const created = await createBook(input, actor, tx);
      if (!created.ok) throw new Error(created.message);

      expect((await setBookStatus(created.id, 'inactive', actor, tx)).ok).toBe(true);
      expect((await getBook(created.id, tx))?.status).toBe('inactive');
    });
  });
});

describe('listBooks', () => {
  it('menghitung eksemplar tersedia dari book_copies, bukan dari kolom tersimpan', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const created = await createBook(input, actor, tx);
      if (!created.ok) throw new Error(created.message);
      await tx.insert(bookCopies).values([
        { bookId: created.id, barcode: 'UJI-000001', status: 'TERSEDIA' },
        { bookId: created.id, barcode: 'UJI-000002', status: 'DIPINJAM' },
        { bookId: created.id, barcode: 'UJI-000003', status: 'RUSAK' },
      ]);

      const { rows } = await listBooks({ q: 'UJI-Pemrograman', categoryId: '', status: 'active', page: 1 }, tx);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ totalCopies: 3, availableCopies: 1 });
    });
  });

  it('mencari berdasarkan penulis atau ISBN dan memfilter kategori', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const category = await createCategory({ name: 'UJI-Informatika' }, actor, tx);
      if (!category.ok) throw new Error(category.message);
      await createBook({ ...input, categoryId: category.id }, actor, tx);
      await createBook({ ...input, title: 'UJI-Basis Data', isbn: null }, actor, tx);

      const byAuthor = await listBooks({ q: 'uji budi', categoryId: '', status: 'active', page: 1 }, tx);
      expect(byAuthor.total).toBe(2);

      const byIsbn = await listBooks({ q: '9786021234567', categoryId: '', status: 'active', page: 1 }, tx);
      expect(byIsbn.rows.map((row) => row.title)).toContain('UJI-Pemrograman Web');

      const byCategory = await listBooks({ q: 'UJI', categoryId: category.id, status: 'active', page: 1 }, tx);
      expect(byCategory.rows.map((row) => [row.title, row.categoryName])).toEqual([
        ['UJI-Pemrograman Web', 'UJI-Informatika'],
      ]);
    });
  });
});
```

- [x] **Step 6: Jalankan uji untuk memastikan gagal**

Jalankan: `npm run test:integration -- tests/integration/books.test.ts`
Harapan: GAGAL dengan "Failed to resolve import '@/server/queries/books'".

- [x] **Step 7: Implementasikan service buku**

Buat `src/server/services/books.ts`:

```ts
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
      metadata: { title: input.title, price: input.price },
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
```

`books` tidak punya constraint unik: dua edisi berbeda boleh berbagi judul, penulis, bahkan ISBN yang salah cetak. Karena itu tidak ada penanganan nama ganda di sini.

- [x] **Step 8: Implementasikan query buku**

Buat `src/server/queries/books.ts`:

```ts
import { and, asc, eq, ilike, or, sql } from 'drizzle-orm';
import type { RecordStatus } from '@/domain/shared/types';
import { offsetOf, PAGE_SIZE } from '@/lib/pagination';
import type { StatusFilter } from '@/lib/search-params';
import { db } from '@/server/db/client';
import type { Executor } from '@/server/db/executor';
import { bookCopies, books, categories, racks } from '@/server/db/schema';
import { isUuid } from '@/server/validation/common';
import { containsPattern } from './like';

export interface Book {
  id: string;
  isbn: string | null;
  title: string;
  author: string;
  publisher: string | null;
  publishYear: number | null;
  categoryId: string | null;
  rackId: string | null;
  /** Nilai numeric dari Postgres, misalnya '85000.00'. */
  price: string;
  description: string | null;
  status: RecordStatus;
}

export interface BookRow {
  id: string;
  title: string;
  author: string;
  isbn: string | null;
  categoryName: string | null;
  rackCode: string | null;
  price: string;
  status: RecordStatus;
  totalCopies: number;
  availableCopies: number;
}

export interface BookFilter {
  q: string;
  /** Kosong berarti semua kategori. */
  categoryId: string;
  status: StatusFilter;
  page: number;
}

export async function listBooks(filter: BookFilter, executor: Executor = db): Promise<{ rows: BookRow[]; total: number }> {
  const pattern = containsPattern(filter.q);
  const where = and(
    filter.q
      ? or(ilike(books.title, pattern), ilike(books.author, pattern), ilike(books.isbn, pattern))
      : undefined,
    isUuid(filter.categoryId) ? eq(books.categoryId, filter.categoryId) : undefined,
    filter.status === 'all' ? undefined : eq(books.status, filter.status),
  );

  // Ketersediaan dihitung dari eksemplar setiap kali dibaca (spec 4.2):
  // penghitung tersimpan adalah sumber klasik data yang tidak sinkron.
  const copyCounts = executor
    .select({
      bookId: bookCopies.bookId,
      total: sql<number>`count(*)::int`.as('total'),
      available: sql<number>`(count(*) filter (where ${bookCopies.status} = 'TERSEDIA'))::int`.as('available'),
    })
    .from(bookCopies)
    .groupBy(bookCopies.bookId)
    .as('copy_counts');

  const rows = await executor
    .select({
      id: books.id,
      title: books.title,
      author: books.author,
      isbn: books.isbn,
      categoryName: categories.name,
      rackCode: racks.code,
      price: books.price,
      status: books.status,
      totalCopies: sql<number>`coalesce(${copyCounts.total}, 0)`,
      availableCopies: sql<number>`coalesce(${copyCounts.available}, 0)`,
    })
    .from(books)
    .leftJoin(categories, eq(categories.id, books.categoryId))
    .leftJoin(racks, eq(racks.id, books.rackId))
    .leftJoin(copyCounts, eq(copyCounts.bookId, books.id))
    .where(where)
    .orderBy(asc(books.title))
    .limit(PAGE_SIZE)
    .offset(offsetOf(filter.page));

  const [{ total }] = await executor.select({ total: sql<number>`count(*)::int` }).from(books).where(where);
  return { rows, total };
}

export async function getBook(id: string, executor: Executor = db): Promise<Book | null> {
  if (!isUuid(id)) return null;
  const [book] = await executor
    .select({
      id: books.id,
      isbn: books.isbn,
      title: books.title,
      author: books.author,
      publisher: books.publisher,
      publishYear: books.publishYear,
      categoryId: books.categoryId,
      rackId: books.rackId,
      price: books.price,
      description: books.description,
      status: books.status,
    })
    .from(books)
    .where(eq(books.id, id))
    .limit(1);
  return book ?? null;
}
```

Kueri daftar ini sudah diverifikasi terhadap database pengembangan sebelum rencana ditulis: subquery agregat dengan `.as()` lolos `tsc` dan mengembalikan `totalCopies`/`availableCopies` bertipe number.

- [x] **Step 9: Jalankan uji integrasi untuk memastikan lulus**

Jalankan: `npm run test:integration -- tests/integration/books.test.ts`
Harapan: LULUS, 8 uji.

- [x] **Step 10: Tulis uji Server Action buku yang gagal**

Buat `src/server/actions/books.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formError, IDLE } from '@/lib/form-state';

const { mockRunFormAction, mockRunCommand, mockCreate, mockUpdate, mockSetStatus } = vi.hoisted(() => ({
  mockRunFormAction: vi.fn(),
  mockRunCommand: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockSetStatus: vi.fn(),
}));

vi.mock('@/server/forms/run-action', () => ({ runFormAction: mockRunFormAction, runCommand: mockRunCommand }));
vi.mock('@/server/services/books', () => ({
  createBook: mockCreate,
  updateBook: mockUpdate,
  setBookStatus: mockSetStatus,
}));

import { createBookAction, setBookStatusAction, updateBookAction } from './books';

const actor = { id: 'u1', role: 'petugas' as const };
const data = {
  isbn: null, title: 'Pemrograman Web', author: 'Budi Raharjo', publisher: null,
  publishYear: null, categoryId: null, rackId: null, price: 85_000, description: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Server Action buku', () => {
  it('createBookAction membuka halaman detail buku baru agar eksemplar dapat langsung ditambahkan', async () => {
    await createBookAction(IDLE, new FormData());

    const options = mockRunFormAction.mock.calls[0]?.[0];
    expect(options.roles).toEqual(['admin', 'petugas']);
    expect(options.redirectTo('b9')).toBe('/master/buku/b9');
    await options.execute(data, actor);
    expect(mockCreate).toHaveBeenCalledWith(data, actor);
  });

  it('updateBookAction kembali ke halaman detail buku yang sama', async () => {
    await updateBookAction('b1', IDLE, new FormData());

    const options = mockRunFormAction.mock.calls[0]?.[0];
    expect(options.redirectTo('b1')).toBe('/master/buku/b1');
    expect(options.revalidate).toEqual(['/master/buku', '/master/buku/b1']);
    await options.execute(data, actor);
    expect(mockUpdate).toHaveBeenCalledWith('b1', data, actor);
  });

  it('setBookStatusAction menolak status yang tidak dikenal', async () => {
    const state = await setBookStatusAction('b1', 'hapus' as never, IDLE, new FormData());

    expect(state).toEqual(formError('Status buku tidak dikenal. Muat ulang halaman lalu coba lagi.'));
    expect(mockRunCommand).not.toHaveBeenCalled();
  });

  it('setBookStatusAction meneruskan status yang sah ke service', async () => {
    await setBookStatusAction('b1', 'inactive', IDLE, new FormData());

    await mockRunCommand.mock.calls[0]?.[0].execute(actor);
    expect(mockSetStatus).toHaveBeenCalledWith('b1', 'inactive', actor);
  });
});
```

- [x] **Step 11: Jalankan uji untuk memastikan gagal**

Jalankan: `npx vitest run src/server/actions/books.test.ts`
Harapan: GAGAL dengan "Failed to resolve import './books'".

- [x] **Step 12: Implementasikan Server Action buku**

Buat `src/server/actions/books.ts`:

```ts
'use server';

import type { RecordStatus, UserRole } from '@/domain/shared/types';
import { formError, type FormState } from '@/lib/form-state';
import { runCommand, runFormAction } from '@/server/forms/run-action';
import { createBook, setBookStatus, updateBook } from '@/server/services/books';
import { bookSchema } from '@/server/validation/book';
import { isRecordStatus } from '@/server/validation/common';

const ROLES: UserRole[] = ['admin', 'petugas'];
const LIST = '/master/buku';
const INVALID = 'Data buku belum dapat disimpan. Periksa kolom yang ditandai.';

function detail(id: string): string {
  return `${LIST}/${id}`;
}

export async function createBookAction(_state: FormState, formData: FormData): Promise<FormState> {
  return runFormAction({
    roles: ROLES,
    schema: bookSchema,
    formData,
    invalidMessage: INVALID,
    execute: (data, actor) => createBook(data, actor),
    successMessage: 'Buku berhasil ditambahkan.',
    revalidate: [LIST],
    // Buku tanpa eksemplar belum dapat dipinjam; langsung buka halamannya.
    redirectTo: detail,
  });
}

export async function updateBookAction(id: string, _state: FormState, formData: FormData): Promise<FormState> {
  return runFormAction({
    roles: ROLES,
    schema: bookSchema,
    formData,
    invalidMessage: INVALID,
    execute: (data, actor) => updateBook(id, data, actor),
    successMessage: 'Perubahan data buku tersimpan.',
    revalidate: [LIST, detail(id)],
    redirectTo: detail,
  });
}

export async function setBookStatusAction(
  id: string,
  status: RecordStatus,
  _state: FormState,
  _formData: FormData,
): Promise<FormState> {
  if (!isRecordStatus(status)) {
    return formError('Status buku tidak dikenal. Muat ulang halaman lalu coba lagi.');
  }
  return runCommand({
    roles: ROLES,
    execute: (actor) => setBookStatus(id, status, actor),
    successMessage: status === 'active' ? 'Buku diaktifkan.' : 'Buku dinonaktifkan.',
    revalidate: [LIST, detail(id)],
  });
}
```

- [x] **Step 13: Jalankan uji untuk memastikan lulus**

Jalankan: `npx vitest run src/server/actions/books.test.ts`
Harapan: LULUS, 4 uji.

- [x] **Step 14: Tulis uji halaman buku yang gagal**

Buat `src/app/(app)/master/buku/page.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockListBooks } = vi.hoisted(() => ({ mockListBooks: vi.fn() }));

vi.mock('@/server/queries/books', () => ({ listBooks: mockListBooks }));
vi.mock('@/server/queries/categories', () => ({
  listCategoryOptions: vi.fn(async () => [{ value: 'c1', label: 'Teknologi Informasi' }]),
}));
vi.mock('@/server/actions/books', () => ({ setBookStatusAction: vi.fn() }));

import BooksPage from './page';

async function render(params: Record<string, string> = {}) {
  return renderToStaticMarkup(await BooksPage({ searchParams: Promise.resolve(params) }));
}

describe('BooksPage', () => {
  it('menampilkan judul, penulis, ketersediaan eksemplar, dan harga', async () => {
    mockListBooks.mockResolvedValueOnce({
      rows: [{
        id: 'b1', title: 'Pemrograman Web', author: 'Budi Raharjo', isbn: null,
        categoryName: 'Teknologi Informasi', rackCode: 'A-3', price: '85000.00',
        status: 'active', totalCopies: 3, availableCopies: 2,
      }],
      total: 1,
    });

    const html = await render({ kategori: 'c1' });

    expect(mockListBooks).toHaveBeenCalledWith({ q: '', categoryId: 'c1', status: 'active', page: 1 });
    expect(html).toContain('href="/master/buku/b1"');
    expect(html).toContain('Budi Raharjo');
    expect(html).toContain('2/3 tersedia');
    expect(html).toContain('Rp85.000');
    expect(html).toContain('A-3');
  });

  it('menandai buku tanpa eksemplar dan menampilkan pesan kosong', async () => {
    mockListBooks.mockResolvedValueOnce({
      rows: [{
        id: 'b2', title: 'Basis Data', author: 'Siti', isbn: null, categoryName: null, rackCode: null,
        price: '0.00', status: 'active', totalCopies: 0, availableCopies: 0,
      }],
      total: 1,
    });
    expect(await render()).toContain('Belum ada eksemplar');

    mockListBooks.mockResolvedValueOnce({ rows: [], total: 0 });
    expect(await render()).toContain('Belum ada buku yang cocok.');
  });
});
```

Buat `src/app/(app)/master/buku/baru/page.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@/server/actions/books', () => ({ createBookAction: vi.fn() }));
vi.mock('@/server/queries/categories', () => ({
  listCategoryOptions: vi.fn(async () => [{ value: 'c1', label: 'Teknologi Informasi' }]),
}));
vi.mock('@/server/queries/racks', () => ({
  listRackOptions: vi.fn(async () => [{ value: 'r1', label: 'A-3 — Rak A Baris 3' }]),
}));

import NewBookPage from './page';

describe('NewBookPage', () => {
  it('menampilkan seluruh kolom buku beserta pilihan kategori dan rak', async () => {
    const html = renderToStaticMarkup(await NewBookPage());
    for (const name of ['isbn', 'title', 'author', 'publisher', 'publishYear', 'categoryId', 'rackId', 'price', 'description']) {
      expect(html).toContain(`name="${name}"`);
    }
    expect(html).toContain('Teknologi Informasi');
    expect(html).toContain('A-3 — Rak A Baris 3');
  });
});
```

Buat `src/app/(app)/master/buku/[id]/page.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockGetBook, mockNotFound } = vi.hoisted(() => ({
  mockGetBook: vi.fn(),
  mockNotFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('@/server/queries/books', () => ({ getBook: mockGetBook }));
vi.mock('@/server/queries/categories', () => ({ listCategoryOptions: vi.fn(async () => []) }));
vi.mock('@/server/queries/racks', () => ({ listRackOptions: vi.fn(async () => []) }));
vi.mock('@/server/actions/books', () => ({ updateBookAction: vi.fn() }));
vi.mock('next/navigation', () => ({ notFound: mockNotFound }));

import BookDetailPage from './page';

const book = {
  id: 'b1', isbn: '9786021234567', title: 'Pemrograman Web', author: 'Budi Raharjo',
  publisher: 'Informatika', publishYear: 2024, categoryId: null, rackId: null,
  price: '85000.00', description: null, status: 'active' as const,
};

async function render(params: Record<string, string> = {}) {
  return renderToStaticMarkup(await BookDetailPage({
    params: Promise.resolve({ id: 'b1' }),
    searchParams: Promise.resolve(params),
  }));
}

describe('BookDetailPage', () => {
  it('mengisi form dengan data buku, harga tanpa desimal', async () => {
    mockGetBook.mockResolvedValueOnce(book);

    const html = await render({ pesan: 'Buku berhasil ditambahkan.' });

    expect(html).toContain('value="Pemrograman Web"');
    expect(html).toContain('value="85000"');
    expect(html).toContain('value="2024"');
    expect(html).toContain('Buku berhasil ditambahkan.');
  });

  it('menampilkan halaman tidak ditemukan untuk id yang tidak ada', async () => {
    mockGetBook.mockResolvedValueOnce(null);
    await expect(render()).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
```

- [x] **Step 15: Jalankan uji untuk memastikan gagal**

Jalankan: `npx vitest run "src/app/(app)/master/buku"`
Harapan: GAGAL; halaman belum ada.

- [x] **Step 16: Implementasikan halaman buku**

Buat `src/app/(app)/master/buku/book-fields.tsx`:

```tsx
import { SelectField, TextAreaField, TextField } from '@/components/ui/fields';
import type { Option } from '@/lib/options';
import type { Book } from '@/server/queries/books';

/** Kolom form buku, dipakai bersama halaman tambah dan detail. */
export function BookFields({
  book,
  categoryOptions,
  rackOptions,
}: {
  book?: Book;
  categoryOptions: Option[];
  rackOptions: Option[];
}) {
  return (
    <>
      <TextField name="title" label="Judul" defaultValue={book?.title} required autoFocus={!book} maxLength={200} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="author" label="Penulis" defaultValue={book?.author} required maxLength={150} />
        <TextField name="publisher" label="Penerbit" defaultValue={book?.publisher ?? ''} maxLength={150} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="isbn"
          label="ISBN"
          defaultValue={book?.isbn ?? ''}
          maxLength={20}
          hint="10 atau 13 digit; tanda hubung boleh diketik."
        />
        <TextField
          name="publishYear"
          label="Tahun terbit"
          inputMode="numeric"
          defaultValue={book?.publishYear?.toString() ?? ''}
          maxLength={4}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          name="categoryId"
          label="Kategori"
          placeholder="— Tanpa kategori —"
          defaultValue={book?.categoryId ?? ''}
          options={categoryOptions}
        />
        <SelectField
          name="rackId"
          label="Rak"
          placeholder="— Belum ditempatkan —"
          defaultValue={book?.rackId ?? ''}
          options={rackOptions}
        />
      </div>
      <TextField
        name="price"
        label="Harga (Rp)"
        inputMode="numeric"
        defaultValue={book ? String(Math.round(Number(book.price))) : ''}
        maxLength={12}
        hint="Dasar biaya ganti bila eksemplar rusak atau hilang. Boleh diketik dengan titik, misalnya 85.000."
      />
      <TextAreaField name="description" label="Deskripsi" defaultValue={book?.description ?? ''} rows={3} />
    </>
  );
}
```

Buat `src/app/(app)/master/buku/page.tsx`:

```tsx
import Link from 'next/link';
import { ActionButton } from '@/components/ui/action-button';
import { buttonClass } from '@/components/ui/button-styles';
import { FilterBar, FilterSelect, STATUS_OPTIONS } from '@/components/ui/filter-bar';
import { Flash } from '@/components/ui/flash';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { RecordStatusBadge } from '@/components/ui/record-status-badge';
import { ScrollTable } from '@/components/ui/scroll-table';
import { TD, TH } from '@/components/ui/table-styles';
import { formatRupiah } from '@/lib/format';
import { parsePage } from '@/lib/pagination';
import { firstValue, parseStatusFilter, type SearchParams } from '@/lib/search-params';
import { setBookStatusAction } from '@/server/actions/books';
import { listBooks } from '@/server/queries/books';
import { listCategoryOptions } from '@/server/queries/categories';

export default async function BooksPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = firstValue(params.q);
  const categoryId = firstValue(params.kategori);
  const status = parseStatusFilter(firstValue(params.status));
  const page = parsePage(firstValue(params.hal));

  const [categoryOptions, { rows, total }] = await Promise.all([
    listCategoryOptions(),
    listBooks({ q, categoryId, status, page }),
  ]);

  return (
    <>
      <PageHeader
        title="Buku"
        description="Judul koleksi. Setiap judul memiliki satu atau lebih eksemplar fisik berbarcode."
        actions={<Link href="/master/buku/baru" className={buttonClass('primary')}>Tambah Buku</Link>}
      />
      <Flash message={firstValue(params.pesan)} />
      <FilterBar q={q} placeholder="Cari judul, penulis, atau ISBN">
        <FilterSelect
          name="kategori"
          label="Filter kategori"
          value={categoryId}
          options={[{ value: '', label: 'Semua kategori' }, ...categoryOptions]}
        />
        <FilterSelect name="status" label="Filter status" value={status} options={STATUS_OPTIONS} />
      </FilterBar>

      <ScrollTable>
        <thead>
          <tr>
            <th className={TH}>Judul</th>
            <th className={TH}>Kategori</th>
            <th className={TH}>Rak</th>
            <th className={TH}>Eksemplar</th>
            <th className={TH}>Harga</th>
            <th className={TH}>Status</th>
            <th className={TH}><span className="sr-only">Aksi</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className={`${TD} text-center text-[var(--color-ink-500)]`}>Belum ada buku yang cocok.</td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.id}>
              <td className={TD}>
                <Link href={`/master/buku/${row.id}`} className="font-medium hover:underline">{row.title}</Link>
                <div className="text-xs text-[var(--color-ink-500)]">{row.author}</div>
              </td>
              <td className={TD}>{row.categoryName ?? '—'}</td>
              <td className={`${TD} font-mono`}>{row.rackCode ?? '—'}</td>
              <td className={TD}>
                {row.totalCopies === 0 ? (
                  <span className="text-[var(--color-status-rusak)]">Belum ada eksemplar</span>
                ) : (
                  `${row.availableCopies}/${row.totalCopies} tersedia`
                )}
              </td>
              <td className={TD}>{formatRupiah(row.price)}</td>
              <td className={TD}><RecordStatusBadge status={row.status} /></td>
              <td className={TD}>
                <div className="flex items-start justify-end gap-2">
                  <Link href={`/master/buku/${row.id}`} className={buttonClass('secondary', 'sm')}>Kelola</Link>
                  <ActionButton
                    action={setBookStatusAction.bind(null, row.id, row.status === 'active' ? 'inactive' : 'active')}
                    label={row.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </ScrollTable>

      <Pagination path="/master/buku" page={page} total={total} query={{ q, kategori: categoryId, status }} />
    </>
  );
}
```

Buat `src/app/(app)/master/buku/baru/page.tsx`:

```tsx
import { ActionForm } from '@/components/ui/action-form';
import { PageHeader } from '@/components/ui/page-header';
import { createBookAction } from '@/server/actions/books';
import { listCategoryOptions } from '@/server/queries/categories';
import { listRackOptions } from '@/server/queries/racks';
import { BookFields } from '../book-fields';

export default async function NewBookPage() {
  const [categoryOptions, rackOptions] = await Promise.all([listCategoryOptions(), listRackOptions()]);

  return (
    <>
      <PageHeader title="Tambah Buku" description="Eksemplar ditambahkan setelah data judul tersimpan." />
      <ActionForm action={createBookAction} submitLabel="Simpan Buku" cancelHref="/master/buku">
        <BookFields categoryOptions={categoryOptions} rackOptions={rackOptions} />
      </ActionForm>
    </>
  );
}
```

Buat `src/app/(app)/master/buku/[id]/page.tsx`:

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/ui/action-form';
import { buttonClass } from '@/components/ui/button-styles';
import { Flash } from '@/components/ui/flash';
import { PageHeader } from '@/components/ui/page-header';
import { firstValue, type SearchParams } from '@/lib/search-params';
import { updateBookAction } from '@/server/actions/books';
import { getBook } from '@/server/queries/books';
import { listCategoryOptions } from '@/server/queries/categories';
import { listRackOptions } from '@/server/queries/racks';
import { BookFields } from '../book-fields';

export default async function BookDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const book = await getBook(id);
  if (!book) notFound();

  const [categoryOptions, rackOptions] = await Promise.all([
    listCategoryOptions(book.categoryId),
    listRackOptions(book.rackId),
  ]);

  return (
    <>
      <PageHeader
        title={book.title}
        description={book.status === 'active' ? book.author : `${book.author} · Nonaktif`}
        actions={<Link href="/master/buku" className={buttonClass('secondary')}>Kembali ke daftar</Link>}
      />
      <Flash message={firstValue(query.pesan)} />

      <section aria-labelledby="data-buku" className="space-y-4">
        <h2 id="data-buku" className="text-xl font-semibold">Data Buku</h2>
        <ActionForm action={updateBookAction.bind(null, book.id)} submitLabel="Simpan Perubahan">
          <BookFields book={book} categoryOptions={categoryOptions} rackOptions={rackOptions} />
        </ActionForm>
      </section>
    </>
  );
}
```

- [x] **Step 17: Jalankan uji untuk memastikan lulus**

Jalankan: `npx vitest run "src/app/(app)/master/buku"`
Harapan: LULUS, 5 uji.

- [x] **Step 18: Periksa di peramban, lalu commit**

Dengan `npm run dev`, buka `/master/buku`:
1. Dua buku seed tampil dengan "3/3 tersedia".
2. Tambah buku dengan harga kosong → pindah ke halaman detail buku baru, dengan pesan sukses dan peringatan "Perhatian: harga buku masih Rp0…".
3. Ubah harga menjadi `85.000` → tersimpan; di daftar tampil `Rp85.000` dan "Belum ada eksemplar".
4. Filter kategori dan pencarian ISBN bekerja, dan filter terbawa saat pindah halaman.

```bash
npm test
npm run test:integration
npm run lint
npx tsc --noEmit
git add -A
git commit -m "$(cat <<'EOF'
feat(master): kelola buku

Ketersediaan dihitung dari book_copies setiap kali dibaca, tidak
disimpan. Harga nol memunculkan peringatan karena menjadi dasar biaya
ganti. Buku dengan eksemplar yang sedang dipinjam tidak dapat
dinonaktifkan.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Eksemplar

Eksemplar adalah buku fisik berbarcode unik: benda yang benar-benar dipinjam. Task ini menambah dua aturan murni di lapisan domain (format barcode otomatis, dan perubahan status manual di luar alur pinjam-kembali), lalu menampilkannya di halaman detail buku.

Dua keputusan desain yang perlu diketahui:
- **Barcode otomatis diambil dari tabel `counters`** (`scope = 'copy_barcode'`), dengan baris terkunci di dalam transaksi, sama seperti penomoran transaksi di spec 6.3. Saat baris counter pertama kali dibuat, nilainya dimulai dari nomor `BK-` terbesar yang sudah ada, sehingga barcode seed `BK-000001`–`BK-000006` tidak pernah dipakai ulang.
- **Awalan `BK-` dicadangkan untuk barcode otomatis.** Barcode manual (untuk koleksi lama yang sudah berlabel) tidak boleh memakainya; tanpa aturan ini, barcode manual `BK-000500` suatu hari akan bertabrakan dengan penghitung.

**Files:**
- Create: `src/domain/copy/barcode.ts`, `src/domain/copy/barcode.test.ts`, `src/domain/copy/manual-status.ts`, `src/domain/copy/manual-status.test.ts`
- Create: `src/server/validation/copy.ts`, `src/server/validation/copy.test.ts`
- Create: `src/server/services/copies.ts`, `src/server/queries/copies.ts`, `tests/integration/copies.test.ts`
- Create: `src/server/actions/copies.ts`, `src/server/actions/copies.test.ts`
- Create: `src/app/(app)/master/buku/[id]/copies-section.tsx`, `src/app/(app)/master/buku/[id]/copies-section.test.tsx`
- Modify: `src/app/(app)/master/buku/[id]/page.tsx`, `src/app/(app)/master/buku/[id]/page.test.tsx` (ganti seluruh isi)

**Interfaces:**
- Consumes: seluruh keluaran Task 1–7; `CopyStatus` dari domain; `StatusBadge` dari `src/components/ui/status-badge.tsx`; `requireProfile` dari `src/server/auth/guard.ts`
- Produces:
  - `AUTO_BARCODE_PREFIX`, `formatAutoBarcode(sequence: number): string`, `autoBarcodeRange(lastSequence: number, count: number): string[]`, `isReservedBarcode(barcode: string): boolean`
  - `type ManualCopyAction = 'RESTORE' | 'DEACTIVATE' | 'REACTIVATE'`, `MANUAL_ACTION_LABELS`, `isManualCopyAction(value): value is ManualCopyAction`
  - `planManualStatusChange(current: CopyStatus, action): { ok: true; next: CopyStatus } | { ok: false; reason: 'ON_LOAN' | 'NOT_APPLICABLE' }`
  - `availableManualActions(current: CopyStatus): ManualCopyAction[]`
  - `addCopiesSchema`, `type AddCopiesInput = { count: number; barcode: string | null; acquisitionDate: string | null; notes: string | null }`
  - `addCopies(bookId, input, actor, executor?)`, `changeCopyStatus(copyId, action, actor, executor?)`
  - `interface CopyRow { id; barcode; status: CopyStatus; acquisitionDate: string | null; notes: string | null }`, `listCopiesOfBook(bookId, executor?)`
  - `addCopiesAction(bookId, state, formData)`, `changeCopyStatusAction(bookId, copyId, action, state, formData)`

- [x] **Step 1: Tulis uji aturan barcode yang gagal**

Buat `src/domain/copy/barcode.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { autoBarcodeRange, formatAutoBarcode, isReservedBarcode } from './barcode';

describe('formatAutoBarcode', () => {
  it('memberi awalan BK- dan minimal enam digit', () => {
    expect(formatAutoBarcode(123)).toBe('BK-000123');
  });

  it('tidak memotong nomor yang melebihi enam digit', () => {
    expect(formatAutoBarcode(1_234_567)).toBe('BK-1234567');
  });

  it.each([0, -1, 1.5])('menolak nomor urut %s', (sequence) => {
    expect(() => formatAutoBarcode(sequence)).toThrow('bilangan bulat positif');
  });
});

describe('autoBarcodeRange', () => {
  it('menghasilkan barcode berurutan yang berakhir di nomor terakhir yang dialokasikan', () => {
    expect(autoBarcodeRange(9, 3)).toEqual(['BK-000007', 'BK-000008', 'BK-000009']);
  });

  it('menghasilkan satu barcode untuk satu eksemplar', () => {
    expect(autoBarcodeRange(1, 1)).toEqual(['BK-000001']);
  });
});

describe('isReservedBarcode', () => {
  it('mengenali awalan BK- tanpa membedakan huruf besar', () => {
    expect(isReservedBarcode('bk-000001')).toBe(true);
  });

  it('mengizinkan barcode lain', () => {
    expect(isReservedBarcode('LAMA-0001')).toBe(false);
  });
});
```

- [x] **Step 2: Tulis uji perubahan status manual yang gagal**

Buat `src/domain/copy/manual-status.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { CopyStatus } from '../shared/types';
import { availableManualActions, isManualCopyAction, planManualStatusChange } from './manual-status';

describe('planManualStatusChange', () => {
  it.each(['RUSAK', 'HILANG'] as const)('memulihkan eksemplar %s menjadi tersedia', (status) => {
    expect(planManualStatusChange(status, 'RESTORE')).toEqual({ ok: true, next: 'TERSEDIA' });
  });

  it.each(['TERSEDIA', 'RUSAK', 'HILANG'] as const)('menarik eksemplar %s dari koleksi', (status) => {
    expect(planManualStatusChange(status, 'DEACTIVATE')).toEqual({ ok: true, next: 'NONAKTIF' });
  });

  it('mengaktifkan kembali eksemplar nonaktif menjadi tersedia', () => {
    expect(planManualStatusChange('NONAKTIF', 'REACTIVATE')).toEqual({ ok: true, next: 'TERSEDIA' });
  });

  it.each(['RESTORE', 'DEACTIVATE', 'REACTIVATE'] as const)(
    'tidak pernah mengubah eksemplar yang sedang dipinjam lewat aksi %s',
    (action) => {
      expect(planManualStatusChange('DIPINJAM', action)).toEqual({ ok: false, reason: 'ON_LOAN' });
    },
  );

  it('menolak aksi yang tidak berlaku untuk status saat ini', () => {
    expect(planManualStatusChange('TERSEDIA', 'RESTORE')).toEqual({ ok: false, reason: 'NOT_APPLICABLE' });
    expect(planManualStatusChange('NONAKTIF', 'DEACTIVATE')).toEqual({ ok: false, reason: 'NOT_APPLICABLE' });
  });
});

describe('availableManualActions', () => {
  const cases: [CopyStatus, string[]][] = [
    ['TERSEDIA', ['DEACTIVATE']],
    ['DIPINJAM', []],
    ['RUSAK', ['RESTORE', 'DEACTIVATE']],
    ['HILANG', ['RESTORE', 'DEACTIVATE']],
    ['NONAKTIF', ['REACTIVATE']],
  ];

  it.each(cases)('status %s menawarkan %j', (status, actions) => {
    expect(availableManualActions(status)).toEqual(actions);
  });
});

describe('isManualCopyAction', () => {
  it('hanya menerima tiga aksi yang dikenal', () => {
    expect(isManualCopyAction('RESTORE')).toBe(true);
    expect(isManualCopyAction('DELETE')).toBe(false);
  });
});
```

- [x] **Step 3: Jalankan uji untuk memastikan gagal**

Jalankan: `npx vitest run src/domain/copy`
Harapan: GAGAL; `./barcode` dan `./manual-status` belum ada.

- [x] **Step 4: Implementasikan aturan barcode dan status manual**

Buat `src/domain/copy/barcode.ts`:

```ts
/** Awalan barcode yang dibuat sistem. Dicadangkan: barcode manual tidak boleh memakainya. */
export const AUTO_BARCODE_PREFIX = 'BK-';

const MIN_DIGITS = 6;

export function formatAutoBarcode(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error(`Nomor urut barcode harus bilangan bulat positif, diterima: ${sequence}`);
  }
  return `${AUTO_BARCODE_PREFIX}${String(sequence).padStart(MIN_DIGITS, '0')}`;
}

/**
 * Barcode untuk `count` nomor terakhir yang dialokasikan penghitung.
 * Penghitung mengembalikan nomor terakhirnya, jadi rentangnya dihitung mundur.
 */
export function autoBarcodeRange(lastSequence: number, count: number): string[] {
  return Array.from({ length: count }, (_, index) => formatAutoBarcode(lastSequence - count + 1 + index));
}

export function isReservedBarcode(barcode: string): boolean {
  return barcode.toUpperCase().startsWith(AUTO_BARCODE_PREFIX);
}
```

Buat `src/domain/copy/manual-status.ts`:

```ts
import type { CopyStatus } from '../shared/types';

export type ManualCopyAction = 'RESTORE' | 'DEACTIVATE' | 'REACTIVATE';

export const MANUAL_ACTION_LABELS: Record<ManualCopyAction, string> = {
  RESTORE: 'Pulihkan ke tersedia',
  DEACTIVATE: 'Tarik dari koleksi',
  REACTIVATE: 'Aktifkan kembali',
};

const TRANSITIONS: Record<ManualCopyAction, { from: CopyStatus[]; to: CopyStatus }> = {
  // Spec 4.3: eksemplar rusak/hilang kembali tersedia hanya lewat aksi eksplisit
  // (diperbaiki / ditemukan), tidak pernah otomatis (BR-07).
  RESTORE: { from: ['RUSAK', 'HILANG'], to: 'TERSEDIA' },
  DEACTIVATE: { from: ['TERSEDIA', 'RUSAK', 'HILANG'], to: 'NONAKTIF' },
  REACTIVATE: { from: ['NONAKTIF'], to: 'TERSEDIA' },
};

export type ManualChangePlan =
  | { ok: true; next: CopyStatus }
  | { ok: false; reason: 'ON_LOAN' | 'NOT_APPLICABLE' };

/**
 * Perubahan status eksemplar di luar alur pinjam-kembali.
 * Eksemplar DIPINJAM tidak pernah diubah manual: statusnya milik peminjaman
 * yang masih terbuka, dan hanya pengembalian yang boleh mengubahnya.
 */
export function planManualStatusChange(current: CopyStatus, action: ManualCopyAction): ManualChangePlan {
  if (current === 'DIPINJAM') return { ok: false, reason: 'ON_LOAN' };
  const transition = TRANSITIONS[action];
  if (!transition.from.includes(current)) return { ok: false, reason: 'NOT_APPLICABLE' };
  return { ok: true, next: transition.to };
}

/** Aksi yang berlaku untuk status ini, dalam urutan tampil di layar. */
export function availableManualActions(current: CopyStatus): ManualCopyAction[] {
  return (Object.keys(TRANSITIONS) as ManualCopyAction[]).filter(
    (action) => planManualStatusChange(current, action).ok,
  );
}

export function isManualCopyAction(value: unknown): value is ManualCopyAction {
  return value === 'RESTORE' || value === 'DEACTIVATE' || value === 'REACTIVATE';
}
```

- [x] **Step 5: Jalankan uji untuk memastikan lulus**

Jalankan: `npx vitest run src/domain/copy`
Harapan: LULUS, 25 uji (9 barcode, 16 status manual). Jalankan juga `npm run lint` untuk memastikan berkas domain baru tetap murni.

- [x] **Step 6: Tulis uji skema tambah eksemplar yang gagal**

Buat `src/server/validation/copy.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { addCopiesSchema } from './copy';

function messages(input: Record<string, string>) {
  const result = addCopiesSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => [String(issue.path[0]), issue.message]);
}

describe('addCopiesSchema', () => {
  it('bawaannya satu eksemplar dengan barcode otomatis', () => {
    expect(addCopiesSchema.parse({})).toEqual({ count: 1, barcode: null, acquisitionDate: null, notes: null });
  });

  it('menerima jumlah dan tanggal pengadaan', () => {
    expect(addCopiesSchema.parse({ count: '3', acquisitionDate: '2026-07-15' })).toMatchObject({
      count: 3,
      acquisitionDate: '2026-07-15',
    });
  });

  it('menormalkan barcode manual ke huruf besar', () => {
    expect(addCopiesSchema.parse({ barcode: ' lama-0001 ' }).barcode).toBe('LAMA-0001');
  });

  it('menolak jumlah di luar 1 sampai 50', () => {
    expect(messages({ count: '51' })).toEqual([['count', 'Jumlah eksemplar harus antara 1 dan 50.']]);
  });

  it('menolak barcode manual berawalan BK-', () => {
    expect(messages({ barcode: 'BK-000500' })).toEqual([[
      'barcode',
      'Awalan BK- dicadangkan untuk barcode otomatis. Kosongkan kolom ini agar sistem membuatkannya.',
    ]]);
  });

  it('menolak barcode manual untuk lebih dari satu eksemplar', () => {
    expect(messages({ count: '2', barcode: 'LAMA-0001' })).toEqual([[
      'barcode',
      'Barcode manual hanya untuk satu eksemplar. Ubah jumlah menjadi 1 atau kosongkan barcode.',
    ]]);
  });
});
```

- [x] **Step 7: Jalankan uji untuk memastikan gagal**

Jalankan: `npx vitest run src/server/validation/copy.test.ts`
Harapan: GAGAL dengan "Failed to resolve import './copy'".

- [x] **Step 8: Implementasikan skema tambah eksemplar**

Buat `src/server/validation/copy.ts`:

```ts
import { z } from 'zod';
import { isReservedBarcode } from '@/domain/copy/barcode';
import { optionalInteger, optionalText } from './common';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const addCopiesSchema = z
  .object({
    count: optionalInteger('Jumlah eksemplar harus antara 1 dan 50.', 1, 50).transform((value) => value ?? 1),
    barcode: optionalText(30)
      .transform((value) => value?.toUpperCase() ?? null)
      .pipe(
        z.string()
          .regex(/^[A-Z0-9-]+$/, 'Barcode hanya boleh berisi huruf, angka, dan tanda hubung.')
          .refine(
            (value) => !isReservedBarcode(value),
            'Awalan BK- dicadangkan untuk barcode otomatis. Kosongkan kolom ini agar sistem membuatkannya.',
          )
          .nullable(),
      ),
    // <input type="date"> selalu mengirim YYYY-MM-DD, sesuai konvensi tanggal proyek.
    acquisitionDate: optionalText(10).pipe(
      z.string().regex(ISO_DATE, 'Tanggal pengadaan harus berformat YYYY-MM-DD.').nullable(),
    ),
    notes: optionalText(500),
  })
  .refine((value) => value.barcode === null || value.count === 1, {
    message: 'Barcode manual hanya untuk satu eksemplar. Ubah jumlah menjadi 1 atau kosongkan barcode.',
    path: ['barcode'],
  });

export type AddCopiesInput = z.output<typeof addCopiesSchema>;
```

- [x] **Step 9: Jalankan uji untuk memastikan lulus**

Jalankan: `npx vitest run src/server/validation/copy.test.ts`
Harapan: LULUS, 6 uji.

- [x] **Step 10: Tulis uji integrasi eksemplar yang gagal**

Buat `tests/integration/copies.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import type { Actor } from '@/domain/shared/types';
import type { Transaction } from '@/server/db/executor';
import { auditLogs, bookCopies } from '@/server/db/schema';
import { listCopiesOfBook } from '@/server/queries/copies';
import { createBook, setBookStatus } from '@/server/services/books';
import { addCopies, changeCopyStatus } from '@/server/services/copies';
import { testActor, withRollback } from './helpers';

async function testBook(tx: Transaction, actor: Actor): Promise<string> {
  const result = await createBook({
    isbn: null, title: 'UJI-Eksemplar', author: 'UJI-Penulis', publisher: null, publishYear: null,
    categoryId: null, rackId: null, price: 50_000, description: null,
  }, actor, tx);
  if (!result.ok) throw new Error(result.message);
  return result.id;
}

const auto = { count: 3, barcode: null, acquisitionDate: '2026-07-15', notes: null };

describe('addCopies', () => {
  it('membuat barcode otomatis yang berurutan dan mencatatnya', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const bookId = await testBook(tx, actor);

      const result = await addCopies(bookId, auto, actor, tx);

      if (!result.ok) throw new Error(result.message);
      const copies = await listCopiesOfBook(bookId, tx);
      expect(copies).toHaveLength(3);
      const numbers = copies.map((copy) => {
        expect(copy.barcode).toMatch(/^BK-\d{6,}$/);
        expect(copy.status).toBe('TERSEDIA');
        return Number(copy.barcode.slice(3));
      });
      expect(numbers).toEqual([numbers[0], numbers[0]! + 1, numbers[0]! + 2]);
      expect(result.notice).toBe(`Barcode: ${copies[0]?.barcode} s.d. ${copies[2]?.barcode}.`);

      const [audit] = await tx
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.entityId, bookId), eq(auditLogs.action, 'copy.create')));
      expect(audit?.metadata).toEqual({ barcodes: copies.map((copy) => copy.barcode) });
    });
  });

  it('melanjutkan nomor setelah barcode BK- terbesar saat penghitung belum pernah dipakai', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const bookId = await testBook(tx, actor);
      // Di dalam transaksi yang di-rollback: kondisikan seolah penghitung belum ada,
      // dan ada barcode lama BK-999990 yang dibuat di luar penghitung (misalnya oleh seed).
      await tx.execute(sql`delete from counters where scope = 'copy_barcode'`);
      await tx.insert(bookCopies).values({ bookId, barcode: 'BK-999990' });

      await addCopies(bookId, { ...auto, count: 1 }, actor, tx);

      const barcodes = (await listCopiesOfBook(bookId, tx)).map((copy) => copy.barcode);
      expect(barcodes).toEqual(['BK-999990', 'BK-999991']);
    });
  });

  it('menyimpan satu barcode manual untuk koleksi lama', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const bookId = await testBook(tx, actor);

      const result = await addCopies(bookId, { ...auto, count: 1, barcode: 'UJI-LAMA-01' }, actor, tx);

      expect(result).toEqual({ ok: true, id: expect.any(String), notice: 'Barcode: UJI-LAMA-01.' });
    });
  });

  it('menolak barcode manual yang sudah dipakai, pada kolom barcode', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const bookId = await testBook(tx, actor);
      await addCopies(bookId, { ...auto, count: 1, barcode: 'UJI-LAMA-01' }, actor, tx);

      const result = await addCopies(bookId, { ...auto, count: 1, barcode: 'UJI-LAMA-01' }, actor, tx);

      expect(result).toEqual({
        ok: false,
        field: 'barcode',
        message: 'Barcode UJI-LAMA-01 sudah dipakai eksemplar lain. Periksa label pada buku.',
      });
    });
  });

  it('menolak menambah eksemplar ke buku nonaktif', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const bookId = await testBook(tx, actor);
      await setBookStatus(bookId, 'inactive', actor, tx);

      expect(await addCopies(bookId, auto, actor, tx)).toEqual({
        ok: false,
        message: 'Buku "UJI-Eksemplar" nonaktif. Aktifkan bukunya terlebih dahulu sebelum menambah eksemplar.',
      });
    });
  });
});

describe('changeCopyStatus', () => {
  async function copyWithStatus(tx: Transaction, actor: Actor, status: 'RUSAK' | 'DIPINJAM' | 'TERSEDIA') {
    const bookId = await testBook(tx, actor);
    const [copy] = await tx
      .insert(bookCopies)
      .values({ bookId, barcode: `UJI-${status}`, status })
      .returning({ id: bookCopies.id });
    return copy.id;
  }

  it('memulihkan eksemplar rusak dan mencatat status sebelum dan sesudahnya', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const copyId = await copyWithStatus(tx, actor, 'RUSAK');

      const result = await changeCopyStatus(copyId, 'RESTORE', actor, tx);

      expect(result).toEqual({ ok: true, id: copyId });
      const [copy] = await tx.select().from(bookCopies).where(eq(bookCopies.id, copyId));
      expect(copy?.status).toBe('TERSEDIA');
      const [audit] = await tx
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.entityId, copyId), eq(auditLogs.action, 'copy.restore')));
      expect(audit?.metadata).toEqual({ barcode: 'UJI-RUSAK', from: 'RUSAK', to: 'TERSEDIA' });
    });
  });

  it('menolak mengubah eksemplar yang sedang dipinjam', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const copyId = await copyWithStatus(tx, actor, 'DIPINJAM');

      expect(await changeCopyStatus(copyId, 'DEACTIVATE', actor, tx)).toEqual({
        ok: false,
        message: 'Eksemplar UJI-DIPINJAM sedang dipinjam. Statusnya hanya dapat berubah melalui pengembalian.',
      });
    });
  });

  it('menolak aksi yang tidak berlaku untuk status saat ini', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const copyId = await copyWithStatus(tx, actor, 'TERSEDIA');

      expect(await changeCopyStatus(copyId, 'RESTORE', actor, tx)).toEqual({
        ok: false,
        message: 'Eksemplar UJI-TERSEDIA berstatus TERSEDIA, sehingga aksi "Pulihkan ke tersedia" tidak berlaku.',
      });
    });
  });
});
```

- [x] **Step 11: Jalankan uji untuk memastikan gagal**

Jalankan: `npm run test:integration -- tests/integration/copies.test.ts`
Harapan: GAGAL dengan "Failed to resolve import '@/server/queries/copies'".

- [x] **Step 12: Implementasikan query eksemplar**

Buat `src/server/queries/copies.ts`:

```ts
import { asc, eq } from 'drizzle-orm';
import type { CopyStatus } from '@/domain/shared/types';
import { db } from '@/server/db/client';
import type { Executor } from '@/server/db/executor';
import { bookCopies } from '@/server/db/schema';
import { isUuid } from '@/server/validation/common';

export interface CopyRow {
  id: string;
  barcode: string;
  status: CopyStatus;
  acquisitionDate: string | null;
  notes: string | null;
}

export async function listCopiesOfBook(bookId: string, executor: Executor = db): Promise<CopyRow[]> {
  if (!isUuid(bookId)) return [];
  return executor
    .select({
      id: bookCopies.id,
      barcode: bookCopies.barcode,
      status: bookCopies.status,
      acquisitionDate: bookCopies.acquisitionDate,
      notes: bookCopies.notes,
    })
    .from(bookCopies)
    .where(eq(bookCopies.bookId, bookId))
    .orderBy(asc(bookCopies.barcode));
}
```

- [x] **Step 13: Implementasikan service eksemplar**

Buat `src/server/services/copies.ts`:

```ts
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
      const [book] = await tx
        .select({ title: books.title, status: books.status })
        .from(books)
        .where(eq(books.id, bookId))
        .limit(1);
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
```

Alokasi counter di atas sudah diverifikasi terhadap database pengembangan sebelum rencana ditulis: pada pemanggilan pertama (baris counter belum ada, barcode seed terbesar `BK-000006`) alokasi 3 nomor mengembalikan 9, dan pemanggilan kedua mengembalikan 12.

- [x] **Step 14: Jalankan uji integrasi untuk memastikan lulus**

Jalankan: `npm run test:integration -- tests/integration/copies.test.ts`
Harapan: LULUS, 8 uji.

- [x] **Step 15: Tulis uji Server Action eksemplar yang gagal**

Buat `src/server/actions/copies.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formError, IDLE } from '@/lib/form-state';

const { mockRunFormAction, mockRunCommand, mockAddCopies, mockChangeStatus } = vi.hoisted(() => ({
  mockRunFormAction: vi.fn(),
  mockRunCommand: vi.fn(),
  mockAddCopies: vi.fn(),
  mockChangeStatus: vi.fn(),
}));

vi.mock('@/server/forms/run-action', () => ({ runFormAction: mockRunFormAction, runCommand: mockRunCommand }));
vi.mock('@/server/services/copies', () => ({ addCopies: mockAddCopies, changeCopyStatus: mockChangeStatus }));

import { addCopiesAction, changeCopyStatusAction } from './copies';

const actor = { id: 'u1', role: 'admin' as const };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('addCopiesAction', () => {
  it('terbuka untuk admin dan petugas, tetap di halaman buku', async () => {
    await addCopiesAction('b1', IDLE, new FormData());

    const options = mockRunFormAction.mock.calls[0]?.[0];
    expect(options.roles).toEqual(['admin', 'petugas']);
    expect(options.redirectTo).toBeUndefined();
    expect(options.revalidate).toEqual(['/master/buku', '/master/buku/b1']);

    const data = { count: 2, barcode: null, acquisitionDate: null, notes: null };
    await options.execute(data, actor);
    expect(mockAddCopies).toHaveBeenCalledWith('b1', data, actor);
  });
});

describe('changeCopyStatusAction', () => {
  it('hanya untuk admin', async () => {
    await changeCopyStatusAction('b1', 'k1', 'RESTORE', IDLE, new FormData());

    const options = mockRunCommand.mock.calls[0]?.[0];
    expect(options.roles).toEqual(['admin']);
    await options.execute(actor);
    expect(mockChangeStatus).toHaveBeenCalledWith('k1', 'RESTORE', actor);
  });

  it('menolak aksi yang tidak dikenal tanpa memanggil service', async () => {
    const state = await changeCopyStatusAction('b1', 'k1', 'HAPUS' as never, IDLE, new FormData());

    expect(state).toEqual(formError('Aksi eksemplar tidak dikenal. Muat ulang halaman lalu coba lagi.'));
    expect(mockRunCommand).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 16: Jalankan uji untuk memastikan gagal**

Jalankan: `npx vitest run src/server/actions/copies.test.ts`
Harapan: GAGAL dengan "Failed to resolve import './copies'".

- [x] **Step 17: Implementasikan Server Action eksemplar**

Buat `src/server/actions/copies.ts`:

```ts
'use server';

import { isManualCopyAction, type ManualCopyAction } from '@/domain/copy/manual-status';
import { formError, type FormState } from '@/lib/form-state';
import { runCommand, runFormAction } from '@/server/forms/run-action';
import { addCopies, changeCopyStatus } from '@/server/services/copies';
import { addCopiesSchema } from '@/server/validation/copy';

function affectedPages(bookId: string): string[] {
  return ['/master/buku', `/master/buku/${bookId}`];
}

export async function addCopiesAction(bookId: string, _state: FormState, formData: FormData): Promise<FormState> {
  return runFormAction({
    roles: ['admin', 'petugas'],
    schema: addCopiesSchema,
    formData,
    invalidMessage: 'Eksemplar belum dapat ditambahkan. Periksa kolom yang ditandai.',
    execute: (data, actor) => addCopies(bookId, data, actor),
    successMessage: 'Eksemplar berhasil ditambahkan.',
    revalidate: affectedPages(bookId),
  });
}

/** Spec Section 7: memulihkan eksemplar rusak/hilang hanya boleh dilakukan admin. */
export async function changeCopyStatusAction(
  bookId: string,
  copyId: string,
  action: ManualCopyAction,
  _state: FormState,
  _formData: FormData,
): Promise<FormState> {
  if (!isManualCopyAction(action)) {
    return formError('Aksi eksemplar tidak dikenal. Muat ulang halaman lalu coba lagi.');
  }
  return runCommand({
    roles: ['admin'],
    execute: (actor) => changeCopyStatus(copyId, action, actor),
    successMessage: 'Status eksemplar diperbarui.',
    revalidate: affectedPages(bookId),
  });
}
```

- [x] **Step 18: Jalankan uji untuk memastikan lulus**

Jalankan: `npx vitest run src/server/actions/copies.test.ts`
Harapan: LULUS, 3 uji.

- [x] **Step 19: Tulis uji bagian eksemplar dan halaman detail buku yang gagal**

Buat `src/app/(app)/master/buku/[id]/copies-section.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@/server/actions/copies', () => ({ addCopiesAction: vi.fn(), changeCopyStatusAction: vi.fn() }));

import { CopiesSection } from './copies-section';

const copies = [
  { id: 'k1', barcode: 'BK-000001', status: 'TERSEDIA' as const, acquisitionDate: '2026-07-15', notes: null },
  { id: 'k2', barcode: 'BK-000002', status: 'RUSAK' as const, acquisitionDate: null, notes: 'Sampul sobek' },
];

describe('CopiesSection', () => {
  it('menampilkan eksemplar, ringkasan ketersediaan, dan aksi status untuk admin', () => {
    const html = renderToStaticMarkup(
      <CopiesSection bookId="b1" bookActive copies={copies} canManageStatus />,
    );

    expect(html).toContain('1 dari 2 eksemplar tersedia');
    expect(html).toContain('BK-000002');
    expect(html).toContain('15/07/2026');
    expect(html).toContain('Sampul sobek');
    expect(html).toContain('Rusak');
    expect(html).toContain('Pulihkan ke tersedia');
    expect(html).toContain('Tarik dari koleksi');
    expect(html).toContain('name="count"');
  });

  it('menyembunyikan aksi status dari petugas', () => {
    const html = renderToStaticMarkup(
      <CopiesSection bookId="b1" bookActive copies={copies} canManageStatus={false} />,
    );
    expect(html).not.toContain('Pulihkan ke tersedia');
    expect(html).not.toContain('Tarik dari koleksi');
  });

  it('mengganti form tambah dengan penjelasan bila buku nonaktif', () => {
    const html = renderToStaticMarkup(
      <CopiesSection bookId="b1" bookActive={false} copies={[]} canManageStatus />,
    );
    expect(html).toContain('Belum ada eksemplar');
    expect(html).toContain('Buku ini nonaktif');
    expect(html).not.toContain('name="count"');
  });
});
```

Ganti seluruh isi `src/app/(app)/master/buku/[id]/page.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockGetBook, mockRequireProfile, mockNotFound } = vi.hoisted(() => ({
  mockGetBook: vi.fn(),
  mockRequireProfile: vi.fn(),
  mockNotFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('@/server/queries/books', () => ({ getBook: mockGetBook }));
vi.mock('@/server/queries/categories', () => ({ listCategoryOptions: vi.fn(async () => []) }));
vi.mock('@/server/queries/racks', () => ({ listRackOptions: vi.fn(async () => []) }));
vi.mock('@/server/queries/copies', () => ({
  listCopiesOfBook: vi.fn(async () => [
    { id: 'k1', barcode: 'BK-000001', status: 'NONAKTIF', acquisitionDate: null, notes: null },
  ]),
}));
vi.mock('@/server/auth/guard', () => ({ requireProfile: mockRequireProfile }));
vi.mock('@/server/actions/books', () => ({ updateBookAction: vi.fn() }));
vi.mock('@/server/actions/copies', () => ({ addCopiesAction: vi.fn(), changeCopyStatusAction: vi.fn() }));
vi.mock('next/navigation', () => ({ notFound: mockNotFound }));

import BookDetailPage from './page';

const book = {
  id: 'b1', isbn: '9786021234567', title: 'Pemrograman Web', author: 'Budi Raharjo',
  publisher: 'Informatika', publishYear: 2024, categoryId: null, rackId: null,
  price: '85000.00', description: null, status: 'active' as const,
};

async function render(params: Record<string, string> = {}) {
  return renderToStaticMarkup(await BookDetailPage({
    params: Promise.resolve({ id: 'b1' }),
    searchParams: Promise.resolve(params),
  }));
}

describe('BookDetailPage', () => {
  it('mengisi form dengan data buku, harga tanpa desimal', async () => {
    mockGetBook.mockResolvedValueOnce(book);
    mockRequireProfile.mockResolvedValueOnce({ role: 'petugas' });

    const html = await render({ pesan: 'Buku berhasil ditambahkan.' });

    expect(html).toContain('value="Pemrograman Web"');
    expect(html).toContain('value="85000"');
    expect(html).toContain('value="2024"');
    expect(html).toContain('Buku berhasil ditambahkan.');
  });

  it('menampilkan eksemplar, dengan aksi status hanya untuk admin', async () => {
    mockGetBook.mockResolvedValueOnce(book);
    mockRequireProfile.mockResolvedValueOnce({ role: 'admin' });
    expect(await render()).toContain('Aktifkan kembali');

    mockGetBook.mockResolvedValueOnce(book);
    mockRequireProfile.mockResolvedValueOnce({ role: 'petugas' });
    const html = await render();
    expect(html).toContain('BK-000001');
    expect(html).not.toContain('Aktifkan kembali');
  });

  it('menampilkan halaman tidak ditemukan untuk id yang tidak ada', async () => {
    mockGetBook.mockResolvedValueOnce(null);
    mockRequireProfile.mockResolvedValueOnce({ role: 'admin' });
    await expect(render()).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
```

- [x] **Step 20: Jalankan uji untuk memastikan gagal**

Jalankan: `npx vitest run "src/app/(app)/master/buku/[id]"`
Harapan: GAGAL; `./copies-section` belum ada, dan halaman belum menampilkan eksemplar.

- [x] **Step 21: Implementasikan bagian eksemplar dan rangkai ke halaman detail**

Buat `src/app/(app)/master/buku/[id]/copies-section.tsx`:

```tsx
import { ActionButton } from '@/components/ui/action-button';
import { ActionForm } from '@/components/ui/action-form';
import { TextAreaField, TextField } from '@/components/ui/fields';
import { StatusBadge } from '@/components/ui/status-badge';
import { ScrollTable } from '@/components/ui/scroll-table';
import { TD, TH } from '@/components/ui/table-styles';
import { availableManualActions, MANUAL_ACTION_LABELS } from '@/domain/copy/manual-status';
import { formatDate } from '@/lib/format';
import { addCopiesAction, changeCopyStatusAction } from '@/server/actions/copies';
import type { CopyRow } from '@/server/queries/copies';

export function CopiesSection({
  bookId,
  bookActive,
  copies,
  canManageStatus,
}: {
  bookId: string;
  bookActive: boolean;
  copies: CopyRow[];
  /** Hanya admin. Server tetap menegakkannya di changeCopyStatusAction. */
  canManageStatus: boolean;
}) {
  const available = copies.filter((copy) => copy.status === 'TERSEDIA').length;

  return (
    <section aria-labelledby="eksemplar" className="mt-10 space-y-4">
      <div>
        <h2 id="eksemplar" className="text-xl font-semibold">Eksemplar</h2>
        <p className="text-sm text-[var(--color-ink-500)]">
          {available} dari {copies.length} eksemplar tersedia untuk dipinjam.
        </p>
      </div>

      <ScrollTable>
        <thead>
          <tr>
            <th className={TH}>Barcode</th>
            <th className={TH}>Status</th>
            <th className={TH}>Tanggal Pengadaan</th>
            <th className={TH}>Catatan</th>
            <th className={TH}><span className="sr-only">Aksi</span></th>
          </tr>
        </thead>
        <tbody>
          {copies.length === 0 && (
            <tr>
              <td colSpan={5} className={`${TD} text-center text-[var(--color-ink-500)]`}>
                Belum ada eksemplar. Buku ini baru dapat dipinjam setelah eksemplarnya ditambahkan.
              </td>
            </tr>
          )}
          {copies.map((copy) => (
            <tr key={copy.id}>
              <td className={`${TD} font-mono`}>{copy.barcode}</td>
              <td className={TD}><StatusBadge status={copy.status} /></td>
              <td className={TD}>{formatDate(copy.acquisitionDate)}</td>
              <td className={TD}>{copy.notes ?? '—'}</td>
              <td className={TD}>
                {canManageStatus && (
                  <div className="flex items-start justify-end gap-2">
                    {availableManualActions(copy.status).map((action) => (
                      <ActionButton
                        key={action}
                        action={changeCopyStatusAction.bind(null, bookId, copy.id, action)}
                        label={MANUAL_ACTION_LABELS[action]}
                        confirmText={`${MANUAL_ACTION_LABELS[action]}: eksemplar ${copy.barcode}?`}
                        variant={action === 'DEACTIVATE' ? 'danger' : 'secondary'}
                      />
                    ))}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </ScrollTable>

      {bookActive ? (
        <ActionForm action={addCopiesAction.bind(null, bookId)} submitLabel="Tambah Eksemplar">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              name="count"
              label="Jumlah eksemplar"
              type="number"
              inputMode="numeric"
              defaultValue="1"
              hint="1–50. Barcode dibuat otomatis dan berurutan, misalnya BK-000123."
            />
            <TextField
              name="barcode"
              label="Barcode manual (opsional)"
              maxLength={30}
              hint="Hanya untuk buku yang sudah berlabel dari sistem lama. Jumlah harus 1."
            />
          </div>
          <TextField name="acquisitionDate" label="Tanggal pengadaan" type="date" />
          <TextAreaField name="notes" label="Catatan" rows={2} />
        </ActionForm>
      ) : (
        <p className="rounded-md bg-[var(--color-ink-100)] px-3 py-2 text-sm text-[var(--color-ink-700)]">
          Buku ini nonaktif. Aktifkan bukunya dari daftar buku untuk menambah eksemplar.
        </p>
      )}
    </section>
  );
}
```

Ganti seluruh isi `src/app/(app)/master/buku/[id]/page.tsx`:

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/ui/action-form';
import { buttonClass } from '@/components/ui/button-styles';
import { Flash } from '@/components/ui/flash';
import { PageHeader } from '@/components/ui/page-header';
import { firstValue, type SearchParams } from '@/lib/search-params';
import { updateBookAction } from '@/server/actions/books';
import { requireProfile } from '@/server/auth/guard';
import { getBook } from '@/server/queries/books';
import { listCategoryOptions } from '@/server/queries/categories';
import { listCopiesOfBook } from '@/server/queries/copies';
import { listRackOptions } from '@/server/queries/racks';
import { BookFields } from '../book-fields';
import { CopiesSection } from './copies-section';

export default async function BookDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [book, profile] = await Promise.all([getBook(id), requireProfile()]);
  if (!book) notFound();

  const [categoryOptions, rackOptions, copies] = await Promise.all([
    listCategoryOptions(book.categoryId),
    listRackOptions(book.rackId),
    listCopiesOfBook(book.id),
  ]);

  return (
    <>
      <PageHeader
        title={book.title}
        description={book.status === 'active' ? book.author : `${book.author} · Nonaktif`}
        actions={<Link href="/master/buku" className={buttonClass('secondary')}>Kembali ke daftar</Link>}
      />
      <Flash message={firstValue(query.pesan)} />

      <section aria-labelledby="data-buku" className="space-y-4">
        <h2 id="data-buku" className="text-xl font-semibold">Data Buku</h2>
        <ActionForm action={updateBookAction.bind(null, book.id)} submitLabel="Simpan Perubahan">
          <BookFields book={book} categoryOptions={categoryOptions} rackOptions={rackOptions} />
        </ActionForm>
      </section>

      <CopiesSection
        bookId={book.id}
        bookActive={book.status === 'active'}
        copies={copies}
        canManageStatus={profile.role === 'admin'}
      />
    </>
  );
}
```

- [x] **Step 22: Jalankan uji untuk memastikan lulus**

Jalankan: `npx vitest run "src/app/(app)/master/buku"`
Harapan: LULUS, 9 uji (2 daftar, 1 tambah, 3 detail, 3 bagian eksemplar).

- [x] **Step 23: Periksa di peramban, lalu commit**

Dengan `npm run dev`:
1. Sebagai `petugas`, buka buku seed "Pemrograman Web" → tiga eksemplar `BK-00000x` tampil **tanpa** tombol ubah status.
2. Tambah 2 eksemplar → pesan "Eksemplar berhasil ditambahkan. Barcode: BK-000007 s.d. BK-000008." (nomor pertama bisa lebih besar bila ada eksemplar lain yang sudah ditambahkan), dan ringkasan "5 dari 5 eksemplar tersedia".
3. Coba barcode manual `BK-000900` → galat awalan BK- dicadangkan, isian tetap.
4. Keluar, masuk sebagai `admin` → tombol "Tarik dari koleksi" muncul. Tarik salah satu eksemplar yang baru ditambahkan, konfirmasi dialog → badge menjadi "Nonaktif" dan tombol berganti "Aktifkan kembali".

```bash
npm test
npm run test:integration
npm run lint
npx tsc --noEmit
git add -A
git commit -m "$(cat <<'EOF'
feat(master): kelola eksemplar dengan barcode otomatis

Barcode BK- dialokasikan dari tabel counters yang terkunci di dalam
transaksi, dimulai dari barcode terbesar yang sudah ada. Awalan BK-
dicadangkan agar barcode manual koleksi lama tidak pernah bertabrakan
dengan penghitung. Pemulihan eksemplar rusak/hilang hanya untuk admin,
dan eksemplar yang sedang dipinjam tidak dapat diubah manual.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Verifikasi Akhir

Tidak ada kode baru. Task ini membuktikan bahwa seluruh rencana bekerja bersama, di mesin dan di peramban.

**Files:**
- Tidak ada berkas yang dibuat. Data contoh dari pemeriksaan manual dinonaktifkan di akhir.

**Interfaces:**
- Consumes: seluruh keluaran Task 1–8
- Produces: bukti bahwa Rencana 02 selesai

- [x] **Step 1: Jalankan seluruh pemeriksaan otomatis**

```bash
npm test
npm run test:integration
npm run lint
npx tsc --noEmit
npm run build
```

Harapan: seluruhnya lulus. `npm run build` mencantumkan rute `/master/kategori`, `/master/rak`, `/master/siswa`, `/master/buku`, beserta `/baru` dan `/[id]` masing-masing.

- [x] **Step 2: Pastikan uji integrasi tidak meninggalkan jejak**

```bash
npx tsx --env-file=.env.local -e "import('./src/server/db/client').then(async ({ db }) => { const { sql } = await import('drizzle-orm'); const rows = await db.execute(sql\`select (select count(*) from categories where name like 'UJI-%') + (select count(*) from racks where code like 'UJI-%') + (select count(*) from students where nis like 'UJI-%') + (select count(*) from books where title like 'UJI-%') + (select count(*) from book_copies where barcode like 'UJI-%') + (select count(*) from academic_years where name like 'UJI-%') as sisa\`); console.log('Sisa data uji:', rows[0].sisa); process.exit(0); })"
```

Harapan: `Sisa data uji: 0`. Angka lain berarti ada uji yang ditulis di luar `withRollback()`. Temukan dan perbaiki uji itu; jangan hapus datanya dengan `delete` tanpa memahami asalnya.

- [x] **Step 3: Uji alur lengkap di peramban**

Jalankan `npm run dev`. Bila memakai agen, gunakan skill `/browse` (bukan `mcp__claude-in-chrome__*`).

Sebagai **petugas** (`petugas` / `perpus123`):
1. Sidebar tidak menampilkan grup Pengaturan.
2. Buat kategori `Contoh QA` dan rak `QA-1`.
3. Buat buku `Contoh QA` dengan kategori dan rak tadi, harga kosong → langsung berada di halaman detail buku, dengan pesan sukses dan peringatan harga Rp0.
4. Tambah 2 eksemplar → barcode `BK-` berurutan tampil di pesan dan di tabel.
5. Kembali ke `/master/buku` → buku `Contoh QA` menampilkan "2/2 tersedia".
6. Buat siswa dengan NIS `202600123` → galat menyebut "atas nama Ahmad Fauzi".
7. Tekan **Keluar** → kembali ke `/login`; membuka `/master/buku` langsung diarahkan ke `/login`.

Sebagai **admin** (`admin` / `perpus123`):
8. Sidebar menampilkan grup Pengaturan.
9. Di halaman buku `Contoh QA`, tarik satu eksemplar dari koleksi → badge "Nonaktif"; daftar buku kini "1/2 tersedia".
10. Aktifkan kembali eksemplar itu → "2/2 tersedia".

Seluruh langkah harus dapat diselesaikan dengan papan ketik saja (Tab, Enter, Spasi).

Di lebar tablet (PRD bab 9), dengan `$B viewport 768x1024` atau jendela peramban selebar 768px:
11. Sidebar tersembunyi; tombol **Menu** tampil di atas top bar. Menekannya membuka sidebar sebagai panel; mengetuk area gelap di sampingnya menutupnya.
12. Membuka menu lalu memilih **Siswa** berpindah ke `/master/siswa` dan panel menu tertutup sendiri.
13. Tabel daftar buku dapat digulir ke samping di dalam kotaknya; halaman sendiri tidak ikut melebar.
14. Grup menu **Laporan** tampil untuk petugas maupun admin (halamannya memang belum ada sampai Rencana 06).

- [x] **Step 4: Periksa jejak audit dari alur di atas**

```bash
npx tsx --env-file=.env.local -e "import('./src/server/db/client').then(async ({ db }) => { const { sql } = await import('drizzle-orm'); const rows = await db.execute(sql\`select a.action, p.username, a.metadata from audit_logs a join profiles p on p.id = a.user_id order by a.created_at desc limit 10\`); console.table(rows); process.exit(0); })"
```

Harapan: baris `copy.reactivate`, `copy.deactivate`, `copy.create`, `book.create`, `rack.create`, dan `category.create` tampil dengan username pelaku yang benar (`admin` untuk dua baris teratas, `petugas` untuk sisanya).

- [x] **Step 5: Bereskan data contoh**

Sebagai admin, nonaktifkan buku, rak, dan kategori `Contoh QA` lewat layarnya masing-masing. Data master tidak dihapus (BR-08); nonaktif sudah menyembunyikannya dari daftar bawaan.

- [x] **Step 6: Tandai rencana selesai**

Ubah seluruh `- [ ]` di berkas rencana ini menjadi `- [x]`, lalu commit:

```bash
git add docs/superpowers/plans/2026-09-25-perpustakaan-02-master-data.md
git commit -m "$(cat <<'EOF'
docs: tandai Rencana 02 (Master Data) selesai

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Hasil Akhir Rencana 02

- Petugas dapat mengelola kategori, rak, siswa, buku, dan eksemplar dari layar sungguhan: tambah, ubah, cari, filter, halaman, nonaktifkan.
- Setiap perubahan data master tercatat di `audit_logs` di transaksi yang sama, lengkap dengan pelakunya.
- Barcode eksemplar dibuat otomatis tanpa risiko tabrakan, dan koleksi lama berlabel tetap dapat didaftarkan dengan barcode manual.
- Aturan status eksemplar di luar pinjam-kembali (spec 4.3) berada di lapisan domain dan teruji murni. Pemulihan rusak/hilang hanya untuk admin.
- Uji integrasi berjalan terhadap database cloud tanpa meninggalkan jejak, sehingga aman dijalankan kapan saja.
- Pola lima lapis (validasi → service → query → action → halaman) dan komponen UI bersama siap dipakai ulang Rencana 03 dan 04.

## Yang Sengaja Belum Ada

| Hal | Ditangani di |
|---|---|
| Layar Tahun Ajaran, Pengguna, Konfigurasi | Rencana 03 |
| Peminjaman, pengembalian, pelunasan denda, riwayat | Rencana 04 |
| Dashboard, cetak struk, cetak label barcode, tampilan audit log | Rencana 05 |
| Halaman laporan (menunya sudah ada) | Rencana 06 |
| Unggah sampul buku ke Supabase Storage | Ditunda. Kolom `cover_url` sudah ada; belum ada kebutuhan operasional yang mendesak |
| Import Excel | Di luar MVP (spec 2.2). `nis` dan `barcode` sudah menjadi kunci alami yang stabil |
| Menandai eksemplar rusak dari rak (bukan lewat pengembalian) | Belum diminta spec. Spec 4.3 hanya mengenal rusak/hilang sebagai hasil pengembalian |

## Verifikasi Sebelum Melanjutkan ke Rencana 03

```bash
npm test                   # seluruh uji unit lulus
npm run test:integration   # seluruh uji integrasi lulus, tanpa sisa data UJI-
npm run lint               # bersih
npm run build              # sukses
```

Dan secara manual: petugas dapat menambah buku beserta eksemplarnya dari nol, lalu melihatnya di daftar buku dengan jumlah tersedia yang benar.
