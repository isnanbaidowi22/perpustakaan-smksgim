# Perpustakaan — Rencana 01: Fondasi & Domain

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun fondasi proyek, skema database, dan seluruh aturan bisnis perpustakaan sebagai lapisan murni yang teruji penuh, ditutup dengan login yang berfungsi.

**Architecture:** Next.js App Router dengan tiga lapisan tegas. `domain/` berisi aturan bisnis murni — tanpa database, tanpa waktu sistem, tanpa I/O — sehingga dapat diuji dalam milidetik. `server/` adalah satu-satunya lapisan yang menyentuh database, melalui Drizzle di atas Supabase Postgres. `app/` hanya menyusun layar. Batas ini ditegakkan mesin, bukan disiplin: aturan ESLint menolak impor I/O dari dalam `domain/`.

**Tech Stack:** Next.js (App Router) · TypeScript mode strict · Tailwind CSS · Drizzle ORM · Supabase (Postgres + Auth) · Vitest · postgres-js

**Spec:** `docs/superpowers/specs/2026-09-21-sistem-peminjaman-perpustakaan-design.md`

**Rencana ini bagian 1 dari 3.** Rencana 02 (Master Data) dan 03 (Transaksi) ditulis setelah rencana ini selesai dikerjakan.

## Global Constraints

- **Node.js ≥ 20.** Versi persis Next.js, React, dan Drizzle yang terpasang dicatat di Task 1 Step 7 setelah instalasi.
- **TypeScript mode `strict`.** `any` implisit dan eksplisit dilarang.
- **Seluruh tanggal kalender direpresentasikan sebagai untai `'YYYY-MM-DD'`, bukan objek `Date`.** Indonesia berada di UTC+7; memakai `Date` berarti sebuah peminjaman yang dicatat pukul 08:00 WIB tersimpan sebagai hari sebelumnya dalam UTC, dan perhitungan denda meleset satu hari. Untai kalender tidak punya zona waktu, jadi tidak bisa bergeser.
- **`src/domain/**` dilarang mengimpor apa pun dari `src/server/**`, `src/app/**`, `src/components/**`, `drizzle-orm`, atau `@supabase/*`.** Ditegakkan aturan ESLint di Task 2.
- **Tidak ada fungsi domain yang memanggil `Date.now()` atau `new Date()` tanpa argumen.** Waktu selalu masuk sebagai parameter.
- **Nilai bawaan konfigurasi:** `max_active_loans = 3`, `loan_duration_days = 3`, `fine_per_day = 1000`, `block_when_overdue = true`, `block_when_unpaid_fine = false`.
- **Nilai status, persis seperti tertulis:** status eksemplar `TERSEDIA` `DIPINJAM` `RUSAK` `HILANG` `NONAKTIF`; status peminjaman `AKTIF` `SEBAGIAN_KEMBALI` `SELESAI`; kondisi pengembalian `BAIK` `RUSAK` `HILANG`; peran `admin` `petugas`.
- **Seluruh teks antarmuka berbahasa Indonesia.** Nama variabel, fungsi, dan tabel berbahasa Inggris.
- **Setiap pesan galat menyebut entitas dan tindakan.** "Transaksi gagal" tidak diterima di mana pun.
- **Setiap commit diakhiri baris:** `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

---

## Struktur Berkas

Berkas yang dibuat rencana ini, beserta tanggung jawab tunggalnya:

| Berkas | Tanggung jawab |
|---|---|
| `src/domain/shared/date.ts` | Aritmetika tanggal kalender bebas zona waktu |
| `src/domain/shared/types.ts` | Tipe bersama lapisan domain |
| `src/domain/shared/violations.ts` | Bentuk pelanggaran aturan, satu varian per aturan |
| `src/domain/loan/due-date.ts` | Perhitungan jatuh tempo |
| `src/domain/loan/rules.ts` | Validasi permintaan peminjaman |
| `src/domain/return/fine.ts` | Perhitungan denda per eksemplar |
| `src/domain/return/copy-status.ts` | Transisi status eksemplar dan status peminjaman |
| `src/server/db/schema.ts` | Definisi tabel Drizzle — sumber kebenaran skema |
| `src/server/db/client.ts` | Koneksi database tunggal |
| `src/server/db/seed.ts` | Data awal untuk pengembangan |
| `src/server/auth/session.ts` | Pembacaan sesi dan profil aktif |
| `src/server/auth/guard.ts` | Penjaga peran untuk Server Action |
| `src/server/actions/auth.ts` | Aksi masuk dan keluar |
| `src/app/globals.css` | Token desain |
| `src/app/(auth)/login/page.tsx` | Layar masuk |
| `src/app/(app)/layout.tsx` | Kerangka aplikasi: sidebar dan top bar |

Berkas domain sengaja dipecah per aturan, bukan disatukan dalam satu `rules.ts` besar. Tiap berkas dapat dibaca utuh tanpa menggulir, dan berkas ujinya berdampingan dengan namanya.

---

## Task 1: Scaffolding dan Toolchain

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `eslint.config.mjs`, `.env.example`, `.gitignore`
- Test: `src/domain/shared/smoke.test.ts` (dihapus di Task 2)

**Interfaces:**
- Consumes: —
- Produces: perintah `npm test`, `npm run lint`, `npm run build`; alias impor `@/*` → `src/*`

- [ ] **Step 1: Inisialisasi proyek Next.js**

Jalankan di akar folder proyek. Berkas PRD dan folder `docs/` yang sudah ada tidak bertabrakan dengan berkas yang dihasilkan.

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

Bila perintah menolak karena folder tidak kosong, buat di folder sementara lalu pindahkan isinya — jangan hapus berkas PRD atau `docs/`.

- [ ] **Step 2: Pasang dependensi pengujian dan database**

```bash
npm install drizzle-orm postgres @supabase/supabase-js @supabase/ssr
npm install -D vitest drizzle-kit @types/pg tsx
```

- [ ] **Step 3: Konfigurasi Vitest**

Buat `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
});
```

- [ ] **Step 4: Tambahkan skrip npm**

Ubah bagian `"scripts"` pada `package.json` menjadi:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:seed": "tsx src/server/db/seed.ts"
  }
}
```

- [ ] **Step 5: Tulis uji asap yang gagal**

Buat `src/domain/shared/smoke.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('toolchain', () => {
  it('menjalankan berkas uji TypeScript', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Jalankan uji**

Jalankan: `npm test`
Harapan: LULUS, 1 uji. Bila Vitest tidak menemukan berkas, periksa pola `include` pada Step 3.

- [ ] **Step 7: Verifikasi build dan catat versi**

```bash
npm run build
npm ls next react drizzle-orm vitest --depth=0
```

Harapan: build selesai tanpa galat. Salin keluaran `npm ls` ke bagian **Global Constraints** rencana ini, menggantikan kalimat "Versi persis … dicatat di Task 1 Step 7".

- [ ] **Step 8: Buat `.env.example`**

```bash
# Koneksi Drizzle — WAJIB lewat Supavisor transaction pooler (port 6543)
DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"

# Supabase Auth
NEXT_PUBLIC_SUPABASE_URL="https://<ref>.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"

# Domain internal untuk pemetaan username; tidak pernah menerima surel sungguhan
INTERNAL_EMAIL_DOMAIN="perpus.local"
```

- [ ] **Step 9: Inisialisasi git dan commit**

```bash
git init
git add -A
git commit -m "$(cat <<'EOF'
chore: scaffold Next.js + TypeScript + Vitest

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Fondasi Domain dan Perhitungan Jatuh Tempo

**Files:**
- Create: `src/domain/shared/date.ts`, `src/domain/shared/date.test.ts`, `src/domain/shared/types.ts`, `src/domain/shared/violations.ts`, `src/domain/loan/due-date.ts`, `src/domain/loan/due-date.test.ts`
- Modify: `eslint.config.mjs`
- Delete: `src/domain/shared/smoke.test.ts`

**Interfaces:**
- Consumes: —
- Produces:
  - `type IsoDate = string`
  - `addDays(date: IsoDate, days: number): IsoDate`
  - `diffDays(from: IsoDate, to: IsoDate): number`
  - `calculateDueDate(loanDate: IsoDate, durationDays: number): IsoDate`
  - `type CopyStatus`, `type ReturnCondition`, `type LoanStatus`, `interface LibrarySettings`, `interface StudentSnapshot`, `interface OpenLoanSnapshot`, `interface CopySnapshot`
  - `type Violation`

- [ ] **Step 1: Tulis uji aritmetika tanggal yang gagal**

Buat `src/domain/shared/date.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { addDays, diffDays } from './date';

describe('addDays', () => {
  it('menambah hari dalam bulan yang sama', () => {
    expect(addDays('2026-09-21', 3)).toBe('2026-09-24');
  });

  it('melintasi batas bulan', () => {
    expect(addDays('2026-09-29', 3)).toBe('2026-10-02');
  });

  it('melintasi batas tahun', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  });

  it('menangani tahun kabisat', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('menolak tanggal yang tidak berformat YYYY-MM-DD', () => {
    expect(() => addDays('21/09/2026', 1)).toThrow('Tanggal tidak valid');
  });
});

describe('diffDays', () => {
  it('mengembalikan nol untuk tanggal yang sama', () => {
    expect(diffDays('2026-09-21', '2026-09-21')).toBe(0);
  });

  it('mengembalikan selisih positif bila tujuan lebih akhir', () => {
    expect(diffDays('2026-09-21', '2026-09-25')).toBe(4);
  });

  it('mengembalikan selisih negatif bila tujuan lebih awal', () => {
    expect(diffDays('2026-09-25', '2026-09-21')).toBe(-4);
  });

  it('tidak terpengaruh zona waktu WIB', () => {
    // Bila implementasi memakai waktu lokal, selisih ini akan menjadi 0 atau 2.
    expect(diffDays('2026-09-21', '2026-09-22')).toBe(1);
  });
});
```

- [ ] **Step 2: Jalankan uji untuk memastikan gagal**

Jalankan: `npx vitest run src/domain/shared/date.test.ts`
Harapan: GAGAL dengan "Failed to resolve import './date'".

- [ ] **Step 3: Implementasikan aritmetika tanggal**

Buat `src/domain/shared/date.ts`:

```ts
/** Tanggal kalender tanpa zona waktu, selalu berformat 'YYYY-MM-DD'. */
export type IsoDate = string;

const MS_PER_DAY = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Mengubah tanggal kalender menjadi milidetik UTC tengah malam.
 * UTC dipakai secara sengaja: aritmetika menjadi bebas zona waktu dan
 * bebas perubahan waktu musim panas.
 */
function toUtcMillis(value: IsoDate): number {
  const parts = ISO_DATE.exec(value);
  if (!parts) {
    throw new Error(`Tanggal tidak valid: "${value}". Format yang benar YYYY-MM-DD.`);
  }
  const [, year, month, day] = parts;
  const millis = Date.UTC(Number(year), Number(month) - 1, Number(day));
  if (toIsoDate(millis) !== value) {
    throw new Error(`Tanggal tidak valid: "${value}" bukan tanggal yang ada dalam kalender.`);
  }
  return millis;
}

function toIsoDate(millis: number): IsoDate {
  return new Date(millis).toISOString().slice(0, 10);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return toIsoDate(toUtcMillis(date) + days * MS_PER_DAY);
}

/** Jumlah hari dari `from` ke `to`. Negatif bila `to` lebih awal. */
export function diffDays(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtcMillis(to) - toUtcMillis(from)) / MS_PER_DAY);
}
```

- [ ] **Step 4: Jalankan uji untuk memastikan lulus**

Jalankan: `npx vitest run src/domain/shared/date.test.ts`
Harapan: LULUS, 9 uji.

- [ ] **Step 5: Buat tipe bersama**

Buat `src/domain/shared/types.ts`:

```ts
import type { IsoDate } from './date';

export type CopyStatus = 'TERSEDIA' | 'DIPINJAM' | 'RUSAK' | 'HILANG' | 'NONAKTIF';
export type ReturnCondition = 'BAIK' | 'RUSAK' | 'HILANG';
export type LoanStatus = 'AKTIF' | 'SEBAGIAN_KEMBALI' | 'SELESAI';
export type UserRole = 'admin' | 'petugas';
export type RecordStatus = 'active' | 'inactive';

export interface LibrarySettings {
  maxActiveLoans: number;
  loanDurationDays: number;
  finePerDay: number;
  blockWhenOverdue: boolean;
  blockWhenUnpaidFine: boolean;
}

export interface StudentSnapshot {
  id: string;
  nis: string;
  name: string;
  className: string;
  status: RecordStatus;
}

/** Peminjaman yang masih memiliki eksemplar belum kembali. */
export interface OpenLoanSnapshot {
  id: string;
  transactionNumber: string;
  dueDate: IsoDate;
  /** Jumlah eksemplar dalam peminjaman ini yang belum dikembalikan. */
  openItemCount: number;
  /** total_fine dikurangi jumlah pembayaran. Nol berarti lunas. */
  unpaidFine: number;
}

export interface BorrowerSnapshot {
  name: string;
  nis: string;
  dueDate: IsoDate;
}

export interface CopySnapshot {
  id: string;
  barcode: string;
  status: CopyStatus;
  bookTitle: string;
  /** Terisi hanya bila status DIPINJAM, untuk menyusun pesan galat. */
  borrowedBy?: BorrowerSnapshot;
}
```

- [ ] **Step 6: Buat tipe pelanggaran**

Buat `src/domain/shared/violations.ts`:

```ts
import type { BorrowerSnapshot, CopyStatus } from './types';

/**
 * Pelanggaran aturan selalu berupa objek, tidak pernah untai teks.
 * Antarmuka menyusun kalimatnya sendiri agar dapat menyebut entitas
 * dan tindakan yang harus diambil petugas.
 */
export type Violation =
  | { code: 'NO_ACTIVE_YEAR' }
  | { code: 'NO_COPY_SELECTED' }
  | { code: 'STUDENT_INACTIVE'; studentName: string }
  | { code: 'DUPLICATE_COPY'; barcode: string; bookTitle: string }
  | {
      code: 'QUOTA_EXCEEDED';
      studentName: string;
      activeCount: number;
      requestedCount: number;
      maxActiveLoans: number;
    }
  | {
      code: 'HAS_OVERDUE';
      studentName: string;
      transactionNumber: string;
      daysLate: number;
    }
  | {
      code: 'COPY_UNAVAILABLE';
      barcode: string;
      bookTitle: string;
      status: CopyStatus;
      borrowedBy?: BorrowerSnapshot;
    }
  | { code: 'UNPAID_FINE'; studentName: string; amount: number };

export type ViolationCode = Violation['code'];

export type ValidationResult =
  | { ok: true }
  | { ok: false; violations: Violation[] };
```

- [ ] **Step 7: Tulis uji jatuh tempo yang gagal**

Buat `src/domain/loan/due-date.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { calculateDueDate } from './due-date';

describe('calculateDueDate', () => {
  it('menambahkan durasi pinjam ke tanggal pinjam', () => {
    expect(calculateDueDate('2026-09-21', 3)).toBe('2026-09-24');
  });

  it('menghormati durasi yang dikonfigurasi, bukan nilai tetap', () => {
    expect(calculateDueDate('2026-09-21', 7)).toBe('2026-09-28');
  });

  it('menolak durasi nol', () => {
    expect(() => calculateDueDate('2026-09-21', 0)).toThrow('minimal 1 hari');
  });

  it('menolak durasi negatif', () => {
    expect(() => calculateDueDate('2026-09-21', -1)).toThrow('minimal 1 hari');
  });
});
```

- [ ] **Step 8: Jalankan uji untuk memastikan gagal**

Jalankan: `npx vitest run src/domain/loan/due-date.test.ts`
Harapan: GAGAL dengan "Failed to resolve import './due-date'".

- [ ] **Step 9: Implementasikan jatuh tempo**

Buat `src/domain/loan/due-date.ts`:

```ts
import { addDays, type IsoDate } from '../shared/date';

export function calculateDueDate(loanDate: IsoDate, durationDays: number): IsoDate {
  if (!Number.isInteger(durationDays) || durationDays < 1) {
    throw new Error(`Durasi pinjam minimal 1 hari, diterima: ${durationDays}`);
  }
  return addDays(loanDate, durationDays);
}
```

- [ ] **Step 10: Jalankan uji untuk memastikan lulus**

Jalankan: `npx vitest run src/domain/loan/due-date.test.ts`
Harapan: LULUS, 4 uji.

- [ ] **Step 11: Tegakkan kemurnian lapisan domain lewat ESLint**

Tambahkan blok ini ke array konfigurasi pada `eslint.config.mjs`, setelah konfigurasi bawaan Next.js:

```js
{
  files: ['src/domain/**/*.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [{
        group: [
          '@/server/*', '@/app/*', '@/components/*',
          'drizzle-orm', 'drizzle-orm/*',
          '@supabase/*', 'postgres', 'next/*',
        ],
        message:
          'Lapisan domain harus murni. Dilarang mengimpor database, jaringan, ' +
          'atau UI — itulah yang membuat aturan bisnis dapat diuji tanpa infrastruktur.',
      }],
    }],
  },
},
```

- [ ] **Step 12: Verifikasi aturan lint benar-benar menggigit**

Tambahkan sementara baris `import { db } from '@/server/db/client';` di awal `src/domain/loan/due-date.ts`, lalu jalankan `npm run lint`.
Harapan: GAGAL dengan pesan "Lapisan domain harus murni".
Hapus kembali baris itu dan jalankan ulang `npm run lint`.
Harapan: LULUS tanpa galat.

Aturan yang tidak pernah dilihat gagal adalah aturan yang belum terbukti menyala.

- [ ] **Step 13: Hapus uji asap dan commit**

```bash
rm src/domain/shared/smoke.test.ts
npm test
git add -A
git commit -m "$(cat <<'EOF'
feat(domain): tanggal kalender bebas zona waktu dan perhitungan jatuh tempo

Tanggal direpresentasikan sebagai untai YYYY-MM-DD, bukan Date, agar
perhitungan tidak bergeser satu hari di WIB (UTC+7). Aturan ESLint
menegakkan kemurnian lapisan domain.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Perhitungan Denda

**Files:**
- Create: `src/domain/return/fine.ts`, `src/domain/return/fine.test.ts`

**Interfaces:**
- Consumes: `diffDays` dan `IsoDate` dari `src/domain/shared/date.ts`; `ReturnCondition` dari `src/domain/shared/types.ts`
- Produces: `calculateItemFine(input: FineInput): FineResult`, `interface FineInput`, `interface FineResult`

- [ ] **Step 1: Tulis uji denda yang gagal**

Buat `src/domain/return/fine.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { calculateItemFine } from './fine';

const base = {
  dueDate: '2026-09-24',
  finePerDay: 1000,
  bookPrice: 85_000,
} as const;

describe('calculateItemFine — keterlambatan', () => {
  it('tidak mendenda pengembalian tepat pada hari jatuh tempo', () => {
    const result = calculateItemFine({ ...base, returnDate: '2026-09-24', condition: 'BAIK' });
    expect(result).toEqual({ daysLate: 0, lateFine: 0, replacementFee: 0, total: 0 });
  });

  it('tidak mendenda pengembalian lebih awal', () => {
    const result = calculateItemFine({ ...base, returnDate: '2026-09-22', condition: 'BAIK' });
    expect(result.daysLate).toBe(0);
    expect(result.lateFine).toBe(0);
  });

  it('mendenda per hari keterlambatan', () => {
    const result = calculateItemFine({ ...base, returnDate: '2026-09-28', condition: 'BAIK' });
    expect(result.daysLate).toBe(4);
    expect(result.lateFine).toBe(4000);
    expect(result.total).toBe(4000);
  });

  it('memakai tarif dari konfigurasi, bukan nilai tetap', () => {
    const result = calculateItemFine({
      ...base, returnDate: '2026-09-26', condition: 'BAIK', finePerDay: 2500,
    });
    expect(result.lateFine).toBe(5000);
  });
});

describe('calculateItemFine — kondisi buku', () => {
  it('membebankan harga buku bila rusak', () => {
    const result = calculateItemFine({ ...base, returnDate: '2026-09-24', condition: 'RUSAK' });
    expect(result.replacementFee).toBe(85_000);
    expect(result.total).toBe(85_000);
  });

  it('membebankan harga buku bila hilang', () => {
    const result = calculateItemFine({ ...base, returnDate: '2026-09-24', condition: 'HILANG' });
    expect(result.replacementFee).toBe(85_000);
  });

  it('menumpuk denda telat dan biaya ganti bila buku rusak sekaligus terlambat', () => {
    const result = calculateItemFine({ ...base, returnDate: '2026-09-28', condition: 'RUSAK' });
    expect(result.lateFine).toBe(4000);
    expect(result.replacementFee).toBe(85_000);
    expect(result.total).toBe(89_000);
  });

  it('mengutamakan nominal yang ditimpa petugas atas harga katalog', () => {
    const result = calculateItemFine({
      ...base, returnDate: '2026-09-24', condition: 'HILANG', replacementFeeOverride: 120_000,
    });
    expect(result.replacementFee).toBe(120_000);
  });

  it('menghormati nominal timpaan nol', () => {
    const result = calculateItemFine({
      ...base, returnDate: '2026-09-24', condition: 'RUSAK', replacementFeeOverride: 0,
    });
    expect(result.replacementFee).toBe(0);
  });

  it('mengabaikan nominal timpaan bila kondisi buku baik', () => {
    const result = calculateItemFine({
      ...base, returnDate: '2026-09-24', condition: 'BAIK', replacementFeeOverride: 120_000,
    });
    expect(result.replacementFee).toBe(0);
  });
});
```

Uji "menghormati nominal timpaan nol" ada karena `??` dan `||` berperilaku berbeda di sini: `||` akan salah membuang nominal nol dan memakai harga katalog.

- [ ] **Step 2: Jalankan uji untuk memastikan gagal**

Jalankan: `npx vitest run src/domain/return/fine.test.ts`
Harapan: GAGAL dengan "Failed to resolve import './fine'".

- [ ] **Step 3: Implementasikan perhitungan denda**

Buat `src/domain/return/fine.ts`:

```ts
import { diffDays, type IsoDate } from '../shared/date';
import type { ReturnCondition } from '../shared/types';

export interface FineInput {
  dueDate: IsoDate;
  returnDate: IsoDate;
  condition: ReturnCondition;
  finePerDay: number;
  /** Harga katalog dari books.price, dipakai bila petugas tidak menimpanya. */
  bookPrice: number;
  /** Nominal ganti yang diisi petugas. Nol adalah nilai yang sah. */
  replacementFeeOverride?: number;
}

export interface FineResult {
  daysLate: number;
  lateFine: number;
  replacementFee: number;
  total: number;
}

export function calculateItemFine(input: FineInput): FineResult {
  const daysLate = Math.max(0, diffDays(input.dueDate, input.returnDate));
  const lateFine = daysLate * input.finePerDay;

  const needsReplacement = input.condition === 'RUSAK' || input.condition === 'HILANG';
  const replacementFee = needsReplacement
    ? input.replacementFeeOverride ?? input.bookPrice
    : 0;

  return { daysLate, lateFine, replacementFee, total: lateFine + replacementFee };
}
```

- [ ] **Step 4: Jalankan uji untuk memastikan lulus**

Jalankan: `npx vitest run src/domain/return/fine.test.ts`
Harapan: LULUS, 10 uji.

- [ ] **Step 5: Commit**

```bash
git add src/domain/return/
git commit -m "$(cat <<'EOF'
feat(domain): perhitungan denda per eksemplar

Denda telat dan biaya ganti dihitung terpisah lalu dijumlahkan, sehingga
buku yang rusak sekaligus terlambat menanggung keduanya.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Transisi Status Eksemplar dan Peminjaman

**Files:**
- Create: `src/domain/return/copy-status.ts`, `src/domain/return/copy-status.test.ts`

**Interfaces:**
- Consumes: `CopyStatus`, `ReturnCondition`, `LoanStatus` dari `src/domain/shared/types.ts`
- Produces: `nextCopyStatus(condition: ReturnCondition): CopyStatus`, `resolveLoanStatus(items: LoanItemState[]): LoanStatus`, `interface LoanItemState`

- [ ] **Step 1: Tulis uji transisi status yang gagal**

Buat `src/domain/return/copy-status.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { nextCopyStatus, resolveLoanStatus } from './copy-status';

describe('nextCopyStatus', () => {
  it('mengembalikan eksemplar berkondisi baik menjadi tersedia', () => {
    expect(nextCopyStatus('BAIK')).toBe('TERSEDIA');
  });

  it('tidak membuat eksemplar rusak menjadi tersedia', () => {
    expect(nextCopyStatus('RUSAK')).toBe('RUSAK');
  });

  it('tidak membuat eksemplar hilang menjadi tersedia', () => {
    expect(nextCopyStatus('HILANG')).toBe('HILANG');
  });
});

describe('resolveLoanStatus', () => {
  it('tetap aktif bila belum ada satu pun yang kembali', () => {
    expect(resolveLoanStatus([{ returned: false }, { returned: false }])).toBe('AKTIF');
  });

  it('menjadi sebagian kembali bila baru sebagian yang kembali', () => {
    expect(resolveLoanStatus([{ returned: true }, { returned: false }])).toBe('SEBAGIAN_KEMBALI');
  });

  it('menjadi selesai bila seluruhnya sudah kembali', () => {
    expect(resolveLoanStatus([{ returned: true }, { returned: true }])).toBe('SELESAI');
  });

  it('menganggap peminjaman satu buku yang sudah kembali sebagai selesai', () => {
    expect(resolveLoanStatus([{ returned: true }])).toBe('SELESAI');
  });

  it('menolak peminjaman tanpa item', () => {
    expect(() => resolveLoanStatus([])).toThrow('minimal satu eksemplar');
  });
});
```

- [ ] **Step 2: Jalankan uji untuk memastikan gagal**

Jalankan: `npx vitest run src/domain/return/copy-status.test.ts`
Harapan: GAGAL dengan "Failed to resolve import './copy-status'".

- [ ] **Step 3: Implementasikan transisi status**

Buat `src/domain/return/copy-status.ts`:

```ts
import type { CopyStatus, LoanStatus, ReturnCondition } from '../shared/types';

/**
 * Menegakkan BR-07: eksemplar rusak atau hilang tidak pernah kembali
 * tersedia secara otomatis. Pemulihannya adalah aksi admin eksplisit
 * yang ditangani terpisah dan tercatat di audit log.
 */
export function nextCopyStatus(condition: ReturnCondition): CopyStatus {
  switch (condition) {
    case 'BAIK':
      return 'TERSEDIA';
    case 'RUSAK':
      return 'RUSAK';
    case 'HILANG':
      return 'HILANG';
  }
}

export interface LoanItemState {
  returned: boolean;
}

export function resolveLoanStatus(items: LoanItemState[]): LoanStatus {
  if (items.length === 0) {
    throw new Error('Peminjaman harus memiliki minimal satu eksemplar.');
  }
  if (items.every((item) => item.returned)) return 'SELESAI';
  if (items.some((item) => item.returned)) return 'SEBAGIAN_KEMBALI';
  return 'AKTIF';
}
```

- [ ] **Step 4: Jalankan uji untuk memastikan lulus**

Jalankan: `npx vitest run src/domain/return/copy-status.test.ts`
Harapan: LULUS, 8 uji.

- [ ] **Step 5: Commit**

```bash
git add src/domain/return/copy-status.ts src/domain/return/copy-status.test.ts
git commit -m "$(cat <<'EOF'
feat(domain): transisi status eksemplar dan peminjaman

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Validasi Permintaan Peminjaman

Ini aturan terpadat dalam sistem. Ia menggabungkan tujuh pemeriksaan dan mengembalikan **seluruh** pelanggaran sekaligus, bukan berhenti pada yang pertama — petugas harus melihat semua masalah dalam satu tampilan, bukan menemukannya satu per satu setiap kali menekan simpan.

**Files:**
- Create: `src/domain/loan/rules.ts`, `src/domain/loan/rules.test.ts`

**Interfaces:**
- Consumes: `diffDays`, `IsoDate`; `LibrarySettings`, `StudentSnapshot`, `OpenLoanSnapshot`, `CopySnapshot`; `Violation`, `ValidationResult`
- Produces: `validateLoanRequest(input: LoanRequestInput): ValidationResult`, `interface LoanRequestInput`, `DEFAULT_SETTINGS`

- [ ] **Step 1: Tulis uji validasi yang gagal**

Buat `src/domain/loan/rules.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { validateLoanRequest, type LoanRequestInput } from './rules';
import type { CopySnapshot, LibrarySettings, StudentSnapshot } from '../shared/types';
import type { Violation, ViolationCode } from '../shared/violations';

const settings: LibrarySettings = {
  maxActiveLoans: 3,
  loanDurationDays: 3,
  finePerDay: 1000,
  blockWhenOverdue: true,
  blockWhenUnpaidFine: false,
};

const student: StudentSnapshot = {
  id: 'stu-1',
  nis: '202600123',
  name: 'Ahmad Fauzi',
  className: 'XI RPL 1',
  status: 'active',
};

function copy(overrides: Partial<CopySnapshot> = {}): CopySnapshot {
  return {
    id: 'copy-1',
    barcode: 'BK-000123',
    status: 'TERSEDIA',
    bookTitle: 'Pemrograman Web',
    ...overrides,
  };
}

function request(overrides: Partial<LoanRequestInput> = {}): LoanRequestInput {
  return {
    student,
    openLoans: [],
    requestedCopies: [copy()],
    settings,
    hasActiveAcademicYear: true,
    today: '2026-09-21',
    ...overrides,
  };
}

function codesOf(result: ReturnType<typeof validateLoanRequest>): ViolationCode[] {
  return result.ok ? [] : result.violations.map((v: Violation) => v.code);
}

describe('validateLoanRequest — jalur normal', () => {
  it('menerima permintaan yang memenuhi seluruh aturan', () => {
    expect(validateLoanRequest(request())).toEqual({ ok: true });
  });

  it('menerima permintaan yang tepat mengisi sisa kuota', () => {
    const result = validateLoanRequest(request({
      openLoans: [{ id: 'l1', transactionNumber: 'PJM-20260920-0001', dueDate: '2026-09-23', openItemCount: 2, unpaidFine: 0 }],
      requestedCopies: [copy()],
    }));
    expect(result).toEqual({ ok: true });
  });
});

describe('validateLoanRequest — prasyarat', () => {
  it('menolak bila tidak ada tahun ajaran aktif', () => {
    expect(codesOf(validateLoanRequest(request({ hasActiveAcademicYear: false })))).toContain('NO_ACTIVE_YEAR');
  });

  it('menolak bila tidak ada buku yang dipilih', () => {
    expect(codesOf(validateLoanRequest(request({ requestedCopies: [] })))).toContain('NO_COPY_SELECTED');
  });

  it('menolak siswa tidak aktif', () => {
    const result = validateLoanRequest(request({ student: { ...student, status: 'inactive' } }));
    expect(result).toEqual({
      ok: false,
      violations: [{ code: 'STUDENT_INACTIVE', studentName: 'Ahmad Fauzi' }],
    });
  });
});

describe('validateLoanRequest — kuota', () => {
  it('menolak bila permintaan melewati batas maksimal', () => {
    const result = validateLoanRequest(request({
      openLoans: [{ id: 'l1', transactionNumber: 'PJM-20260920-0001', dueDate: '2026-09-23', openItemCount: 3, unpaidFine: 0 }],
    }));
    expect(result).toEqual({
      ok: false,
      violations: [{
        code: 'QUOTA_EXCEEDED',
        studentName: 'Ahmad Fauzi',
        activeCount: 3,
        requestedCount: 1,
        maxActiveLoans: 3,
      }],
    });
  });

  it('menjumlahkan eksemplar terbuka dari beberapa peminjaman', () => {
    const result = validateLoanRequest(request({
      openLoans: [
        { id: 'l1', transactionNumber: 'PJM-20260920-0001', dueDate: '2026-09-23', openItemCount: 1, unpaidFine: 0 },
        { id: 'l2', transactionNumber: 'PJM-20260920-0002', dueDate: '2026-09-23', openItemCount: 2, unpaidFine: 0 },
      ],
    }));
    expect(codesOf(result)).toContain('QUOTA_EXCEEDED');
  });

  it('menghitung seluruh buku dalam satu permintaan terhadap kuota', () => {
    const result = validateLoanRequest(request({
      requestedCopies: [
        copy({ id: 'c1', barcode: 'BK-000001' }),
        copy({ id: 'c2', barcode: 'BK-000002' }),
        copy({ id: 'c3', barcode: 'BK-000003' }),
        copy({ id: 'c4', barcode: 'BK-000004' }),
      ],
    }));
    expect(codesOf(result)).toContain('QUOTA_EXCEEDED');
  });

  it('menghormati batas yang dikonfigurasi, bukan angka tiga yang tetap', () => {
    const result = validateLoanRequest(request({
      settings: { ...settings, maxActiveLoans: 5 },
      openLoans: [{ id: 'l1', transactionNumber: 'PJM-20260920-0001', dueDate: '2026-09-23', openItemCount: 3, unpaidFine: 0 }],
    }));
    expect(result).toEqual({ ok: true });
  });
});

describe('validateLoanRequest — keterlambatan', () => {
  const overdue = {
    id: 'l1', transactionNumber: 'PJM-20260917-0003',
    dueDate: '2026-09-17', openItemCount: 1, unpaidFine: 0,
  };

  it('menolak siswa yang punya pinjaman terlambat', () => {
    const result = validateLoanRequest(request({ openLoans: [overdue] }));
    expect(result).toEqual({
      ok: false,
      violations: [{
        code: 'HAS_OVERDUE',
        studentName: 'Ahmad Fauzi',
        transactionNumber: 'PJM-20260917-0003',
        daysLate: 4,
      }],
    });
  });

  it('tidak menganggap terlambat pinjaman yang jatuh tempo hari ini', () => {
    const result = validateLoanRequest(request({
      openLoans: [{ ...overdue, dueDate: '2026-09-21' }],
    }));
    expect(result).toEqual({ ok: true });
  });

  it('melewati pemeriksaan bila blockWhenOverdue dimatikan', () => {
    const result = validateLoanRequest(request({
      openLoans: [overdue],
      settings: { ...settings, blockWhenOverdue: false },
    }));
    expect(result).toEqual({ ok: true });
  });
});

describe('validateLoanRequest — ketersediaan eksemplar', () => {
  it('menolak eksemplar yang sedang dipinjam beserta identitas peminjamnya', () => {
    const result = validateLoanRequest(request({
      requestedCopies: [copy({
        status: 'DIPINJAM',
        borrowedBy: { name: 'Siti Aminah', nis: '202600456', dueDate: '2026-09-24' },
      })],
    }));
    expect(result).toEqual({
      ok: false,
      violations: [{
        code: 'COPY_UNAVAILABLE',
        barcode: 'BK-000123',
        bookTitle: 'Pemrograman Web',
        status: 'DIPINJAM',
        borrowedBy: { name: 'Siti Aminah', nis: '202600456', dueDate: '2026-09-24' },
      }],
    });
  });

  it.each(['RUSAK', 'HILANG', 'NONAKTIF'] as const)('menolak eksemplar berstatus %s', (status) => {
    const result = validateLoanRequest(request({ requestedCopies: [copy({ status })] }));
    expect(codesOf(result)).toContain('COPY_UNAVAILABLE');
  });

  it('menolak eksemplar yang sama dimasukkan dua kali', () => {
    const result = validateLoanRequest(request({
      requestedCopies: [copy(), copy()],
    }));
    expect(codesOf(result)).toContain('DUPLICATE_COPY');
  });

  it('tidak menghitung eksemplar ganda dua kali terhadap kuota', () => {
    const result = validateLoanRequest(request({
      openLoans: [{ id: 'l1', transactionNumber: 'PJM-20260920-0001', dueDate: '2026-09-23', openItemCount: 2, unpaidFine: 0 }],
      requestedCopies: [copy(), copy()],
    }));
    expect(codesOf(result)).not.toContain('QUOTA_EXCEEDED');
  });
});

describe('validateLoanRequest — tunggakan denda', () => {
  const unpaid = {
    id: 'l1', transactionNumber: 'PJM-20260910-0001',
    dueDate: '2026-09-23', openItemCount: 1, unpaidFine: 4000,
  };

  it('mengizinkan peminjaman meski ada tunggakan, sesuai bawaan', () => {
    expect(validateLoanRequest(request({ openLoans: [unpaid] }))).toEqual({ ok: true });
  });

  it('menolak bila blockWhenUnpaidFine dinyalakan', () => {
    const result = validateLoanRequest(request({
      openLoans: [unpaid],
      settings: { ...settings, blockWhenUnpaidFine: true },
    }));
    expect(result).toEqual({
      ok: false,
      violations: [{ code: 'UNPAID_FINE', studentName: 'Ahmad Fauzi', amount: 4000 }],
    });
  });
});

describe('validateLoanRequest — pelanggaran majemuk', () => {
  it('melaporkan seluruh pelanggaran sekaligus, bukan hanya yang pertama', () => {
    const result = validateLoanRequest(request({
      student: { ...student, status: 'inactive' },
      openLoans: [{ id: 'l1', transactionNumber: 'PJM-20260917-0003', dueDate: '2026-09-17', openItemCount: 3, unpaidFine: 0 }],
      requestedCopies: [copy({ status: 'RUSAK' })],
    }));
    const codes = codesOf(result);
    expect(codes).toContain('STUDENT_INACTIVE');
    expect(codes).toContain('QUOTA_EXCEEDED');
    expect(codes).toContain('HAS_OVERDUE');
    expect(codes).toContain('COPY_UNAVAILABLE');
  });
});
```

- [ ] **Step 2: Jalankan uji untuk memastikan gagal**

Jalankan: `npx vitest run src/domain/loan/rules.test.ts`
Harapan: GAGAL dengan "Failed to resolve import './rules'".

- [ ] **Step 3: Implementasikan validasi**

Buat `src/domain/loan/rules.ts`:

```ts
import { diffDays, type IsoDate } from '../shared/date';
import type {
  CopySnapshot,
  LibrarySettings,
  OpenLoanSnapshot,
  StudentSnapshot,
} from '../shared/types';
import type { ValidationResult, Violation } from '../shared/violations';

export const DEFAULT_SETTINGS: LibrarySettings = {
  maxActiveLoans: 3,
  loanDurationDays: 3,
  finePerDay: 1000,
  blockWhenOverdue: true,
  blockWhenUnpaidFine: false,
};

export interface LoanRequestInput {
  student: StudentSnapshot;
  /** Peminjaman siswa yang masih memiliki eksemplar belum kembali. */
  openLoans: OpenLoanSnapshot[];
  requestedCopies: CopySnapshot[];
  settings: LibrarySettings;
  hasActiveAcademicYear: boolean;
  today: IsoDate;
}

/**
 * Mengumpulkan SELURUH pelanggaran, tidak berhenti pada yang pertama.
 * Petugas harus melihat semua masalah dalam satu tampilan, bukan
 * menemukannya satu per satu setiap kali menekan simpan.
 */
export function validateLoanRequest(input: LoanRequestInput): ValidationResult {
  const violations: Violation[] = [];
  const { student, openLoans, requestedCopies, settings, today } = input;

  if (!input.hasActiveAcademicYear) {
    violations.push({ code: 'NO_ACTIVE_YEAR' });
  }

  if (requestedCopies.length === 0) {
    violations.push({ code: 'NO_COPY_SELECTED' });
  }

  if (student.status !== 'active') {
    violations.push({ code: 'STUDENT_INACTIVE', studentName: student.name });
  }

  // Eksemplar ganda dilaporkan sekali per barcode, lalu diabaikan dari
  // perhitungan kuota supaya tidak menghasilkan dua pelanggaran untuk satu kesalahan.
  const seen = new Set<string>();
  const uniqueCopies: CopySnapshot[] = [];
  for (const copy of requestedCopies) {
    if (seen.has(copy.id)) {
      violations.push({
        code: 'DUPLICATE_COPY',
        barcode: copy.barcode,
        bookTitle: copy.bookTitle,
      });
      continue;
    }
    seen.add(copy.id);
    uniqueCopies.push(copy);
  }

  const activeCount = openLoans.reduce((sum, loan) => sum + loan.openItemCount, 0);
  if (activeCount + uniqueCopies.length > settings.maxActiveLoans) {
    violations.push({
      code: 'QUOTA_EXCEEDED',
      studentName: student.name,
      activeCount,
      requestedCount: uniqueCopies.length,
      maxActiveLoans: settings.maxActiveLoans,
    });
  }

  if (settings.blockWhenOverdue) {
    for (const loan of openLoans) {
      const daysLate = diffDays(loan.dueDate, today);
      if (daysLate > 0) {
        violations.push({
          code: 'HAS_OVERDUE',
          studentName: student.name,
          transactionNumber: loan.transactionNumber,
          daysLate,
        });
      }
    }
  }

  if (settings.blockWhenUnpaidFine) {
    const amount = openLoans.reduce((sum, loan) => sum + loan.unpaidFine, 0);
    if (amount > 0) {
      violations.push({ code: 'UNPAID_FINE', studentName: student.name, amount });
    }
  }

  for (const copy of uniqueCopies) {
    if (copy.status !== 'TERSEDIA') {
      violations.push({
        code: 'COPY_UNAVAILABLE',
        barcode: copy.barcode,
        bookTitle: copy.bookTitle,
        status: copy.status,
        ...(copy.borrowedBy ? { borrowedBy: copy.borrowedBy } : {}),
      });
    }
  }

  return violations.length > 0 ? { ok: false, violations } : { ok: true };
}
```

- [ ] **Step 4: Jalankan uji untuk memastikan lulus**

Jalankan: `npx vitest run src/domain/loan/rules.test.ts`
Harapan: LULUS, 21 uji.

- [ ] **Step 5: Jalankan seluruh uji dan lint**

```bash
npm test
npm run lint
```
Harapan: seluruh uji lulus, lint bersih. Seluruh aturan bisnis kini teruji tanpa satu pun database.

- [ ] **Step 6: Commit**

```bash
git add src/domain/loan/
git commit -m "$(cat <<'EOF'
feat(domain): validasi permintaan peminjaman

Mengumpulkan seluruh pelanggaran sekaligus agar petugas melihat semua
masalah dalam satu tampilan. Kuota, keterlambatan, dan tunggakan denda
mengikuti konfigurasi, bukan nilai tetap.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Skema Database dan Migrasi

**Files:**
- Create: `src/server/db/schema.ts`, `drizzle.config.ts`, `tests/integration/schema.test.ts`
- Create: satu migrasi kustom untuk ekstensi `pg_trgm` dan foreign key ke `auth.users`

**Interfaces:**
- Consumes: —
- Produces: seluruh objek tabel Drizzle — `profiles`, `academicYears`, `categories`, `racks`, `books`, `bookCopies`, `students`, `loans`, `loanItems`, `finePayments`, `librarySettings`, `counters`, `auditLogs`

- [ ] **Step 1: Jalankan Supabase lokal**

```bash
npx supabase init
npx supabase start
```

Catat nilai `DB URL` dari keluaran perintah dan simpan ke `.env.local` sebagai `DATABASE_URL`. Database lokal tidak memakai pooler, jadi URL-nya berupa `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.

- [ ] **Step 2: Buat konfigurasi Drizzle Kit**

Buat `drizzle.config.ts`:

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

- [ ] **Step 3: Tulis definisi skema**

Buat `src/server/db/schema.ts`:

```ts
import { sql } from 'drizzle-orm';
import {
  bigint, boolean, check, date, index, integer, jsonb,
  numeric, pgTable, text, timestamp, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core';

const stamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const profiles = pgTable('profiles', {
  // Foreign key ke auth.users ditambahkan migrasi kustom di Step 6;
  // Drizzle tidak memodelkan skema auth milik Supabase.
  id: uuid('id').primaryKey(),
  username: text('username').notNull().unique(),
  fullName: text('full_name').notNull(),
  role: text('role').notNull(),
  status: text('status').notNull().default('active'),
  ...stamps,
}, (t) => [
  check('profiles_role_valid', sql`${t.role} in ('admin','petugas')`),
  check('profiles_status_valid', sql`${t.status} in ('active','inactive')`),
]);

export const academicYears = pgTable('academic_years', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  isActive: boolean('is_active').notNull().default(false),
  createdAt: stamps.createdAt,
}, (t) => [
  check('academic_years_range_valid', sql`${t.endDate} > ${t.startDate}`),
  // Tepat satu tahun ajaran aktif, ditegakkan database.
  uniqueIndex('one_active_academic_year').on(t.isActive).where(sql`${t.isActive}`),
]);

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  status: text('status').notNull().default('active'),
});

export const racks = pgTable('racks', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  location: text('location'),
  status: text('status').notNull().default('active'),
});

export const books = pgTable('books', {
  id: uuid('id').primaryKey().defaultRandom(),
  isbn: text('isbn'),
  title: text('title').notNull(),
  author: text('author').notNull(),
  publisher: text('publisher'),
  publishYear: integer('publish_year'),
  categoryId: uuid('category_id').references(() => categories.id),
  rackId: uuid('rack_id').references(() => racks.id),
  /** Dasar biaya ganti saat eksemplar rusak atau hilang. */
  price: numeric('price', { precision: 12, scale: 2 }).notNull().default('0'),
  coverUrl: text('cover_url'),
  description: text('description'),
  status: text('status').notNull().default('active'),
  ...stamps,
}, (t) => [
  check('books_status_valid', sql`${t.status} in ('active','inactive')`),
]);

export const bookCopies = pgTable('book_copies', {
  id: uuid('id').primaryKey().defaultRandom(),
  bookId: uuid('book_id').notNull().references(() => books.id, { onDelete: 'restrict' }),
  barcode: text('barcode').notNull().unique(),
  status: text('status').notNull().default('TERSEDIA'),
  acquisitionDate: date('acquisition_date'),
  notes: text('notes'),
  ...stamps,
}, (t) => [
  check('book_copies_status_valid',
    sql`${t.status} in ('TERSEDIA','DIPINJAM','RUSAK','HILANG','NONAKTIF')`),
  index('book_copies_status').on(t.status),
  index('book_copies_book').on(t.bookId),
]);

export const students = pgTable('students', {
  id: uuid('id').primaryKey().defaultRandom(),
  nis: text('nis').notNull().unique(),
  name: text('name').notNull(),
  className: text('class_name').notNull(),
  major: text('major'),
  gender: text('gender'),
  phone: text('phone'),
  academicYearId: uuid('academic_year_id').references(() => academicYears.id),
  status: text('status').notNull().default('active'),
  ...stamps,
}, (t) => [
  check('students_gender_valid', sql`${t.gender} is null or ${t.gender} in ('L','P')`),
  check('students_status_valid', sql`${t.status} in ('active','inactive')`),
]);

export const loans = pgTable('loans', {
  id: uuid('id').primaryKey().defaultRandom(),
  transactionNumber: text('transaction_number').notNull().unique(),
  studentId: uuid('student_id').notNull().references(() => students.id, { onDelete: 'restrict' }),
  /** Snapshot kelas siswa saat meminjam; kelas berubah tiap tahun ajaran. */
  studentClass: text('student_class').notNull(),
  academicYearId: uuid('academic_year_id').notNull().references(() => academicYears.id),
  loanDate: date('loan_date').notNull(),
  dueDate: date('due_date').notNull(),
  status: text('status').notNull().default('AKTIF'),
  totalFine: numeric('total_fine', { precision: 12, scale: 2 }).notNull().default('0'),
  notes: text('notes'),
  createdBy: uuid('created_by').notNull().references(() => profiles.id),
  ...stamps,
}, (t) => [
  check('loans_status_valid', sql`${t.status} in ('AKTIF','SEBAGIAN_KEMBALI','SELESAI')`),
  index('loans_student').on(t.studentId),
  index('loans_open_due').on(t.dueDate).where(sql`${t.status} <> 'SELESAI'`),
]);

export const loanItems = pgTable('loan_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  loanId: uuid('loan_id').notNull().references(() => loans.id, { onDelete: 'restrict' }),
  bookCopyId: uuid('book_copy_id').notNull().references(() => bookCopies.id, { onDelete: 'restrict' }),
  returnedAt: timestamp('returned_at', { withTimezone: true }),
  returnCondition: text('return_condition'),
  daysLate: integer('days_late').notNull().default(0),
  lateFine: numeric('late_fine', { precision: 12, scale: 2 }).notNull().default('0'),
  replacementFee: numeric('replacement_fee', { precision: 12, scale: 2 }).notNull().default('0'),
  conditionNote: text('condition_note'),
  returnedBy: uuid('returned_by').references(() => profiles.id),
  createdAt: stamps.createdAt,
}, (t) => [
  check('loan_items_condition_valid',
    sql`${t.returnCondition} is null or ${t.returnCondition} in ('BAIK','RUSAK','HILANG')`),
  index('loan_items_loan').on(t.loanId),
  // Jaring pengaman tingkat database: satu eksemplar hanya boleh berada
  // dalam satu peminjaman terbuka, bahkan bila logika aplikasi cacat.
  uniqueIndex('one_open_loan_per_copy').on(t.bookCopyId).where(sql`${t.returnedAt} is null`),
]);

export const finePayments = pgTable('fine_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  loanId: uuid('loan_id').notNull().references(() => loans.id, { onDelete: 'restrict' }),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  paidAt: timestamp('paid_at', { withTimezone: true }).notNull().defaultNow(),
  receivedBy: uuid('received_by').notNull().references(() => profiles.id),
  note: text('note'),
}, (t) => [
  check('fine_payments_amount_positive', sql`${t.amount} > 0`),
  index('fine_payments_loan').on(t.loanId),
]);

export const librarySettings = pgTable('library_settings', {
  id: integer('id').primaryKey().default(1),
  maxActiveLoans: integer('max_active_loans').notNull().default(3),
  loanDurationDays: integer('loan_duration_days').notNull().default(3),
  finePerDay: numeric('fine_per_day', { precision: 12, scale: 2 }).notNull().default('1000'),
  blockWhenOverdue: boolean('block_when_overdue').notNull().default(true),
  blockWhenUnpaidFine: boolean('block_when_unpaid_fine').notNull().default(false),
  schoolName: text('school_name'),
  schoolLogoUrl: text('school_logo_url'),
  receiptFooter: text('receipt_footer'),
  updatedBy: uuid('updated_by').references(() => profiles.id),
  updatedAt: stamps.updatedAt,
}, (t) => [
  check('library_settings_single_row', sql`${t.id} = 1`),
]);

export const counters = pgTable('counters', {
  scope: text('scope').primaryKey(),
  value: bigint('value', { mode: 'number' }).notNull().default(0),
});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => profiles.id),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: uuid('entity_id'),
  metadata: jsonb('metadata'),
  createdAt: stamps.createdAt,
}, (t) => [
  index('audit_logs_entity').on(t.entity, t.entityId),
]);
```

- [ ] **Step 4: Hasilkan dan terapkan migrasi**

```bash
npm run db:generate
npm run db:migrate
```
Harapan: berkas SQL muncul di `drizzle/`, dan migrasi diterapkan tanpa galat.

- [ ] **Step 5: Tulis uji batasan database yang gagal**

Buat `tests/integration/schema.test.ts`:

```ts
import 'dotenv/config';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

afterAll(async () => { await sql.end(); });

beforeEach(async () => {
  await sql`truncate loan_items, loans, book_copies, books, students, academic_years restart identity cascade`;
});

describe('batasan academic_years', () => {
  it('menolak dua tahun ajaran aktif sekaligus', async () => {
    await sql`insert into academic_years (name, start_date, end_date, is_active)
              values ('2026/2027', '2026-07-01', '2027-06-30', true)`;

    await expect(
      sql`insert into academic_years (name, start_date, end_date, is_active)
          values ('2027/2028', '2027-07-01', '2028-06-30', true)`,
    ).rejects.toThrow(/one_active_academic_year/);
  });

  it('mengizinkan banyak tahun ajaran tidak aktif', async () => {
    await sql`insert into academic_years (name, start_date, end_date, is_active)
              values ('2025/2026', '2025-07-01', '2026-06-30', false),
                     ('2026/2027', '2026-07-01', '2027-06-30', false)`;
    const rows = await sql`select count(*)::int as n from academic_years`;
    expect(rows[0].n).toBe(2);
  });

  it('menolak tanggal selesai sebelum tanggal mulai', async () => {
    await expect(
      sql`insert into academic_years (name, start_date, end_date)
          values ('salah', '2027-06-30', '2026-07-01')`,
    ).rejects.toThrow(/academic_years_range_valid/);
  });
});

describe('batasan book_copies', () => {
  it('menolak status di luar daftar yang sah', async () => {
    const [book] = await sql`insert into books (title, author) values ('Uji', 'Penulis') returning id`;
    await expect(
      sql`insert into book_copies (book_id, barcode, status)
          values (${book.id}, 'BK-000001', 'ENTAH')`,
    ).rejects.toThrow(/book_copies_status_valid/);
  });

  it('menolak barcode ganda', async () => {
    const [book] = await sql`insert into books (title, author) values ('Uji', 'Penulis') returning id`;
    await sql`insert into book_copies (book_id, barcode) values (${book.id}, 'BK-000001')`;
    await expect(
      sql`insert into book_copies (book_id, barcode) values (${book.id}, 'BK-000001')`,
    ).rejects.toThrow(/book_copies_barcode/);
  });
});
```

- [ ] **Step 6: Tambahkan migrasi kustom untuk pg_trgm dan foreign key auth**

```bash
npx drizzle-kit generate --custom --name=trgm_and_auth_fk
```

Isi berkas SQL yang dihasilkan di `drizzle/` dengan:

```sql
create extension if not exists pg_trgm;

create index books_title_trgm on books using gin (title gin_trgm_ops);
create index students_name_trgm on students using gin (name gin_trgm_ops);

alter table profiles
  add constraint profiles_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;
```

Terapkan: `npm run db:migrate`

- [ ] **Step 7: Jalankan uji integrasi**

```bash
npm install -D dotenv
npx vitest run tests/integration/schema.test.ts
```
Harapan: LULUS, 5 uji.

- [ ] **Step 8: Commit**

```bash
git add src/server/db/schema.ts drizzle.config.ts drizzle/ tests/ supabase/config.toml
git commit -m "$(cat <<'EOF'
feat(db): skema database dan migrasi

Batasan integritas ditegakkan database, bukan hanya aplikasi: tepat satu
tahun ajaran aktif, dan satu eksemplar hanya boleh berada dalam satu
peminjaman terbuka.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Klien Database dan Data Awal

**Files:**
- Create: `src/server/db/client.ts`, `src/server/db/seed.ts`

**Interfaces:**
- Consumes: seluruh tabel dari `src/server/db/schema.ts`
- Produces: `db` — instance Drizzle bertipe, digunakan seluruh Server Action

- [ ] **Step 1: Buat klien database**

Buat `src/server/db/client.ts`:

```ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL belum diatur. Salin .env.example menjadi .env.local.');
}

/**
 * `prepare: false` WAJIB. Produksi terhubung melalui Supavisor dalam mode
 * transaksi, yang tidak mendukung prepared statement. Tanpa flag ini,
 * kueri gagal di produksi walau lolos di lokal.
 */
const client = postgres(url, { prepare: false });

export const db = drizzle(client, { schema });
export { schema };
```

- [ ] **Step 2: Tulis skrip data awal**

Buat `src/server/db/seed.ts`:

```ts
import 'dotenv/config';
import { db, schema } from './client';

async function seed() {
  console.log('Mengisi data awal…');

  await db.insert(schema.librarySettings).values({
    id: 1,
    schoolName: 'SMK Negeri 1 Contoh',
    receiptFooter: 'Terima kasih. Simpan struk ini sebagai bukti peminjaman.',
  }).onConflictDoNothing();

  const [year] = await db.insert(schema.academicYears).values({
    name: '2026/2027',
    startDate: '2026-07-01',
    endDate: '2027-06-30',
    isActive: true,
  }).onConflictDoNothing().returning();

  const categories = await db.insert(schema.categories).values([
    { name: 'Teknologi Informasi' },
    { name: 'Matematika' },
    { name: 'Bahasa dan Sastra' },
  ]).onConflictDoNothing().returning();

  const racks = await db.insert(schema.racks).values([
    { code: 'A-1', name: 'Rak A Baris 1', location: 'Ruang Utama' },
    { code: 'A-3', name: 'Rak A Baris 3', location: 'Ruang Utama' },
  ]).onConflictDoNothing().returning();

  const books = await db.insert(schema.books).values([
    { title: 'Pemrograman Web', author: 'Budi Raharjo', publisher: 'Informatika',
      publishYear: 2024, price: '85000', categoryId: categories[0]?.id, rackId: racks[1]?.id },
    { title: 'Basis Data Lanjut', author: 'Siti Nurhaliza', publisher: 'Andi',
      publishYear: 2023, price: '92000', categoryId: categories[0]?.id, rackId: racks[0]?.id },
  ]).onConflictDoNothing().returning();

  // Tiga eksemplar per judul, cukup untuk menguji aturan kuota tiga buku.
  let sequence = 1;
  const copies = books.flatMap((book) =>
    Array.from({ length: 3 }, () => ({
      bookId: book.id,
      barcode: `BK-${String(sequence++).padStart(6, '0')}`,
      acquisitionDate: '2026-07-15',
    })),
  );
  await db.insert(schema.bookCopies).values(copies).onConflictDoNothing();

  await db.insert(schema.students).values([
    { nis: '202600123', name: 'Ahmad Fauzi', className: 'XI RPL 1', major: 'RPL',
      gender: 'L', academicYearId: year?.id },
    { nis: '202600456', name: 'Siti Aminah', className: 'XI RPL 1', major: 'RPL',
      gender: 'P', academicYearId: year?.id },
  ]).onConflictDoNothing();

  console.log(`Selesai: ${books.length} judul, ${copies.length} eksemplar, 2 siswa.`);
  process.exit(0);
}

seed().catch((error) => {
  console.error('Pengisian data awal gagal:', error);
  process.exit(1);
});
```

- [ ] **Step 3: Jalankan data awal**

```bash
npm run db:seed
```
Harapan: "Selesai: 2 judul, 6 eksemplar, 2 siswa."

- [ ] **Step 4: Verifikasi data masuk**

```bash
npx supabase db psql -c "select barcode, status from book_copies order by barcode;"
```
Harapan: 6 baris, seluruhnya berstatus `TERSEDIA`.

- [ ] **Step 5: Commit**

```bash
git add src/server/db/client.ts src/server/db/seed.ts package.json package-lock.json
git commit -m "$(cat <<'EOF'
feat(db): klien database dan skrip data awal

Klien dikonfigurasi prepare:false karena produksi melewati Supavisor
dalam mode transaksi.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Token Desain dan Kerangka Aplikasi

**Files:**
- Modify: `src/app/globals.css`, `src/app/layout.tsx`
- Create: `src/app/(app)/layout.tsx`, `src/components/ui/status-badge.tsx`, `src/components/layout/sidebar.tsx`, `src/components/layout/topbar.tsx`

**Interfaces:**
- Consumes: —
- Produces: `<StatusBadge status={...} />`, `<Sidebar />`, `<Topbar academicYear={...} userName={...} />`, variabel CSS `--color-*`

- [ ] **Step 1: Definisikan token desain**

Ganti isi `src/app/globals.css`:

```css
@import "tailwindcss";

@theme {
  /* Navy dan slate — tenang, institusional */
  --color-ink-900: oklch(0.21 0.04 258);
  --color-ink-700: oklch(0.34 0.04 258);
  --color-ink-500: oklch(0.52 0.03 258);
  --color-ink-300: oklch(0.72 0.02 258);
  --color-ink-100: oklch(0.93 0.01 258);
  --color-ink-50:  oklch(0.97 0.005 258);

  /* Teal — aksi utama */
  --color-accent-600: oklch(0.55 0.11 185);
  --color-accent-500: oklch(0.63 0.12 185);
  --color-accent-100: oklch(0.94 0.03 185);

  /* Warna status, konsisten di seluruh aplikasi */
  --color-status-tersedia: oklch(0.58 0.14 152);
  --color-status-dipinjam: oklch(0.55 0.13 250);
  --color-status-terlambat: oklch(0.58 0.19 25);
  --color-status-rusak: oklch(0.65 0.15 62);
  --color-status-hilang: oklch(0.44 0.02 258);

  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-serif: "Source Serif 4", ui-serif, Georgia, serif;
}

body {
  background: var(--color-ink-50);
  color: var(--color-ink-900);
  font-family: var(--font-sans);
}

/* Angka tabular pada tabel dan nominal. Kolom tanggal dan denda yang tidak
   sejajar secara vertikal jauh lebih lambat dipindai mata. */
table, .tabular {
  font-variant-numeric: tabular-nums;
}

h1, h2, .page-title {
  font-family: var(--font-serif);
}

/* Cincin fokus terlihat di seluruh elemen interaktif — alur transaksi
   harus dapat diselesaikan tanpa tetikus. */
:focus-visible {
  outline: 2px solid var(--color-accent-600);
  outline-offset: 2px;
}
```

- [ ] **Step 2: Muat font pada layout akar**

Ubah `src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import { Inter, Source_Serif_4 } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const serif = Source_Serif_4({ subsets: ['latin'], variable: '--font-source-serif' });

export const metadata: Metadata = {
  title: 'Perpustakaan Sekolah',
  description: 'Sistem peminjaman dan pengembalian buku perpustakaan',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${inter.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Tulis uji badge status yang gagal**

Buat `src/components/ui/status-badge.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { statusLabel, statusIcon } from './status-badge';

describe('statusLabel', () => {
  it('menerjemahkan status eksemplar ke bahasa Indonesia yang terbaca', () => {
    expect(statusLabel('TERSEDIA')).toBe('Tersedia');
    expect(statusLabel('DIPINJAM')).toBe('Dipinjam');
    expect(statusLabel('NONAKTIF')).toBe('Nonaktif');
  });
});

describe('statusIcon', () => {
  it('memberi ikon berbeda untuk tiap status', () => {
    const icons = (['TERSEDIA', 'DIPINJAM', 'RUSAK', 'HILANG', 'NONAKTIF'] as const)
      .map(statusIcon);
    expect(new Set(icons).size).toBe(5);
  });
});
```

Uji kedua menjaga janji aksesibilitas: status tidak boleh dibedakan hanya lewat warna, jadi tiap status wajib punya ikon yang berbeda.

- [ ] **Step 4: Jalankan uji untuk memastikan gagal**

Jalankan: `npx vitest run src/components/ui/status-badge.test.ts`
Harapan: GAGAL dengan "Failed to resolve import './status-badge'".

- [ ] **Step 5: Implementasikan badge status**

Buat `src/components/ui/status-badge.tsx`:

```tsx
import type { CopyStatus } from '@/domain/shared/types';

const LABELS: Record<CopyStatus, string> = {
  TERSEDIA: 'Tersedia',
  DIPINJAM: 'Dipinjam',
  RUSAK: 'Rusak',
  HILANG: 'Hilang',
  NONAKTIF: 'Nonaktif',
};

const ICONS: Record<CopyStatus, string> = {
  TERSEDIA: '●',
  DIPINJAM: '◐',
  RUSAK: '▲',
  HILANG: '✕',
  NONAKTIF: '—',
};

const COLORS: Record<CopyStatus, string> = {
  TERSEDIA: 'text-[var(--color-status-tersedia)] bg-[var(--color-status-tersedia)]/10',
  DIPINJAM: 'text-[var(--color-status-dipinjam)] bg-[var(--color-status-dipinjam)]/10',
  RUSAK: 'text-[var(--color-status-rusak)] bg-[var(--color-status-rusak)]/10',
  HILANG: 'text-[var(--color-status-hilang)] bg-[var(--color-status-hilang)]/10',
  NONAKTIF: 'text-[var(--color-ink-500)] bg-[var(--color-ink-100)]',
};

export function statusLabel(status: CopyStatus): string {
  return LABELS[status];
}

export function statusIcon(status: CopyStatus): string {
  return ICONS[status];
}

export function StatusBadge({ status }: { status: CopyStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-medium ${COLORS[status]}`}
    >
      <span aria-hidden="true">{ICONS[status]}</span>
      {LABELS[status]}
    </span>
  );
}
```

- [ ] **Step 6: Jalankan uji untuk memastikan lulus**

Jalankan: `npx vitest run src/components/ui/status-badge.test.ts`
Harapan: LULUS, 2 uji.

- [ ] **Step 7: Buat sidebar**

Buat `src/components/layout/sidebar.tsx`:

```tsx
import Link from 'next/link';

const NAV = [
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
    group: 'Pengaturan',
    items: [
      { href: '/pengaturan/tahun-ajaran', label: 'Tahun Ajaran' },
      { href: '/pengaturan/pengguna', label: 'Pengguna' },
      { href: '/pengaturan/konfigurasi', label: 'Konfigurasi' },
    ],
  },
];

export function Sidebar() {
  return (
    <nav className="w-60 shrink-0 border-r border-[var(--color-ink-100)] bg-white px-3 py-5">
      <div className="px-3 pb-6 font-serif text-lg font-semibold">Perpustakaan</div>
      {NAV.map((section) => (
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

- [ ] **Step 8: Buat top bar**

Buat `src/components/layout/topbar.tsx`:

```tsx
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
      <span className="text-sm text-[var(--color-ink-700)]">{userName}</span>
    </header>
  );
}
```

- [ ] **Step 9: Rangkai kerangka aplikasi**

Buat `src/app/(app)/layout.tsx`:

```tsx
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // Nilai sementara; Task 9 menggantinya dengan sesi dan tahun ajaran sungguhan.
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar academicYear="2026/2027" userName="Petugas" />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 10: Buat halaman dashboard sementara dan lihat hasilnya**

Buat `src/app/(app)/dashboard/page.tsx`:

```tsx
export default function DashboardPage() {
  return <h1 className="page-title text-2xl font-semibold">Dashboard</h1>;
}
```

Jalankan `npm run dev` dan buka `http://localhost:3000/dashboard`.
Harapan: sidebar dengan empat kelompok menu, top bar menampilkan tahun ajaran, judul berhuruf serif, latar abu sangat muda. Tekan Tab berulang kali — setiap tautan harus menampilkan cincin fokus teal.

- [ ] **Step 11: Commit**

```bash
git add src/app src/components
git commit -m "$(cat <<'EOF'
feat(ui): token desain dan kerangka aplikasi

Palet navy/slate beraksen teal sebagai variabel CSS agar dapat diarahkan
ke warna sekolah tanpa menyentuh komponen. Badge status memakai ikon,
tidak mengandalkan warna saja.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Autentikasi

**Files:**
- Create: `src/server/auth/username.ts`, `src/server/auth/username.test.ts`, `src/server/auth/session.ts`, `src/server/auth/guard.ts`, `src/server/actions/auth.ts`, `src/app/(auth)/login/page.tsx`, `src/middleware.ts`
- Modify: `src/app/(app)/layout.tsx`

**Interfaces:**
- Consumes: `db` dan `schema` dari `src/server/db/client.ts`
- Produces:
  - `usernameToEmail(username: string): string`
  - `getCurrentProfile(): Promise<Profile | null>`
  - `requireRole(roles: UserRole[]): Promise<Profile>`
  - `signIn(formData: FormData): Promise<{ error: string } | void>`
  - `signOut(): Promise<void>`

- [ ] **Step 1: Tulis uji pemetaan username yang gagal**

Buat `src/server/auth/username.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { usernameToEmail } from './username';

describe('usernameToEmail', () => {
  it('menambahkan domain internal pada username', () => {
    expect(usernameToEmail('budi')).toBe('budi@perpus.local');
  });

  it('menormalkan huruf besar', () => {
    expect(usernameToEmail('Budi')).toBe('budi@perpus.local');
  });

  it('membuang spasi di ujung', () => {
    expect(usernameToEmail('  budi  ')).toBe('budi@perpus.local');
  });

  it('menolak username kosong', () => {
    expect(() => usernameToEmail('   ')).toThrow('Username wajib diisi');
  });

  it('menolak karakter di luar huruf, angka, titik, dan garis bawah', () => {
    expect(() => usernameToEmail('budi santoso')).toThrow('Username hanya boleh');
    expect(() => usernameToEmail('budi@sekolah.id')).toThrow('Username hanya boleh');
  });
});
```

- [ ] **Step 2: Jalankan uji untuk memastikan gagal**

Jalankan: `npx vitest run src/server/auth/username.test.ts`
Harapan: GAGAL dengan "Failed to resolve import './username'".

- [ ] **Step 3: Implementasikan pemetaan username**

Buat `src/server/auth/username.ts`:

```ts
const VALID_USERNAME = /^[a-z0-9._]+$/;

/**
 * Supabase Auth bekerja dengan surel, sementara petugas memakai username.
 * Pemetaan ini tidak pernah terlihat pengguna, dan domainnya sengaja
 * tidak dapat dirutekan agar tidak pernah menerima surel sungguhan.
 */
export function usernameToEmail(username: string): string {
  const normalized = username.trim().toLowerCase();

  if (normalized.length === 0) {
    throw new Error('Username wajib diisi.');
  }
  if (!VALID_USERNAME.test(normalized)) {
    throw new Error('Username hanya boleh berisi huruf, angka, titik, dan garis bawah.');
  }

  const domain = process.env.INTERNAL_EMAIL_DOMAIN ?? 'perpus.local';
  return `${normalized}@${domain}`;
}
```

- [ ] **Step 4: Jalankan uji untuk memastikan lulus**

Jalankan: `npx vitest run src/server/auth/username.test.ts`
Harapan: LULUS, 5 uji.

- [ ] **Step 5: Buat pembacaan sesi**

Buat `src/server/auth/session.ts`:

```ts
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/server/db/client';

export function createSupabaseServerClient() {
  const store = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            // Dipanggil dari Server Component; middleware yang menyegarkan sesi.
          }
        },
      },
    },
  );
}

export type Profile = typeof schema.profiles.$inferSelect;

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  const [profile] = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.id, data.user.id))
    .limit(1);

  // Akun yang dinonaktifkan tidak boleh lolos hanya karena sesinya masih hidup.
  if (!profile || profile.status !== 'active') return null;
  return profile;
}
```

Buat juga `src/middleware.ts`. Tanpa berkas ini token sesi tidak pernah disegarkan, dan petugas akan terlempar ke layar masuk di tengah jam kerja ketika token kedaluwarsa:

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Memanggil getUser() menyegarkan token yang hampir kedaluwarsa
  // dan menuliskan cookie barunya ke response.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|woff2)$).*)'],
};
```

- [ ] **Step 6: Buat penjaga peran**

Buat `src/server/auth/guard.ts`:

```ts
import { redirect } from 'next/navigation';
import type { UserRole } from '@/domain/shared/types';
import { getCurrentProfile, type Profile } from './session';

export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  return profile;
}

/**
 * Dipanggil di awal setiap Server Action yang mengubah data.
 * Otorisasi ditegakkan di server, bukan dengan menyembunyikan tombol.
 */
export async function requireRole(roles: UserRole[]): Promise<Profile> {
  const profile = await requireProfile();
  if (!roles.includes(profile.role as UserRole)) {
    throw new Error(
      `Akses ditolak. Aksi ini hanya untuk peran: ${roles.join(', ')}. ` +
      `Akun Anda berperan ${profile.role}.`,
    );
  }
  return profile;
}
```

- [ ] **Step 7: Buat aksi masuk dan keluar**

Buat `src/server/actions/auth.ts`:

```ts
'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/server/auth/session';
import { usernameToEmail } from '@/server/auth/username';

export async function signIn(_prev: unknown, formData: FormData) {
  const username = String(formData.get('username') ?? '');
  const password = String(formData.get('password') ?? '');

  let email: string;
  try {
    email = usernameToEmail(username);
  } catch (error) {
    return { error: (error as Error).message };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Pesan sengaja tidak membedakan username salah dari kata sandi salah,
    // agar tidak membocorkan username mana yang terdaftar.
    return { error: 'Username atau kata sandi salah.' };
  }

  redirect('/dashboard');
}

export async function signOut() {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}
```

- [ ] **Step 8: Buat layar masuk**

Buat `src/app/(auth)/login/page.tsx`:

```tsx
'use client';

import { useActionState } from 'react';
import { signIn } from '@/server/actions/auth';

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, null);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-ink-50)] p-4">
      <form action={action} className="w-full max-w-sm rounded-xl bg-white p-8 shadow-sm">
        <h1 className="page-title mb-1 text-xl font-semibold">Perpustakaan Sekolah</h1>
        <p className="mb-6 text-sm text-[var(--color-ink-500)]">
          Masuk untuk mengelola peminjaman buku.
        </p>

        <label htmlFor="username" className="mb-1 block text-sm font-medium">Username</label>
        <input
          id="username" name="username" required autoFocus autoComplete="username"
          className="mb-4 w-full rounded-md border border-[var(--color-ink-300)] px-3 py-2"
        />

        <label htmlFor="password" className="mb-1 block text-sm font-medium">Kata Sandi</label>
        <input
          id="password" name="password" type="password" required autoComplete="current-password"
          className="mb-4 w-full rounded-md border border-[var(--color-ink-300)] px-3 py-2"
        />

        {state?.error && (
          <p role="alert" className="mb-4 rounded-md bg-[var(--color-status-terlambat)]/10 px-3 py-2 text-sm text-[var(--color-status-terlambat)]">
            {state.error}
          </p>
        )}

        <button
          type="submit" disabled={pending}
          className="w-full rounded-md bg-[var(--color-accent-600)] py-2 font-medium text-white disabled:opacity-60"
        >
          {pending ? 'Memproses…' : 'Masuk'}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 9: Sambungkan kerangka aplikasi ke sesi sungguhan**

Ganti isi `src/app/(app)/layout.tsx`:

```tsx
import { eq } from 'drizzle-orm';
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
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar academicYear={year?.name ?? null} userName={profile.fullName} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 10: Tambahkan pengguna awal ke data seed**

Tambahkan `import { createClient } from '@supabase/supabase-js';` ke deretan impor di awal `src/server/db/seed.ts`, lalu tambahkan fungsi berikut dan panggil `await seedUsers();` tepat sebelum `console.log` terakhir di dalam `seed()`:

```ts
async function seedUsers() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const accounts = [
    { username: 'admin', fullName: 'Administrator', role: 'admin' as const },
    { username: 'petugas', fullName: 'Petugas Perpustakaan', role: 'petugas' as const },
  ];

  for (const account of accounts) {
    const { data, error } = await admin.auth.admin.createUser({
      email: `${account.username}@${process.env.INTERNAL_EMAIL_DOMAIN ?? 'perpus.local'}`,
      password: 'perpus123',
      email_confirm: true,
    });
    if (error) {
      console.log(`  ${account.username}: ${error.message} — dilewati`);
      continue;
    }
    await db.insert(schema.profiles).values({
      id: data.user.id,
      username: account.username,
      fullName: account.fullName,
      role: account.role,
    }).onConflictDoNothing();
    console.log(`  Akun dibuat: ${account.username} / perpus123`);
  }
}
```

Kata sandi `perpus123` hanya untuk pengembangan lokal. Catat di README bahwa akun ini **wajib dihapus atau diganti kata sandinya sebelum produksi**.

- [ ] **Step 11: Jalankan ulang data seed dan uji masuk secara manual**

```bash
npm run db:seed
npm run dev
```

Buka `http://localhost:3000/login` dan uji empat hal:
1. Masuk dengan `petugas` / `perpus123` → diarahkan ke `/dashboard`, top bar menampilkan "Petugas Perpustakaan" dan "Tahun Ajaran 2026/2027".
2. Masuk dengan kata sandi salah → muncul "Username atau kata sandi salah."
3. Masuk dengan username `budi santoso` → muncul "Username hanya boleh berisi huruf, angka, titik, dan garis bawah."
4. Buka `/dashboard` dalam jendela penyamaran → diarahkan ke `/login`.

- [ ] **Step 12: Jalankan seluruh uji, lint, dan build**

```bash
npm test
npm run lint
npm run build
```
Harapan: seluruhnya lulus.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(auth): masuk dengan username dan penjaga peran

Username dipetakan ke surel internal karena Supabase Auth bekerja dengan
surel. Pesan galat tidak membedakan username salah dari kata sandi salah
agar tidak membocorkan username yang terdaftar.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Hasil Akhir Rencana 01

Setelah sembilan task ini selesai:

- Seluruh aturan bisnis perpustakaan teruji — 59 uji unit yang berjalan tanpa database sama sekali, ditambah 5 uji integrasi batasan database.
- Skema database lengkap dan diterapkan, dengan batasan integritas terbukti menolak data yang salah.
- Batas arsitektur ditegakkan mesin: lint gagal bila lapisan domain menyentuh I/O.
- Login berfungsi, dengan penjaga peran siap dipakai Server Action berikutnya.
- Kerangka UI dan token desain siap diisi layar.

Yang **belum** ada dan menjadi isi Rencana 02 dan 03: seluruh layar CRUD, alur peminjaman dan pengembalian yang menyentuh database, dashboard, riwayat, dan cetak.

## Verifikasi Sebelum Melanjutkan ke Rencana 02

```bash
npm test          # seluruh uji lulus
npm run lint      # bersih
npm run build     # sukses
```

Dan secara manual: masuk sebagai `petugas`, pastikan `/dashboard` terbuka dan top bar menampilkan tahun ajaran aktif.
