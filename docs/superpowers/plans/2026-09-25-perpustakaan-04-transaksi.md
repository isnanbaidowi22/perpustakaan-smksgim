# Perpustakaan — Rencana 04: Transaksi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Petugas dapat mencatat peminjaman di satu layar papan-ketik, memproses pengembalian (termasuk sebagian, terlambat, rusak, hilang), menandai denda lunas, dan menelusuri riwayat transaksi. Status setiap eksemplar selalu mengikuti keadaan fisiknya, bahkan saat dua petugas bekerja bersamaan.

**Architecture:** Pola lima lapis Rencana 02/03 tetap berlaku. Aturan bisnis sudah ada di `src/domain/` (Rencana 01); rencana ini menambah aturan `BOOK_INACTIVE`, format nomor transaksi, dan dua service bertransaksi: `createLoan()` (spec 6.1) dan `processReturn()` (spec 6.2). Keduanya mengunci baris dalam urutan tetap (siswa/pinjaman lebih dulu, lalu eksemplar menurut `id`) sehingga bebas deadlock. Layar peminjaman dan pengembalian adalah komponen klien yang logikanya dipisah ke modul murni (reducer dan pratinjau denda) agar dapat diuji tanpa DOM; Server Action baca mengembalikan `LookupResult` alih-alih melempar galat.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS 4 · Drizzle ORM 0.45 · Supabase Postgres · zod 4 · Vitest 5

**Spec:** `docs/superpowers/specs/2026-09-21-sistem-peminjaman-perpustakaan-design.md` — terutama §4.2, §4.3, §5, §6, §8.2, §8.3, §9, §10
**Rencana sebelumnya:** `docs/superpowers/plans/2026-09-25-perpustakaan-03-pengaturan.md` (selesai, `master` di `81a1401`)

| Rencana | Isi |
|---|---|
| 01–03 | Fondasi domain, Master Data, Pengaturan (selesai) |
| 04 (ini) | Transaksi: Peminjaman, Pengembalian, Pelunasan Denda, Riwayat |
| 05 | Dashboard, Cetak struk dan label barcode, Tampilan audit log |
| 06 | Laporan |

**Keputusan pemilik produk untuk rencana ini (25 September 2026):**
- **Uji konkurensi tanpa commit.** Spec §10 mewajibkan bukti bahwa dua peminjaman bersamaan atas eksemplar yang sama tidak sama-sama lolos. Database cloud tidak boleh menerima data uji yang di-commit, jadi buktinya dipecah: (1) dua koneksi sungguhan, peminjaman kedua **tertahan** pada kunci eksemplar selama yang pertama belum selesai, lalu melanjutkan dengan status terbaru setelah kunci dilepas; (2) peminjaman eksemplar yang sudah `DIPINJAM` ditolak `COPY_UNAVAILABLE`. Kedua transaksi selalu di-rollback (Task 3).
- **Zona waktu sekolah WIB (`Asia/Jakarta`).** Tanggal pinjam, jatuh tempo, dan hari telat dihitung menurut tanggal WIB, walau server Vercel berjalan dalam UTC (Task 1).

**Kewajiban bawaan dari Rencana 02** yang diselesaikan di sini: `createLoan` menolak eksemplar milik buku nonaktif (`BOOK_INACTIVE`, spec §5.2) — Task 1 dan Task 3.

## Global Constraints

- **Versi terpasang:** `next@16.3.5`, `react@19.2.8`, `drizzle-orm@0.45.3`, `vitest@5.0.1`, `zod@4.6.5`. Node.js 24. **Tidak ada dependensi baru** (tidak ada testing-library/jsdom; logika komponen klien diuji lewat modul murni).
- **Lingkungan Windows:** Node berada di `D:\nvm\nodejs` dan **tidak** ada di PATH shell agen. Awali setiap perintah `npm`/`npx` dengan `export PATH="/d/nvm/nodejs:$PATH";` (Git Bash) atau `$env:Path = "D:\nvm\nodejs;" + $env:Path;` (PowerShell).
- **TypeScript mode `strict`.** `any` dilarang.
- **Tanggal kalender adalah untai `'YYYY-MM-DD'` (`IsoDate`).** "Hari ini" selalu `schoolToday()` (Task 1) yang dipanggil di lapisan Server Action atau halaman; service menerima `today: IsoDate` sebagai parameter dan tidak pernah memanggil `new Date()` untuk tanggal kalender. `src/domain/**` tetap murni (aturan ESLint).
- **Nominal rupiah** disimpan di kolom `numeric(12,2)`: ditulis sebagai `String(bilanganBulat)`, dibaca dengan `Number(...)`.
- **Nilai status persis:** eksemplar `TERSEDIA` `DIPINJAM` `RUSAK` `HILANG` `NONAKTIF`; peminjaman `AKTIF` `SEBAGIAN_KEMBALI` `SELESAI`; kondisi kembali `BAIK` `RUSAK` `HILANG`. `TERLAMBAT` **bukan** status tersimpan — dihitung saat dibaca (spec §4.2).
- **Status `book_copies` hanya berubah di `src/server/services/`, di dalam transaksi, dengan baris eksemplar terkunci** (spec §3.1). Setiap perubahan status transaksi atau eksemplar menulis satu baris `audit_logs` di transaksi yang sama: `loan.create`, `return.process`, `fine.pay`.
- **Urutan kunci (bebas deadlock):** `createLoan` mengunci baris siswa, lalu eksemplar yang diminta menurut `book_copies.id` naik. `processReturn` mengunci baris pinjaman, lalu item terbuka dan eksemplarnya menurut `book_copies.id` naik. `payFine` hanya mengunci baris pinjaman.
- **Otorisasi (spec §7):** peminjaman, pengembalian, riwayat, dan tandai denda lunas → `admin` dan `petugas`. Setiap halaman memanggil `requireProfile()` sendiri; setiap Server Action memanggil `authorize(['admin', 'petugas'])` (langsung atau lewat `runFormAction`/`runCommand`) sebelum membaca isian.
- **Pesan galat (spec §9):** menyebut entitas yang terlibat dan tindakan yang harus diambil. Pelanggaran aturan peminjaman dikembalikan sebagai objek `Violation`, dan kalimatnya disusun `describeViolation()` (Task 1). "Transaksi gagal" tidak diterima di mana pun.
- **Seluruh teks antarmuka berbahasa Indonesia.** Nama variabel, fungsi, dan tabel berbahasa Inggris.
- **DATABASE_URL menunjuk ke database pengembangan di Supabase cloud berisi data sungguhan.** Uji integrasi hanya berjalan di dalam `withRollback()`; dilarang `truncate`, `delete` tanpa `where`, atau commit. Uji transaksi memakai `circulationFixture(tx)` (Task 2), yang membuat tahun ajaran aktif, konfigurasi, buku, eksemplar, dan siswanya sendiri di dalam transaksi uji, dan memakai hari uji `TODAY = '2090-03-02'` agar penghitung nomor transaksi harian tidak pernah bertabrakan dengan data sungguhan. Nilai unik buatan uji berawalan `UJI-`.
- **Berkas `'use server'` hanya mengekspor fungsi async.** Tipe bersama untuk hasil Server Action berada di `src/lib/circulation-results.ts`.
- **Desktop dan tablet (PRD bab 9):** tabel daftar dibungkus `<ScrollTable>`; tata letak dua kolom hanya dari breakpoint `lg`.
- **Papan ketik (spec §8.1–8.2):** seluruh alur peminjaman dan pengembalian dapat diselesaikan tanpa tetikus. `Enter` di kolom scan menjalankan pencarian/penambahan; `Ctrl+Enter` menyimpan peminjaman.
- **Repo ini memasang hook tdd-guard.** Urutan langkah (uji gagal → implementasi → uji lulus) wajib diikuti.
- **Setiap commit diakhiri baris:** `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## Review Focus

Lima kondisi yang paling mungkin menggigit petugas, masing-masing sudah diberi uji di task pemiliknya:

1. **Petugas memindai eksemplar yang tidak boleh masuk daftar** — sudah ada di daftar, sedang dipinjam siswa lain, rusak/hilang, milik buku nonaktif, atau melebihi sisa kuota. Meja peminjaman harus langsung menolak dengan alasannya, sebelum tombol simpan ditekan (spec §8.2 "mencegah lebih baik"). (Task 7: uji `deskReducer`.)
2. **Transaksi antara pukul 00.00–07.00 WIB di server UTC.** Tanpa zona waktu sekolah, tanggal pinjam dan hitungan hari telat mundur satu hari. (Task 1: uji `schoolToday`.)
3. **Siswa yang seluruh bukunya sudah kembali tetapi dendanya belum lunas.** Pinjaman itu tidak boleh dihitung sebagai terlambat atau memakan kuota, tetapi tunggakannya tetap terhitung. (Task 1: uji `validateLoanRequest`; Task 2: uji `loadBorrowerLoans`.)
4. **Membayar sisa denda terakhir, atau membayar lebih dari sisa.** Setelah lunas, form pelunasan hilang dari halaman, jadi pesan sukses harus tetap terlihat; nominal di atas sisa dan pembayaran untuk pinjaman lunas harus ditolak dengan sisa tagihan disebut. (Task 5: uji `payFine` dan `payFineAction`.)
5. **Buku rusak/hilang yang harga katalognya Rp0.** Biaya ganti diam-diam menjadi nol. Pratinjau pengembalian harus memperingatkan dan membiarkan petugas mengisi biaya ganti (spec §12). (Task 8: uji `previewReturn`.)

---

## Struktur Berkas

| Berkas | Tanggung jawab |
|---|---|
| `src/domain/shared/types.ts`, `violations.ts`, `src/domain/loan/rules.ts` | + `BOOK_INACTIVE`; pinjaman tanpa eksemplar terbuka tidak dihitung terlambat |
| `src/domain/loan/transaction-number.ts` | Format `PJM-YYYYMMDD-NNNN` dan cakupan penghitung harian |
| `src/lib/school-date.ts` | `schoolToday()` dan `formatSchoolDateTime()` dalam WIB |
| `src/lib/violation-message.ts` | Kalimat operasional untuk setiap `Violation` (spec §9) |
| `src/lib/circulation-results.ts` | Tipe `LookupResult<T>` dan `CreateLoanState` untuk Server Action |
| `src/lib/circulation-labels.ts` | Label kondisi kembali dan filter status riwayat |
| `src/server/queries/loan-aggregates.ts` | Subquery jumlah item terbuka dan total pembayaran per pinjaman |
| `src/server/queries/circulation.ts` | Cari siswa, kartu peminjam, cari eksemplar per barcode, pinjaman aktif siswa |
| `src/server/queries/loans.ts` | Detail pinjaman, kandidat pengembalian, daftar riwayat |
| `src/server/validation/{loan,return,fine}.ts` | Skema masukan peminjaman, pengembalian, pembayaran denda |
| `src/server/services/{loans,returns,fines}.ts` | `createLoan`, `processReturn`, `payFine` |
| `src/server/actions/{loans,returns,fines}.ts` | Server Action ketiganya |
| `src/server/db/errors.ts` | + `sqlState()` |
| `src/components/ui/loan-status-badge.tsx` | Badge status pinjaman termasuk Terlambat |
| `src/components/ui/filter-bar.tsx` | + `autoFocus` untuk kolom pencarian universal |
| `src/app/(app)/transaksi/peminjaman/**` | Meja peminjaman (`desk-state.ts` murni + `loan-desk.tsx`) |
| `src/app/(app)/transaksi/pengembalian/**` | Layar pengembalian (`return-preview.ts` murni + `return-form.tsx`) |
| `src/app/(app)/transaksi/riwayat/**` | Daftar dan detail transaksi, form pelunasan |
| `tests/integration/circulation-fixture.ts` | `circulationFixture`, `seedLoan`, `TODAY` |
| `tests/integration/{circulation,loans,loan-concurrency,returns,fines,loan-queries}.test.ts` | Uji integrasi |

---

## Task 1: Aturan Domain, Tanggal Sekolah, dan Kalimat Pelanggaran

Blok murni yang dipakai seluruh task berikutnya: aturan `BOOK_INACTIVE` dan perbaikan hitungan terlambat di domain, nomor transaksi, tanggal "hari ini" menurut WIB, dan kalimat operasional untuk setiap pelanggaran.

**Files:**
- Modify: `src/domain/shared/types.ts`, `src/domain/shared/violations.ts`, `src/domain/loan/rules.ts`, `src/domain/loan/rules.test.ts`
- Create: `src/domain/loan/transaction-number.ts`, `src/domain/loan/transaction-number.test.ts`
- Create: `src/lib/school-date.ts`, `src/lib/school-date.test.ts`
- Create: `src/lib/violation-message.ts`, `src/lib/violation-message.test.ts`

**Interfaces:**
- Consumes: `validateLoanRequest`, `CopySnapshot`, `OpenLoanSnapshot`, `Violation` (Rencana 01); `formatDate`, `formatRupiah` (`src/lib/format.ts`)
- Produces:
  - `CopySnapshot.bookStatus: RecordStatus` (wajib)
  - `Violation` + `{ code: 'BOOK_INACTIVE'; barcode: string; bookTitle: string }`
  - `validateLoanRequest` mengabaikan pinjaman ber-`openItemCount === 0` untuk `HAS_OVERDUE` (tetap dihitung untuk `UNPAID_FINE`)
  - `formatTransactionNumber(date: IsoDate, sequence: number): string`, `loanCounterScope(date: IsoDate): string`
  - `SCHOOL_TIME_ZONE = 'Asia/Jakarta'`, `schoolToday(now?: Date): IsoDate`, `formatSchoolDateTime(value: Date): string`
  - `interface ViolationMessage { title: string; detail: string }`, `describeViolation(violation: Violation): ViolationMessage`

- [x] **Step 1: Tulis uji domain yang gagal**

Di `src/domain/loan/rules.test.ts`, ubah fixture `copy()` menjadi:

```ts
function copy(overrides: Partial<CopySnapshot> = {}): CopySnapshot {
  return {
    id: 'copy-1',
    barcode: 'BK-000123',
    status: 'TERSEDIA',
    bookTitle: 'Pemrograman Web',
    bookStatus: 'active',
    ...overrides,
  };
}
```

Lalu tambahkan di akhir berkas:

```ts
describe('validateLoanRequest — buku nonaktif', () => {
  it('menolak eksemplar milik buku nonaktif dengan BOOK_INACTIVE, bukan COPY_UNAVAILABLE', () => {
    const result = validateLoanRequest(request({
      requestedCopies: [copy({ bookStatus: 'inactive', status: 'DIPINJAM' })],
    }));
    expect(result).toEqual({
      ok: false,
      violations: [{ code: 'BOOK_INACTIVE', barcode: 'BK-000123', bookTitle: 'Pemrograman Web' }],
    });
  });
});

describe('validateLoanRequest — pinjaman selesai yang dendanya belum lunas', () => {
  const settled = {
    id: 'l9', transactionNumber: 'PJM-20260901-0001',
    dueDate: '2026-09-04', openItemCount: 0, unpaidFine: 5000,
  };

  it('tidak menganggap pinjaman tanpa eksemplar terbuka sebagai terlambat', () => {
    expect(validateLoanRequest(request({ openLoans: [settled] }))).toEqual({ ok: true });
  });

  it('tetap menghitung dendanya bila blockWhenUnpaidFine dinyalakan', () => {
    const result = validateLoanRequest(request({
      openLoans: [settled],
      settings: { ...settings, blockWhenUnpaidFine: true },
    }));
    expect(result).toEqual({
      ok: false,
      violations: [{ code: 'UNPAID_FINE', studentName: 'Ahmad Fauzi', amount: 5000 }],
    });
  });
});
```

- [x] **Step 2: Jalankan uji dan pastikan gagal**

Run: `npx vitest run src/domain/loan/rules.test.ts`
Expected: FAIL — uji `BOOK_INACTIVE` menerima `COPY_UNAVAILABLE`, dan uji pinjaman selesai menerima `HAS_OVERDUE`.

- [x] **Step 3: Implementasikan perubahan domain**

Di `src/domain/shared/types.ts`, ganti komentar di atas `OpenLoanSnapshot` dengan:

```ts
/**
 * Peminjaman yang masih berpengaruh pada peminjaman baru: masih memiliki
 * eksemplar belum kembali, atau semua bukunya sudah kembali tetapi dendanya
 * belum lunas (openItemCount = 0).
 */
```

dan ganti `interface CopySnapshot` dengan:

```ts
export interface CopySnapshot {
  id: string;
  barcode: string;
  status: CopyStatus;
  bookTitle: string;
  /** Eksemplar milik buku nonaktif tidak boleh dipinjam (spec 5.2, BOOK_INACTIVE). */
  bookStatus: RecordStatus;
  /** Terisi hanya bila status DIPINJAM, untuk menyusun pesan galat. */
  borrowedBy?: BorrowerSnapshot;
}
```

Di `src/domain/shared/violations.ts`, tambahkan anggota ini ke union `Violation`, tepat setelah anggota `COPY_UNAVAILABLE`:

```ts
  | { code: 'BOOK_INACTIVE'; barcode: string; bookTitle: string }
```

Di `src/domain/loan/rules.ts`, ganti blok `if (settings.blockWhenOverdue) { … }` dengan:

```ts
  if (settings.blockWhenOverdue) {
    for (const loan of openLoans) {
      // Pinjaman yang semua bukunya sudah kembali hanya menyisakan denda;
      // tidak ada buku yang terlambat dikembalikan.
      if (loan.openItemCount === 0) continue;
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
```

dan ganti perulangan terakhir (`for (const copy of uniqueCopies) { … }`) dengan:

```ts
  for (const copy of uniqueCopies) {
    if (copy.bookStatus !== 'active') {
      violations.push({ code: 'BOOK_INACTIVE', barcode: copy.barcode, bookTitle: copy.bookTitle });
    } else if (copy.status !== 'TERSEDIA') {
      violations.push({
        code: 'COPY_UNAVAILABLE',
        barcode: copy.barcode,
        bookTitle: copy.bookTitle,
        status: copy.status,
        ...(copy.borrowedBy ? { borrowedBy: copy.borrowedBy } : {}),
      });
    }
  }
```

Ubah juga komentar properti `openLoans` di `LoanRequestInput` menjadi `/** Peminjaman yang belum selesai atau dendanya belum lunas (lihat OpenLoanSnapshot). */`.

- [x] **Step 4: Jalankan uji domain dan pastikan lulus**

Run: `npx vitest run src/domain`
Expected: PASS, termasuk seluruh uji lama.

- [x] **Step 5: Tulis uji nomor transaksi yang gagal**

Buat `src/domain/loan/transaction-number.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatTransactionNumber, loanCounterScope } from './transaction-number';

describe('formatTransactionNumber', () => {
  it('mengikuti format PJM-YYYYMMDD-NNNN (spec 6.3)', () => {
    expect(formatTransactionNumber('2026-09-21', 1)).toBe('PJM-20260921-0001');
    expect(formatTransactionNumber('2026-09-21', 37)).toBe('PJM-20260921-0037');
  });

  it('tidak memotong nomor urut di atas 9999', () => {
    expect(formatTransactionNumber('2026-09-21', 12345)).toBe('PJM-20260921-12345');
  });

  it('menolak nomor urut yang bukan bilangan bulat positif', () => {
    expect(() => formatTransactionNumber('2026-09-21', 0)).toThrow('Nomor urut transaksi harus bilangan bulat positif');
  });

  it('menolak tanggal yang bukan YYYY-MM-DD', () => {
    expect(() => formatTransactionNumber('21/09/2026', 1)).toThrow('Tanggal tidak valid');
  });
});

describe('loanCounterScope', () => {
  it('memberi satu penghitung per hari', () => {
    expect(loanCounterScope('2026-09-21')).toBe('loan:20260921');
  });
});
```

Run: `npx vitest run src/domain/loan/transaction-number.test.ts`
Expected: FAIL — modul `./transaction-number` tidak ditemukan.

- [x] **Step 6: Implementasikan nomor transaksi**

Buat `src/domain/loan/transaction-number.ts`:

```ts
import type { IsoDate } from '../shared/date';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function compact(date: IsoDate): string {
  if (!ISO_DATE.test(date)) {
    throw new Error(`Tanggal tidak valid: "${date}". Format yang benar YYYY-MM-DD.`);
  }
  return date.split('-').join('');
}

/** Cakupan penghitung harian di tabel `counters`, misalnya 'loan:20260921' (spec 6.3). */
export function loanCounterScope(date: IsoDate): string {
  return `loan:${compact(date)}`;
}

/** 'PJM-20260921-0001'. Nomor urut di atas 9999 tidak dipotong. */
export function formatTransactionNumber(date: IsoDate, sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error(`Nomor urut transaksi harus bilangan bulat positif, diterima: ${sequence}`);
  }
  return `PJM-${compact(date)}-${String(sequence).padStart(4, '0')}`;
}
```

Run: `npx vitest run src/domain/loan/transaction-number.test.ts`
Expected: PASS.

- [x] **Step 7: Tulis uji tanggal sekolah yang gagal**

Buat `src/lib/school-date.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatSchoolDateTime, schoolToday } from './school-date';

describe('schoolToday', () => {
  it('sudah berganti hari pukul 00.30 WIB walau di UTC masih kemarin', () => {
    expect(schoolToday(new Date('2026-09-24T17:30:00Z'))).toBe('2026-09-25');
  });

  it('masih hari yang sama pukul 23.59 WIB', () => {
    expect(schoolToday(new Date('2026-09-24T16:59:00Z'))).toBe('2026-09-24');
  });
});

describe('formatSchoolDateTime', () => {
  it('menampilkan tanggal dan jam WIB', () => {
    expect(formatSchoolDateTime(new Date('2026-09-25T07:03:00Z'))).toBe('25/09/2026 14.03');
  });

  it('menampilkan tengah malam sebagai 00', () => {
    expect(formatSchoolDateTime(new Date('2026-09-24T17:00:00Z'))).toBe('25/09/2026 00.00');
  });
});
```

Run: `npx vitest run src/lib/school-date.test.ts`
Expected: FAIL — modul `./school-date` tidak ditemukan.

- [x] **Step 8: Implementasikan tanggal sekolah**

Buat `src/lib/school-date.ts`:

```ts
import type { IsoDate } from '@/domain/shared/date';

/** Zona waktu sekolah (keputusan pemilik produk, 25 September 2026). */
export const SCHOOL_TIME_ZONE = 'Asia/Jakarta';

const DATE_PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: SCHOOL_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function partsOf(value: Date): Record<string, string> {
  return Object.fromEntries(DATE_PARTS.formatToParts(value).map((part) => [part.type, part.value]));
}

/**
 * Tanggal kalender hari ini di sekolah. Server Vercel berjalan dalam UTC,
 * sehingga `new Date().toISOString()` menghasilkan tanggal kemarin untuk
 * transaksi pukul 00.00–07.00 WIB.
 */
export function schoolToday(now: Date = new Date()): IsoDate {
  const parts = partsOf(now);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** '25/09/2026 14.03', untuk waktu pengembalian dan pembayaran. */
export function formatSchoolDateTime(value: Date): string {
  const parts = partsOf(value);
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}.${parts.minute}`;
}
```

Run: `npx vitest run src/lib/school-date.test.ts`
Expected: PASS.

- [x] **Step 9: Tulis uji kalimat pelanggaran yang gagal**

Buat `src/lib/violation-message.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Violation } from '@/domain/shared/violations';
import { describeViolation } from './violation-message';

function text(violation: Violation): string {
  const message = describeViolation(violation);
  return `${message.title} — ${message.detail}`;
}

describe('describeViolation', () => {
  it('menyebut peminjam dan jatuh temponya untuk eksemplar yang sedang dipinjam (spec §9)', () => {
    expect(text({
      code: 'COPY_UNAVAILABLE', barcode: 'BK-000123', bookTitle: 'Pemrograman Web', status: 'DIPINJAM',
      borrowedBy: { name: 'Ahmad Fauzi', nis: '202600123', dueDate: '2026-09-24' },
    })).toBe('Eksemplar BK-000123 sedang dipinjam — Ahmad Fauzi (NIS 202600123), jatuh tempo 24/09/2026. Pilih eksemplar lain.');
  });

  it('menyebut status eksemplar yang rusak, hilang, atau ditarik', () => {
    expect(text({ code: 'COPY_UNAVAILABLE', barcode: 'BK-000124', bookTitle: 'Basis Data', status: 'RUSAK' }))
      .toBe('Eksemplar BK-000124 berstatus rusak — "Basis Data" tidak dapat dipinjam. Pilih eksemplar lain.');
    expect(describeViolation({ code: 'COPY_UNAVAILABLE', barcode: 'BK-1', bookTitle: 'X', status: 'HILANG' }).title)
      .toBe('Eksemplar BK-1 tercatat hilang');
    expect(describeViolation({ code: 'COPY_UNAVAILABLE', barcode: 'BK-1', bookTitle: 'X', status: 'NONAKTIF' }).title)
      .toBe('Eksemplar BK-1 sudah ditarik dari koleksi');
  });

  it('menyuruh mengembalikan buku dulu bila kuota sudah habis (spec §9)', () => {
    expect(text({
      code: 'QUOTA_EXCEEDED', studentName: 'Ahmad Fauzi', activeCount: 3, requestedCount: 1, maxActiveLoans: 3,
    })).toBe('Kuota penuh — Ahmad Fauzi sudah meminjam 3 buku. Kembalikan salah satu terlebih dahulu.');
  });

  it('menyebut sisa slot bila permintaan melebihi sisa kuota', () => {
    expect(text({
      code: 'QUOTA_EXCEEDED', studentName: 'Ahmad Fauzi', activeCount: 1, requestedCount: 3, maxActiveLoans: 3,
    })).toBe('Kuota tidak cukup — Ahmad Fauzi hanya dapat meminjam 2 buku lagi, tetapi 3 buku dipilih. Kurangi daftar buku.');
  });

  it('menyebut nomor transaksi dan lama keterlambatan (spec §9)', () => {
    expect(text({ code: 'HAS_OVERDUE', studentName: 'Ahmad Fauzi', transactionNumber: 'PJM-20260917-0003', daysLate: 4 }))
      .toBe('Ada pinjaman terlambat — PJM-20260917-0003, telat 4 hari. Selesaikan dahulu sebelum meminjam.');
  });

  it('menjelaskan setiap pelanggaran lain beserta tindakannya', () => {
    expect(text({ code: 'NO_ACTIVE_YEAR' }))
      .toBe('Belum ada tahun ajaran aktif — Minta admin mengaktifkan tahun ajaran di Pengaturan → Tahun Ajaran.');
    expect(text({ code: 'NO_COPY_SELECTED' }))
      .toBe('Belum ada buku — Pindai barcode minimal satu eksemplar.');
    expect(text({ code: 'STUDENT_INACTIVE', studentName: 'Siti Aminah' }))
      .toBe('Siti Aminah berstatus nonaktif — Aktifkan data siswa di Master Data → Siswa bila ia masih bersekolah.');
    expect(text({ code: 'DUPLICATE_COPY', barcode: 'BK-000123', bookTitle: 'Pemrograman Web' }))
      .toBe('Eksemplar BK-000123 dimasukkan dua kali — Hapus salah satu "Pemrograman Web" dari daftar.');
    expect(text({ code: 'BOOK_INACTIVE', barcode: 'BK-000007', bookTitle: 'Contoh QA' }))
      .toBe('Buku "Contoh QA" nonaktif — Eksemplar BK-000007 tidak dapat dipinjam. Aktifkan bukunya di Master Data → Buku bila masih dipakai.');
    expect(text({ code: 'UNPAID_FINE', studentName: 'Ahmad Fauzi', amount: 4000 }))
      .toBe('Ada denda belum lunas — Ahmad Fauzi menunggak Rp4.000. Lunasi di Riwayat Transaksi sebelum meminjam.');
  });
});
```

Run: `npx vitest run src/lib/violation-message.test.ts`
Expected: FAIL — modul `./violation-message` tidak ditemukan.

- [x] **Step 10: Implementasikan kalimat pelanggaran**

Buat `src/lib/violation-message.ts`:

```ts
import type { CopyStatus } from '@/domain/shared/types';
import type { Violation } from '@/domain/shared/violations';
import { formatDate, formatRupiah } from './format';

export interface ViolationMessage {
  /** Apa yang terjadi, menyebut entitasnya. */
  title: string;
  /** Rincian dan tindakan yang harus diambil petugas. */
  detail: string;
}

const UNAVAILABLE: Record<Exclude<CopyStatus, 'TERSEDIA'>, string> = {
  DIPINJAM: 'sedang dipinjam',
  RUSAK: 'berstatus rusak',
  HILANG: 'tercatat hilang',
  NONAKTIF: 'sudah ditarik dari koleksi',
};

/**
 * Kalimat operasional spec §9: setiap pesan menyebut entitas yang terlibat
 * dan tindakan yang harus diambil. Domain mengembalikan objek; kalimatnya
 * disusun di sini agar dipakai sama oleh meja peminjaman dan pesan penolakan.
 */
export function describeViolation(violation: Violation): ViolationMessage {
  switch (violation.code) {
    case 'NO_ACTIVE_YEAR':
      return {
        title: 'Belum ada tahun ajaran aktif',
        detail: 'Minta admin mengaktifkan tahun ajaran di Pengaturan → Tahun Ajaran.',
      };
    case 'NO_COPY_SELECTED':
      return { title: 'Belum ada buku', detail: 'Pindai barcode minimal satu eksemplar.' };
    case 'STUDENT_INACTIVE':
      return {
        title: `${violation.studentName} berstatus nonaktif`,
        detail: 'Aktifkan data siswa di Master Data → Siswa bila ia masih bersekolah.',
      };
    case 'DUPLICATE_COPY':
      return {
        title: `Eksemplar ${violation.barcode} dimasukkan dua kali`,
        detail: `Hapus salah satu "${violation.bookTitle}" dari daftar.`,
      };
    case 'QUOTA_EXCEEDED': {
      const remaining = Math.max(0, violation.maxActiveLoans - violation.activeCount);
      return remaining === 0
        ? {
            title: 'Kuota penuh',
            detail: `${violation.studentName} sudah meminjam ${violation.activeCount} buku. Kembalikan salah satu terlebih dahulu.`,
          }
        : {
            title: 'Kuota tidak cukup',
            detail: `${violation.studentName} hanya dapat meminjam ${remaining} buku lagi, tetapi ${violation.requestedCount} buku dipilih. Kurangi daftar buku.`,
          };
    }
    case 'HAS_OVERDUE':
      return {
        title: 'Ada pinjaman terlambat',
        detail: `${violation.transactionNumber}, telat ${violation.daysLate} hari. Selesaikan dahulu sebelum meminjam.`,
      };
    case 'COPY_UNAVAILABLE': {
      const state = violation.status === 'TERSEDIA' ? 'tidak tersedia' : UNAVAILABLE[violation.status];
      const title = `Eksemplar ${violation.barcode} ${state}`;
      if (violation.borrowedBy) {
        const { name, nis, dueDate } = violation.borrowedBy;
        return { title, detail: `${name} (NIS ${nis}), jatuh tempo ${formatDate(dueDate)}. Pilih eksemplar lain.` };
      }
      return { title, detail: `"${violation.bookTitle}" tidak dapat dipinjam. Pilih eksemplar lain.` };
    }
    case 'BOOK_INACTIVE':
      return {
        title: `Buku "${violation.bookTitle}" nonaktif`,
        detail: `Eksemplar ${violation.barcode} tidak dapat dipinjam. Aktifkan bukunya di Master Data → Buku bila masih dipakai.`,
      };
    case 'UNPAID_FINE':
      return {
        title: 'Ada denda belum lunas',
        detail: `${violation.studentName} menunggak ${formatRupiah(violation.amount)}. Lunasi di Riwayat Transaksi sebelum meminjam.`,
      };
  }
}
```

Run: `npx vitest run src/lib/violation-message.test.ts`
Expected: PASS.

- [x] **Step 11: Jalankan seluruh uji unit, lint, dan tsc**

Run: `npm test && npm run lint && npx tsc --noEmit`
Expected: seluruhnya PASS/bersih. Bila tsc menandai tempat lain yang membangun `CopySnapshot` tanpa `bookStatus`, tambahkan `bookStatus` di sana (saat rencana ini ditulis, tidak ada pemakai di luar `src/domain`).

- [x] **Step 12: Commit**

```bash
git add src/domain/shared/types.ts src/domain/shared/violations.ts src/domain/loan/rules.ts src/domain/loan/rules.test.ts \
  src/domain/loan/transaction-number.ts src/domain/loan/transaction-number.test.ts \
  src/lib/school-date.ts src/lib/school-date.test.ts src/lib/violation-message.ts src/lib/violation-message.test.ts
git commit -m "$(cat <<'EOF'
feat(domain): tolak buku nonaktif, nomor transaksi, tanggal WIB, dan kalimat pelanggaran

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Query Meja Sirkulasi dan Fixture Uji Transaksi

Pembacaan yang dibutuhkan meja peminjaman dan `createLoan`: mencari siswa (scan kartu/NIS/nama), kartu peminjam (sisa slot, keterlambatan, tunggakan), mencari eksemplar per barcode lengkap dengan peminjamnya, dan daftar pinjaman siswa yang masih berpengaruh. Task ini juga membuat fixture yang dipakai seluruh uji integrasi transaksi.

**Files:**
- Create: `src/server/queries/loan-aggregates.ts`
- Create: `src/server/queries/circulation.ts`
- Create: `tests/integration/circulation-fixture.ts`
- Create: `tests/integration/circulation.test.ts`

**Interfaces:**
- Consumes: `containsPattern` (`queries/like.ts`); `getLibrarySettings` (`queries/settings.ts`); `diffDays` (domain); `isUuid`; `testActor`, `withRollback` (`tests/integration/helpers.ts`); skema `students`, `loans`, `loanItems`, `finePayments`, `bookCopies`, `books`, `racks`, `academicYears`, `librarySettings`
- Produces:
  - `openItemCounts(executor)` — subquery beralias `open_items` dengan kolom `loanId`, `openCount`
  - `paidTotals(executor)` — subquery beralias `paid_totals` dengan kolom `loanId`, `paid` (untai numeric)
  - `interface BorrowerOption { id: string; nis: string; name: string; className: string; status: RecordStatus }`
  - `searchBorrowers(query: string, executor?): Promise<BorrowerOption[]>` — maks. 8, NIS yang cocok persis paling atas
  - `loadBorrowerLoans(studentId: string, executor?): Promise<OpenLoanSnapshot[]>`
  - `interface BorrowerCard { student: StudentSnapshot; activeCount: number; maxActiveLoans: number; overdue: { transactionNumber: string; daysLate: number }[]; unpaidFine: number; blockWhenOverdue: boolean; blockWhenUnpaidFine: boolean }`
  - `getBorrowerCard(studentId: string, today: IsoDate, executor?): Promise<BorrowerCard | null>`
  - `borrowersOf(copyIds: string[], executor?): Promise<Map<string, BorrowerSnapshot>>`
  - `interface CopyLookup extends CopySnapshot { bookId: string; rackCode: string | null }`
  - `findCopyByBarcode(barcode: string, executor?): Promise<CopyLookup | null>` — tidak peka huruf besar-kecil
  - Fixture: `TODAY = '2090-03-02'`, `circulationFixture(tx, options?)`, `seedLoan(tx, fx, options)`

- [x] **Step 1: Buat fixture uji transaksi**

Buat `tests/integration/circulation-fixture.ts` (berkas pendukung uji, bukan implementasi):

```ts
import { asc, eq, inArray, sql } from 'drizzle-orm';
import type { IsoDate } from '@/domain/shared/date';
import type { Actor, LoanStatus } from '@/domain/shared/types';
import type { Transaction } from '@/server/db/executor';
import {
  academicYears, bookCopies, books, librarySettings, loanItems, loans, racks, students,
} from '@/server/db/schema';
import { testActor } from './helpers';

/**
 * Hari uji. Jauh di masa depan agar penghitung nomor transaksi harian
 * ('loan:20900302') tidak pernah bertabrakan dengan transaksi sungguhan.
 */
export const TODAY: IsoDate = '2090-03-02';

export interface FixtureStudent {
  id: string;
  nis: string;
  name: string;
  className: string;
}

export interface FixtureCopy {
  id: string;
  barcode: string;
}

export interface CirculationFixture {
  actor: Actor;
  yearId: string;
  bookId: string;
  bookTitle: string;
  copies: FixtureCopy[];
  students: FixtureStudent[];
}

/**
 * Dunia kecil untuk uji transaksi, seluruhnya di dalam transaksi uji yang
 * di-rollback: tahun ajaran aktif sendiri, konfigurasi yang diketahui
 * (kuota 3, durasi 3 hari, denda Rp1.000, blokir terlambat), satu buku
 * seharga Rp50.000 di rak UJI-R1 dengan eksemplar UJI-SRK-01…, dan dua siswa.
 * Uji tidak bergantung pada data seed atau konfigurasi cloud saat itu.
 */
export async function circulationFixture(
  tx: Transaction,
  options: { copies?: number; bookPrice?: number } = {},
): Promise<CirculationFixture> {
  const actor = await testActor(tx);

  await tx.execute(sql`update academic_years set is_active = false`);
  const [year] = await tx
    .insert(academicYears)
    .values({ name: 'UJI-2089/2090', startDate: '2089-07-01', endDate: '2090-06-30', isActive: true })
    .returning({ id: academicYears.id });

  const rules = {
    maxActiveLoans: 3,
    loanDurationDays: 3,
    finePerDay: '1000',
    blockWhenOverdue: true,
    blockWhenUnpaidFine: false,
  };
  await tx.insert(librarySettings).values({ id: 1, ...rules })
    .onConflictDoUpdate({ target: librarySettings.id, set: rules });

  const [rack] = await tx.insert(racks).values({ code: 'UJI-R1', name: 'UJI Rak Sirkulasi' }).returning({ id: racks.id });
  const bookTitle = 'UJI-Buku Sirkulasi';
  const [book] = await tx
    .insert(books)
    .values({ title: bookTitle, author: 'UJI-Penulis', rackId: rack.id, price: String(options.bookPrice ?? 50_000) })
    .returning({ id: books.id });

  const count = options.copies ?? 5;
  await tx.insert(bookCopies).values(
    Array.from({ length: count }, (_, index) => ({
      bookId: book.id,
      barcode: `UJI-SRK-${String(index + 1).padStart(2, '0')}`,
    })),
  );
  const copies = await tx
    .select({ id: bookCopies.id, barcode: bookCopies.barcode })
    .from(bookCopies)
    .where(eq(bookCopies.bookId, book.id))
    .orderBy(asc(bookCopies.barcode));

  await tx.insert(students).values([
    { nis: 'UJI-S1', name: 'UJI Siswa Satu', className: 'XI UJI 1', academicYearId: year.id },
    { nis: 'UJI-S2', name: 'UJI Siswa Dua', className: 'XI UJI 2', academicYearId: year.id },
  ]);
  const studentRows = await tx
    .select({ id: students.id, nis: students.nis, name: students.name, className: students.className })
    .from(students)
    .where(inArray(students.nis, ['UJI-S1', 'UJI-S2']))
    .orderBy(asc(students.nis));

  return { actor, yearId: year.id, bookId: book.id, bookTitle, copies, students: studentRows };
}

let seededLoans = 0;

/**
 * Menyisipkan peminjaman langsung, tanpa createLoan, untuk menyiapkan keadaan
 * yang sulit dicapai lewat service (pinjaman lama yang terlambat, pinjaman
 * selesai yang dendanya belum lunas). `copies` dan `returned` adalah indeks
 * ke `fx.copies`; `returned` harus bagian dari `copies`.
 */
export async function seedLoan(
  tx: Transaction,
  fx: CirculationFixture,
  options: {
    student: number;
    copies: number[];
    loanDate: IsoDate;
    dueDate: IsoDate;
    returned?: number[];
    totalFine?: number;
  },
): Promise<{ id: string; transactionNumber: string }> {
  const returned = new Set(options.returned ?? []);
  const status: LoanStatus = returned.size === 0
    ? 'AKTIF'
    : returned.size === options.copies.length ? 'SELESAI' : 'SEBAGIAN_KEMBALI';
  seededLoans += 1;
  const transactionNumber = `UJI-PJM-${String(seededLoans).padStart(4, '0')}`;
  const student = fx.students[options.student];

  const [loan] = await tx
    .insert(loans)
    .values({
      transactionNumber,
      studentId: student.id,
      studentClass: student.className,
      academicYearId: fx.yearId,
      loanDate: options.loanDate,
      dueDate: options.dueDate,
      status,
      totalFine: String(options.totalFine ?? 0),
      createdBy: fx.actor.id,
    })
    .returning({ id: loans.id });

  await tx.insert(loanItems).values(options.copies.map((index) => ({
    loanId: loan.id,
    bookCopyId: fx.copies[index].id,
    returnedAt: returned.has(index) ? new Date() : null,
    returnCondition: returned.has(index) ? ('BAIK' as const) : null,
  })));

  const onLoan = options.copies.filter((index) => !returned.has(index)).map((index) => fx.copies[index].id);
  if (onLoan.length > 0) {
    await tx.update(bookCopies).set({ status: 'DIPINJAM' }).where(inArray(bookCopies.id, onLoan));
  }
  return { id: loan.id, transactionNumber };
}
```

- [x] **Step 2: Tulis uji integrasi query yang gagal**

Buat `tests/integration/circulation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { bookCopies, books, finePayments } from '@/server/db/schema';
import {
  findCopyByBarcode, getBorrowerCard, loadBorrowerLoans, searchBorrowers,
} from '@/server/queries/circulation';
import { circulationFixture, seedLoan, TODAY } from './circulation-fixture';
import { withRollback } from './helpers';

describe('searchBorrowers', () => {
  it('menaruh siswa dengan NIS yang cocok persis di urutan pertama', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);

      const result = await searchBorrowers('UJI-S2', tx);

      expect(result[0]).toEqual({
        id: fx.students[1].id, nis: 'UJI-S2', name: 'UJI Siswa Dua', className: 'XI UJI 2', status: 'active',
      });
    });
  });

  it('mencari sebagian nama tanpa memedulikan huruf besar-kecil', async () => {
    await withRollback(async (tx) => {
      await circulationFixture(tx);

      const names = (await searchBorrowers('uji siswa', tx)).map((row) => row.name);

      expect(names).toEqual(expect.arrayContaining(['UJI Siswa Dua', 'UJI Siswa Satu']));
    });
  });

  it('mengembalikan daftar kosong untuk kata kunci kosong', async () => {
    await withRollback(async (tx) => {
      expect(await searchBorrowers('   ', tx)).toEqual([]);
    });
  });
});

describe('loadBorrowerLoans', () => {
  it('memuat pinjaman terbuka dan pinjaman selesai yang dendanya belum lunas', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      const open = await seedLoan(tx, fx, { student: 0, copies: [0, 1], loanDate: '2090-02-20', dueDate: '2090-02-23', returned: [1] });
      const unpaid = await seedLoan(tx, fx, { student: 0, copies: [2], loanDate: '2090-02-01', dueDate: '2090-02-04', returned: [2], totalFine: 5000 });
      await tx.insert(finePayments).values({ loanId: unpaid.id, amount: '2000', receivedBy: fx.actor.id });
      const settled = await seedLoan(tx, fx, { student: 0, copies: [3], loanDate: '2090-01-01', dueDate: '2090-01-04', returned: [3], totalFine: 1000 });
      await tx.insert(finePayments).values({ loanId: settled.id, amount: '1000', receivedBy: fx.actor.id });

      const result = await loadBorrowerLoans(fx.students[0].id, tx);

      expect(result).toEqual([
        { id: unpaid.id, transactionNumber: unpaid.transactionNumber, dueDate: '2090-02-04', openItemCount: 0, unpaidFine: 3000 },
        { id: open.id, transactionNumber: open.transactionNumber, dueDate: '2090-02-23', openItemCount: 1, unpaidFine: 0 },
      ]);
    });
  });
});

describe('getBorrowerCard', () => {
  it('merangkum pinjaman aktif, keterlambatan, dan tunggakan', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      const late = await seedLoan(tx, fx, { student: 0, copies: [0], loanDate: '2090-02-20', dueDate: '2090-02-23' });
      await seedLoan(tx, fx, { student: 0, copies: [1], loanDate: '2090-01-01', dueDate: '2090-01-04', returned: [1], totalFine: 4000 });

      expect(await getBorrowerCard(fx.students[0].id, TODAY, tx)).toEqual({
        student: { id: fx.students[0].id, nis: 'UJI-S1', name: 'UJI Siswa Satu', className: 'XI UJI 1', status: 'active' },
        activeCount: 1,
        maxActiveLoans: 3,
        overdue: [{ transactionNumber: late.transactionNumber, daysLate: 7 }],
        unpaidFine: 4000,
        blockWhenOverdue: true,
        blockWhenUnpaidFine: false,
      });
    });
  });

  it('mengembalikan null untuk siswa yang tidak ada atau id yang bukan UUID', async () => {
    await withRollback(async (tx) => {
      expect(await getBorrowerCard(crypto.randomUUID(), TODAY, tx)).toBeNull();
      expect(await getBorrowerCard('bukan-uuid', TODAY, tx)).toBeNull();
    });
  });
});

describe('findCopyByBarcode', () => {
  it('menemukan eksemplar tanpa memedulikan huruf besar-kecil, lengkap dengan rak dan status bukunya', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);

      expect(await findCopyByBarcode(' uji-srk-01 ', tx)).toEqual({
        id: fx.copies[0].id,
        barcode: 'UJI-SRK-01',
        status: 'TERSEDIA',
        bookId: fx.bookId,
        bookTitle: 'UJI-Buku Sirkulasi',
        bookStatus: 'active',
        rackCode: 'UJI-R1',
      });
    });
  });

  it('menyertakan peminjam untuk eksemplar yang sedang dipinjam', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      await seedLoan(tx, fx, { student: 1, copies: [0], loanDate: TODAY, dueDate: '2090-03-05' });

      expect((await findCopyByBarcode('UJI-SRK-01', tx))?.borrowedBy).toEqual({
        name: 'UJI Siswa Dua', nis: 'UJI-S2', dueDate: '2090-03-05',
      });
    });
  });

  it('melaporkan status buku nonaktif dan mengembalikan null untuk barcode tak dikenal', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      await tx.update(books).set({ status: 'inactive' }).where(eq(books.id, fx.bookId));
      await tx.update(bookCopies).set({ status: 'RUSAK' }).where(eq(bookCopies.id, fx.copies[1].id));

      const copy = await findCopyByBarcode('UJI-SRK-02', tx);
      expect(copy).toMatchObject({ status: 'RUSAK', bookStatus: 'inactive' });
      expect(copy?.borrowedBy).toBeUndefined();
      expect(await findCopyByBarcode('UJI-TIDAK-ADA', tx)).toBeNull();
    });
  });
});
```

Run: `npx vitest run --config vitest.integration.config.ts tests/integration/circulation.test.ts`
Expected: FAIL — modul `@/server/queries/circulation` tidak ditemukan.

- [x] **Step 3: Implementasikan subquery agregat**

Buat `src/server/queries/loan-aggregates.ts`:

```ts
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
```

- [x] **Step 4: Implementasikan query sirkulasi**

Buat `src/server/queries/circulation.ts`:

```ts
import { and, asc, desc, eq, ilike, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import { diffDays, type IsoDate } from '@/domain/shared/date';
import type {
  BorrowerSnapshot, CopySnapshot, OpenLoanSnapshot, RecordStatus, StudentSnapshot,
} from '@/domain/shared/types';
import { db } from '@/server/db/client';
import type { Executor } from '@/server/db/executor';
import { bookCopies, books, loanItems, loans, racks, students } from '@/server/db/schema';
import { isUuid } from '@/server/validation/common';
import { containsPattern } from './like';
import { openItemCounts, paidTotals } from './loan-aggregates';
import { getLibrarySettings } from './settings';

export interface BorrowerOption {
  id: string;
  nis: string;
  name: string;
  className: string;
  status: RecordStatus;
}

const BORROWER_LIMIT = 8;

/**
 * Pencarian siswa di meja peminjaman. NIS yang cocok persis (hasil scan kartu)
 * selalu di urutan pertama, sehingga scan langsung memilih siswa itu.
 * Siswa nonaktif ikut tampil agar kartu dapat menjelaskan mengapa ia ditolak.
 */
export async function searchBorrowers(query: string, executor: Executor = db): Promise<BorrowerOption[]> {
  const keyword = query.trim();
  if (!keyword) return [];
  const pattern = containsPattern(keyword);
  return executor
    .select({
      id: students.id,
      nis: students.nis,
      name: students.name,
      className: students.className,
      status: students.status,
    })
    .from(students)
    .where(or(eq(students.nis, keyword), ilike(students.nis, pattern), ilike(students.name, pattern)))
    .orderBy(desc(sql`${students.nis} = ${keyword}`), asc(students.name))
    .limit(BORROWER_LIMIT);
}

/**
 * Peminjaman siswa yang masih berpengaruh pada peminjaman baru: yang masih
 * memiliki eksemplar belum kembali (kuota, keterlambatan), dan yang semua
 * bukunya sudah kembali tetapi dendanya belum lunas (tunggakan).
 */
export async function loadBorrowerLoans(studentId: string, executor: Executor = db): Promise<OpenLoanSnapshot[]> {
  const openItems = openItemCounts(executor);
  const paid = paidTotals(executor);
  const rows = await executor
    .select({
      id: loans.id,
      transactionNumber: loans.transactionNumber,
      dueDate: loans.dueDate,
      openItemCount: sql<number>`coalesce(${openItems.openCount}, 0)`,
      unpaidFine: sql<string>`${loans.totalFine} - coalesce(${paid.paid}, 0)`,
    })
    .from(loans)
    .leftJoin(openItems, eq(openItems.loanId, loans.id))
    .leftJoin(paid, eq(paid.loanId, loans.id))
    .where(and(
      eq(loans.studentId, studentId),
      or(ne(loans.status, 'SELESAI'), sql`${loans.totalFine} > coalesce(${paid.paid}, 0)`),
    ))
    .orderBy(asc(loans.dueDate));

  return rows.map((row) => ({
    ...row,
    openItemCount: Number(row.openItemCount),
    unpaidFine: Math.max(0, Number(row.unpaidFine)),
  }));
}

export interface BorrowerCard {
  student: StudentSnapshot;
  /** Eksemplar yang sedang dipinjam, dari seluruh transaksi. */
  activeCount: number;
  maxActiveLoans: number;
  overdue: { transactionNumber: string; daysLate: number }[];
  unpaidFine: number;
  blockWhenOverdue: boolean;
  blockWhenUnpaidFine: boolean;
}

/**
 * Kartu siswa di meja peminjaman: sisa slot dan peringatan ditampilkan
 * SEBELUM petugas menambahkan buku, sehingga penolakan jarang terjadi (spec 8.2).
 */
export async function getBorrowerCard(
  studentId: string,
  today: IsoDate,
  executor: Executor = db,
): Promise<BorrowerCard | null> {
  if (!isUuid(studentId)) return null;
  const [student] = await executor
    .select({
      id: students.id,
      nis: students.nis,
      name: students.name,
      className: students.className,
      status: students.status,
    })
    .from(students)
    .where(eq(students.id, studentId))
    .limit(1);
  if (!student) return null;

  const borrowerLoans = await loadBorrowerLoans(studentId, executor);
  const settings = await getLibrarySettings(executor);

  return {
    student,
    activeCount: borrowerLoans.reduce((sum, loan) => sum + loan.openItemCount, 0),
    maxActiveLoans: settings.maxActiveLoans,
    overdue: borrowerLoans
      .filter((loan) => loan.openItemCount > 0 && diffDays(loan.dueDate, today) > 0)
      .map((loan) => ({ transactionNumber: loan.transactionNumber, daysLate: diffDays(loan.dueDate, today) })),
    unpaidFine: borrowerLoans.reduce((sum, loan) => sum + loan.unpaidFine, 0),
    blockWhenOverdue: settings.blockWhenOverdue,
    blockWhenUnpaidFine: settings.blockWhenUnpaidFine,
  };
}

/** Peminjam eksemplar yang sedang DIPINJAM, untuk pesan "sedang dipinjam oleh …" (spec §9). */
export async function borrowersOf(copyIds: string[], executor: Executor = db): Promise<Map<string, BorrowerSnapshot>> {
  if (copyIds.length === 0) return new Map();
  const rows = await executor
    .select({
      copyId: loanItems.bookCopyId,
      name: students.name,
      nis: students.nis,
      dueDate: loans.dueDate,
    })
    .from(loanItems)
    .innerJoin(loans, eq(loans.id, loanItems.loanId))
    .innerJoin(students, eq(students.id, loans.studentId))
    .where(and(inArray(loanItems.bookCopyId, copyIds), isNull(loanItems.returnedAt)));
  return new Map(rows.map(({ copyId, ...borrower }) => [copyId, borrower]));
}

export interface CopyLookup extends CopySnapshot {
  bookId: string;
  rackCode: string | null;
}

/** Barcode disimpan dalam huruf besar (validasi eksemplar Rencana 02). */
export async function findCopyByBarcode(barcode: string, executor: Executor = db): Promise<CopyLookup | null> {
  const normalized = barcode.trim().toUpperCase();
  if (!normalized) return null;
  const [copy] = await executor
    .select({
      id: bookCopies.id,
      barcode: bookCopies.barcode,
      status: bookCopies.status,
      bookId: books.id,
      bookTitle: books.title,
      bookStatus: books.status,
      rackCode: racks.code,
    })
    .from(bookCopies)
    .innerJoin(books, eq(books.id, bookCopies.bookId))
    .leftJoin(racks, eq(racks.id, books.rackId))
    .where(eq(bookCopies.barcode, normalized))
    .limit(1);
  if (!copy) return null;

  const borrower = copy.status === 'DIPINJAM' ? (await borrowersOf([copy.id], executor)).get(copy.id) : undefined;
  return borrower ? { ...copy, borrowedBy: borrower } : copy;
}
```

- [x] **Step 5: Jalankan uji dan pastikan lulus**

Run: `npx vitest run --config vitest.integration.config.ts tests/integration/circulation.test.ts`
Expected: seluruh uji PASS.

Bila `coalesce(${openItems.openCount}, 0)` mengembalikan untai (bukan bilangan), biarkan: kode memetakan dengan `Number(...)`. Bila uji `loadBorrowerLoans` gagal karena kolom di template `sql` tidak menyebut tabelnya, periksa SQL-nya dengan `.toSQL()`; pada query ber-JOIN Drizzle 0.45 menyebut nama tabel.

- [x] **Step 6: Jalankan uji unit, lint, dan tsc**

Run: `npm test && npm run lint && npx tsc --noEmit`
Expected: PASS/bersih.

- [x] **Step 7: Commit**

```bash
git add src/server/queries/loan-aggregates.ts src/server/queries/circulation.ts \
  tests/integration/circulation-fixture.ts tests/integration/circulation.test.ts
git commit -m "$(cat <<'EOF'
feat(sirkulasi): cari siswa, kartu peminjam, dan cari eksemplar per barcode

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Service Peminjaman dan Bukti Konkurensi

`createLoan()` mengikuti spec 6.1 langkah demi langkah di dalam satu transaksi: baca konfigurasi dan tahun aktif → kunci siswa → baca pinjamannya → **kunci seluruh eksemplar yang diminta** → validasi domain → bila ada pelanggaran, kembalikan tanpa menulis apa pun → ambil nomor urut harian → simpan pinjaman dan itemnya → ubah eksemplar menjadi `DIPINJAM` → audit `loan.create`.

Uji konkurensi mengikuti keputusan pemilik produk (lihat kepala rencana): dua koneksi sungguhan, keduanya di-rollback.

**Files:**
- Modify: `src/server/db/errors.ts`, `src/server/db/errors.test.ts`
- Create: `src/server/validation/loan.ts`, `src/server/validation/loan.test.ts`
- Create: `src/server/services/loans.ts`
- Create: `tests/integration/loans.test.ts`, `tests/integration/loan-concurrency.test.ts`

**Interfaces:**
- Consumes: `validateLoanRequest`, `calculateDueDate`, `formatTransactionNumber`, `loanCounterScope` (domain); `getLibrarySettings`; `getActiveAcademicYear`; `loadBorrowerLoans`, `borrowersOf` (Task 2); `writeAudit`; `uniqueViolation`; `optionalText`, `isUuid`; fixture Task 2
- Produces:
  - `sqlState(error: unknown): string | null` di `src/server/db/errors.ts`
  - `createLoanSchema`; `type CreateLoanInput = { studentId: string; copyIds: string[]; notes: string | null }`
  - `type LoanResult = { ok: true; id: string; transactionNumber: string; dueDate: IsoDate } | { ok: false; violations: Violation[] } | { ok: false; message: string }`
  - `createLoan(input: CreateLoanInput, actor: Actor, today: IsoDate, executor?): Promise<LoanResult>`
  - Audit `loan.create` (entity `loans`, metadata `{ transactionNumber, studentNis, barcodes, dueDate }`)

- [x] **Step 1: Tulis uji `sqlState` yang gagal**

Ubah impor di `src/server/db/errors.test.ts` menjadi `import { sqlState, uniqueViolation } from './errors';`, lalu tambahkan di akhir berkas:

```ts
describe('sqlState', () => {
  it('membaca kode SQLSTATE dari galat yang dibungkus Drizzle', () => {
    const wrapped = Object.assign(new Error('Failed query: select ...'), { cause: { code: '55P03' } });
    expect(sqlState(wrapped)).toBe('55P03');
  });

  it('mengembalikan null untuk galat yang bukan dari Postgres', () => {
    expect(sqlState(new Error('bukan galat database'))).toBeNull();
    expect(sqlState(null)).toBeNull();
  });
});
```

Run: `npx vitest run src/server/db/errors.test.ts`
Expected: FAIL — `sqlState` tidak diekspor.

- [x] **Step 2: Implementasikan `sqlState`**

Tambahkan di akhir `src/server/db/errors.ts`:

```ts
/** Kode SQLSTATE galat Postgres, misalnya '55P03' (lock_not_available), atau null. */
export function sqlState(error: unknown): string | null {
  const pg = postgresError(error);
  return typeof pg?.code === 'string' ? pg.code : null;
}
```

Run: `npx vitest run src/server/db/errors.test.ts`
Expected: PASS.

- [x] **Step 3: Tulis uji validasi yang gagal**

Buat `src/server/validation/loan.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { createLoanSchema } from './loan';

const studentId = '6f1c2b1e-4b1a-4c3e-9f7a-2d1e3c4b5a6f';
const copyId = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

function messagesOf(result: z.ZodSafeParseResult<unknown>): string[] {
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe('createLoanSchema', () => {
  it('menerima siswa, daftar eksemplar, dan catatan kosong sebagai null', () => {
    expect(createLoanSchema.parse({ studentId, copyIds: [copyId], notes: '  ' })).toEqual({
      studentId, copyIds: [copyId], notes: null,
    });
  });

  it('membiarkan daftar eksemplar kosong agar domain menolaknya dengan NO_COPY_SELECTED', () => {
    expect(createLoanSchema.parse({ studentId, copyIds: [], notes: '' }).copyIds).toEqual([]);
  });

  it('meminta siswa dipilih lebih dulu', () => {
    expect(messagesOf(createLoanSchema.safeParse({ copyIds: [copyId], notes: '' })))
      .toEqual(['Pilih siswa terlebih dahulu.']);
  });

  it('menolak eksemplar yang bukan UUID dan daftar yang terlalu panjang', () => {
    expect(messagesOf(createLoanSchema.safeParse({ studentId, copyIds: ['BK-000123'], notes: '' })))
      .toEqual(['Eksemplar tidak valid. Pindai ulang barcodenya.']);
    expect(messagesOf(createLoanSchema.safeParse({ studentId, copyIds: Array(21).fill(copyId), notes: '' })))
      .toEqual(['Maksimal 20 eksemplar dalam satu transaksi.']);
  });
});
```

Run: `npx vitest run src/server/validation/loan.test.ts`
Expected: FAIL — modul `./loan` tidak ditemukan.

- [x] **Step 4: Implementasikan validasi**

Buat `src/server/validation/loan.ts`:

```ts
import { z } from 'zod';
import { optionalText } from './common';

export const createLoanSchema = z.object({
  studentId: z.uuid('Pilih siswa terlebih dahulu.'),
  // Daftar kosong sengaja diterima: domain menolaknya dengan NO_COPY_SELECTED,
  // yang kalimatnya sudah disusun describeViolation.
  copyIds: z
    .array(z.uuid('Eksemplar tidak valid. Pindai ulang barcodenya.'), { error: 'Daftar buku tidak valid. Muat ulang halaman.' })
    .max(20, 'Maksimal 20 eksemplar dalam satu transaksi.'),
  notes: optionalText(500),
});

export type CreateLoanInput = z.output<typeof createLoanSchema>;
```

Run: `npx vitest run src/server/validation/loan.test.ts`
Expected: PASS.

- [x] **Step 5: Tulis uji integrasi `createLoan` yang gagal**

Buat `tests/integration/loans.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { auditLogs, bookCopies, books, loanItems, loans, students } from '@/server/db/schema';
import { createLoan } from '@/server/services/loans';
import { circulationFixture, seedLoan, TODAY } from './circulation-fixture';
import { withRollback } from './helpers';

describe('createLoan — jalur normal', () => {
  it('mencatat peminjaman, mengubah eksemplar menjadi DIPINJAM, dan menulis audit', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      const copyIds = [fx.copies[0].id, fx.copies[1].id];

      const result = await createLoan({ studentId: fx.students[0].id, copyIds, notes: 'UJI catatan' }, fx.actor, TODAY, tx);

      if (!result.ok) throw new Error(JSON.stringify(result));
      expect(result).toEqual({ ok: true, id: result.id, transactionNumber: 'PJM-20900302-0001', dueDate: '2090-03-05' });

      const [loan] = await tx.select().from(loans).where(eq(loans.id, result.id));
      expect(loan).toMatchObject({
        studentId: fx.students[0].id,
        studentClass: 'XI UJI 1',
        academicYearId: fx.yearId,
        loanDate: TODAY,
        dueDate: '2090-03-05',
        status: 'AKTIF',
        notes: 'UJI catatan',
        createdBy: fx.actor.id,
      });

      const items = await tx.select({ copyId: loanItems.bookCopyId }).from(loanItems).where(eq(loanItems.loanId, result.id));
      expect(items.map((item) => item.copyId).sort()).toEqual([...copyIds].sort());

      const copies = await tx.select({ status: bookCopies.status }).from(bookCopies).where(inArray(bookCopies.id, copyIds));
      expect(copies.map((copy) => copy.status)).toEqual(['DIPINJAM', 'DIPINJAM']);

      const [audit] = await tx
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.entityId, result.id), eq(auditLogs.action, 'loan.create')));
      expect(audit?.metadata).toEqual({
        transactionNumber: 'PJM-20900302-0001',
        studentNis: 'UJI-S1',
        barcodes: ['UJI-SRK-01', 'UJI-SRK-02'],
        dueDate: '2090-03-05',
      });
    });
  });

  it('memberi nomor urut berikutnya untuk transaksi kedua di hari yang sama', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      await createLoan({ studentId: fx.students[0].id, copyIds: [fx.copies[0].id], notes: null }, fx.actor, TODAY, tx);

      const second = await createLoan({ studentId: fx.students[1].id, copyIds: [fx.copies[1].id], notes: null }, fx.actor, TODAY, tx);

      expect(second).toMatchObject({ ok: true, transactionNumber: 'PJM-20900302-0002' });
    });
  });
});

describe('createLoan — penolakan', () => {
  it('menolak eksemplar yang sedang dipinjam, menyebut peminjamnya, dan tidak menulis apa pun', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      await createLoan({ studentId: fx.students[0].id, copyIds: [fx.copies[0].id], notes: null }, fx.actor, TODAY, tx);

      const result = await createLoan({ studentId: fx.students[1].id, copyIds: [fx.copies[0].id], notes: null }, fx.actor, TODAY, tx);

      expect(result).toEqual({
        ok: false,
        violations: [{
          code: 'COPY_UNAVAILABLE',
          barcode: 'UJI-SRK-01',
          bookTitle: 'UJI-Buku Sirkulasi',
          status: 'DIPINJAM',
          borrowedBy: { name: 'UJI Siswa Satu', nis: 'UJI-S1', dueDate: '2090-03-05' },
        }],
      });
      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(loans)
        .where(eq(loans.studentId, fx.students[1].id));
      expect(count).toBe(0);
    });
  });

  it('menolak permintaan yang melebihi kuota', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      await createLoan({
        studentId: fx.students[0].id, copyIds: [fx.copies[0].id, fx.copies[1].id, fx.copies[2].id], notes: null,
      }, fx.actor, TODAY, tx);

      const result = await createLoan({ studentId: fx.students[0].id, copyIds: [fx.copies[3].id], notes: null }, fx.actor, TODAY, tx);

      expect(result).toEqual({
        ok: false,
        violations: [{
          code: 'QUOTA_EXCEEDED', studentName: 'UJI Siswa Satu', activeCount: 3, requestedCount: 1, maxActiveLoans: 3,
        }],
      });
    });
  });

  it('menolak siswa yang punya pinjaman terlambat', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      const late = await seedLoan(tx, fx, { student: 0, copies: [0], loanDate: '2090-02-20', dueDate: '2090-02-23' });

      const result = await createLoan({ studentId: fx.students[0].id, copyIds: [fx.copies[1].id], notes: null }, fx.actor, TODAY, tx);

      expect(result).toEqual({
        ok: false,
        violations: [{
          code: 'HAS_OVERDUE', studentName: 'UJI Siswa Satu', transactionNumber: late.transactionNumber, daysLate: 7,
        }],
      });
    });
  });

  it('menolak eksemplar milik buku nonaktif (spec 5.2 BOOK_INACTIVE)', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      await tx.update(books).set({ status: 'inactive' }).where(eq(books.id, fx.bookId));

      const result = await createLoan({ studentId: fx.students[0].id, copyIds: [fx.copies[0].id], notes: null }, fx.actor, TODAY, tx);

      expect(result).toEqual({
        ok: false,
        violations: [{ code: 'BOOK_INACTIVE', barcode: 'UJI-SRK-01', bookTitle: 'UJI-Buku Sirkulasi' }],
      });
    });
  });

  it('menolak bila tidak ada tahun ajaran aktif', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      await tx.execute(sql`update academic_years set is_active = false`);

      const result = await createLoan({ studentId: fx.students[0].id, copyIds: [fx.copies[0].id], notes: null }, fx.actor, TODAY, tx);

      expect(result).toEqual({ ok: false, violations: [{ code: 'NO_ACTIVE_YEAR' }] });
    });
  });

  it('menolak siswa nonaktif dan eksemplar yang dimasukkan dua kali', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      await tx.update(students).set({ status: 'inactive' }).where(eq(students.id, fx.students[0].id));

      const result = await createLoan({
        studentId: fx.students[0].id, copyIds: [fx.copies[0].id, fx.copies[0].id], notes: null,
      }, fx.actor, TODAY, tx);

      expect(result).toEqual({
        ok: false,
        violations: [
          { code: 'STUDENT_INACTIVE', studentName: 'UJI Siswa Satu' },
          { code: 'DUPLICATE_COPY', barcode: 'UJI-SRK-01', bookTitle: 'UJI-Buku Sirkulasi' },
        ],
      });
    });
  });

  it('menjelaskan siswa atau eksemplar yang tidak ditemukan', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);

      expect(await createLoan({ studentId: crypto.randomUUID(), copyIds: [fx.copies[0].id], notes: null }, fx.actor, TODAY, tx))
        .toEqual({ ok: false, message: 'Siswa tidak ditemukan. Cari ulang siswa dengan NIS atau nama.' });
      expect(await createLoan({ studentId: fx.students[0].id, copyIds: [crypto.randomUUID()], notes: null }, fx.actor, TODAY, tx))
        .toEqual({ ok: false, message: 'Salah satu eksemplar tidak ditemukan. Pindai ulang barcode bukunya.' });
    });
  });
});
```

Run: `npx vitest run --config vitest.integration.config.ts tests/integration/loans.test.ts`
Expected: FAIL — modul `@/server/services/loans` tidak ditemukan.

- [x] **Step 6: Implementasikan `createLoan`**

Buat `src/server/services/loans.ts`:

```ts
import { asc, eq, inArray, sql } from 'drizzle-orm';
import { calculateDueDate } from '@/domain/loan/due-date';
import { validateLoanRequest } from '@/domain/loan/rules';
import { formatTransactionNumber, loanCounterScope } from '@/domain/loan/transaction-number';
import type { IsoDate } from '@/domain/shared/date';
import type { Actor, CopySnapshot } from '@/domain/shared/types';
import type { Violation } from '@/domain/shared/violations';
import { writeAudit } from '@/server/audit';
import { db } from '@/server/db/client';
import { uniqueViolation } from '@/server/db/errors';
import type { Executor, Transaction } from '@/server/db/executor';
import { bookCopies, books, counters, loanItems, loans, students } from '@/server/db/schema';
import { getActiveAcademicYear } from '@/server/queries/academic-years';
import { borrowersOf, loadBorrowerLoans } from '@/server/queries/circulation';
import { getLibrarySettings } from '@/server/queries/settings';
import { isUuid } from '@/server/validation/common';
import type { CreateLoanInput } from '@/server/validation/loan';

export type LoanResult =
  | { ok: true; id: string; transactionNumber: string; dueDate: IsoDate }
  | { ok: false; violations: Violation[] }
  | { ok: false; message: string };

const STUDENT_NOT_FOUND = 'Siswa tidak ditemukan. Cari ulang siswa dengan NIS atau nama.';
const COPY_NOT_FOUND = 'Salah satu eksemplar tidak ditemukan. Pindai ulang barcode bukunya.';
const COPY_RACE = 'Salah satu eksemplar baru saja dipinjam di transaksi lain. Periksa daftar buku lalu simpan kembali.';

/**
 * Spec 6.1 langkah 3, inti pertahanan integritas: seluruh eksemplar yang
 * diminta dikunci `FOR UPDATE` dan statusnya dibaca DI PERNYATAAN YANG SAMA.
 * Petugas kedua yang meminta eksemplar yang sama menunggu kunci dilepas, lalu
 * membaca status terbaru. Urutan kunci menurut id mencegah deadlock antara
 * dua transaksi yang meminta beberapa eksemplar yang sama.
 *
 * Mengembalikan snapshot dalam urutan permintaan (termasuk duplikat, agar
 * domain dapat melaporkan DUPLICATE_COPY), atau null bila ada yang tidak ada.
 */
async function lockRequestedCopies(tx: Transaction, copyIds: string[]): Promise<CopySnapshot[] | null> {
  const unique = [...new Set(copyIds)];
  if (unique.length === 0) return [];
  if (!unique.every((id) => isUuid(id))) return null;

  const rows = await tx
    .select({
      id: bookCopies.id,
      barcode: bookCopies.barcode,
      status: bookCopies.status,
      bookTitle: books.title,
      bookStatus: books.status,
    })
    .from(bookCopies)
    .innerJoin(books, eq(books.id, bookCopies.bookId))
    .where(inArray(bookCopies.id, unique))
    .orderBy(asc(bookCopies.id))
    .for('update', { of: bookCopies });
  if (rows.length !== unique.length) return null;

  const borrowers = await borrowersOf(rows.filter((row) => row.status === 'DIPINJAM').map((row) => row.id), tx);
  const byId = new Map<string, CopySnapshot>(rows.map((row) => {
    const borrowedBy = borrowers.get(row.id);
    return [row.id, borrowedBy ? { ...row, borrowedBy } : row];
  }));
  return copyIds.flatMap((id) => {
    const copy = byId.get(id);
    return copy ? [copy] : [];
  });
}

/**
 * Spec 6.3: nomor urut harian dari baris counter yang terkunci sampai commit.
 * `count(*)` transaksi hari ini rawan tabrakan di bawah konkurensi.
 */
async function nextLoanSequence(tx: Transaction, date: IsoDate): Promise<number> {
  const [row] = await tx
    .insert(counters)
    .values({ scope: loanCounterScope(date), value: 1 })
    .onConflictDoUpdate({ target: counters.scope, set: { value: sql`${counters.value} + 1` } })
    .returning({ value: counters.value });
  return row.value;
}

export async function createLoan(
  input: CreateLoanInput,
  actor: Actor,
  today: IsoDate,
  executor: Executor = db,
): Promise<LoanResult> {
  if (!isUuid(input.studentId)) return { ok: false, message: STUDENT_NOT_FOUND };
  try {
    return await executor.transaction(async (tx): Promise<LoanResult> => {
      // 1. Konfigurasi dan tahun ajaran aktif.
      const settings = await getLibrarySettings(tx);
      const activeYear = await getActiveAcademicYear(tx);

      // 2. Kunci siswa: dua peminjaman untuk siswa yang sama berjalan bergiliran,
      //    sehingga kuotanya tidak terlewati oleh dua petugas sekaligus.
      const [student] = await tx
        .select({
          id: students.id,
          nis: students.nis,
          name: students.name,
          className: students.className,
          status: students.status,
        })
        .from(students)
        .where(eq(students.id, input.studentId))
        .for('update');
      if (!student) return { ok: false, message: STUDENT_NOT_FOUND };
      const openLoans = await loadBorrowerLoans(student.id, tx);

      // 3. Kunci seluruh eksemplar yang diminta.
      const requestedCopies = await lockRequestedCopies(tx, input.copyIds);
      if (requestedCopies === null) return { ok: false, message: COPY_NOT_FOUND };

      // 4–5. Validasi dengan keadaan yang baru saja dibaca; belum ada yang ditulis.
      const verdict = validateLoanRequest({
        student,
        openLoans,
        requestedCopies,
        settings,
        hasActiveAcademicYear: activeYear !== null,
        today,
      });
      if (!verdict.ok) return { ok: false, violations: verdict.violations };
      // Tidak tercapai (domain sudah menolak NO_ACTIVE_YEAR); menyempitkan tipe.
      if (!activeYear) return { ok: false, violations: [{ code: 'NO_ACTIVE_YEAR' }] };

      // 6. Nomor transaksi.
      const transactionNumber = formatTransactionNumber(today, await nextLoanSequence(tx, today));
      const dueDate = calculateDueDate(today, settings.loanDurationDays);

      // 7. Pinjaman (dengan snapshot kelas) dan itemnya.
      const [loan] = await tx
        .insert(loans)
        .values({
          transactionNumber,
          studentId: student.id,
          studentClass: student.className,
          academicYearId: activeYear.id,
          loanDate: today,
          dueDate,
          notes: input.notes,
          createdBy: actor.id,
        })
        .returning({ id: loans.id });
      await tx.insert(loanItems).values(requestedCopies.map((copy) => ({ loanId: loan.id, bookCopyId: copy.id })));

      // 8. Status eksemplar.
      await tx
        .update(bookCopies)
        .set({ status: 'DIPINJAM', updatedAt: new Date() })
        .where(inArray(bookCopies.id, requestedCopies.map((copy) => copy.id)));

      // 9. Audit di transaksi yang sama.
      await writeAudit(tx, {
        actorId: actor.id,
        action: 'loan.create',
        entity: 'loans',
        entityId: loan.id,
        metadata: {
          transactionNumber,
          studentNis: student.nis,
          barcodes: requestedCopies.map((copy) => copy.barcode),
          dueDate,
        },
      });
      return { ok: true, id: loan.id, transactionNumber, dueDate };
    });
  } catch (error) {
    // Jaring pengaman tingkat database (spec 4.2); hanya tercapai bila
    // penguncian di atas cacat.
    if (uniqueViolation(error) === 'one_open_loan_per_copy') return { ok: false, message: COPY_RACE };
    throw error;
  }
}
```

- [x] **Step 7: Jalankan uji dan pastikan lulus**

Run: `npx vitest run --config vitest.integration.config.ts tests/integration/loans.test.ts`
Expected: seluruh uji PASS.

- [x] **Step 8: Tulis uji konkurensi**

Buat `tests/integration/loan-concurrency.test.ts`:

```ts
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
```

- [x] **Step 9: Jalankan uji konkurensi**

Run: `npx vitest run --config vitest.integration.config.ts tests/integration/loan-concurrency.test.ts`
Expected: 2 uji PASS dalam beberapa detik.

Bila uji pertama gagal dengan `sqlState` bernilai `null`, cetak `failure` di laporan: kemungkinan besar peminjaman kedua **tidak** tertahan (kunci `FOR UPDATE` tidak terpasang) — itu cacat `createLoan`, bukan cacat uji. Jangan menaikkan `lock_timeout` untuk "membuat lulus".

- [x] **Step 10: Jalankan seluruh uji, lint, dan tsc**

Run: `npm test && npm run test:integration && npm run lint && npx tsc --noEmit`
Expected: seluruhnya PASS/bersih.

- [x] **Step 11: Commit**

```bash
git add src/server/db/errors.ts src/server/db/errors.test.ts \
  src/server/validation/loan.ts src/server/validation/loan.test.ts src/server/services/loans.ts \
  tests/integration/loans.test.ts tests/integration/loan-concurrency.test.ts
git commit -m "$(cat <<'EOF'
feat(peminjaman): createLoan dengan kunci eksemplar dan bukti konkurensi

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Service Pengembalian dan Query Detail Pinjaman

`processReturn()` mengikuti spec 6.2: kunci pinjaman, item yang belum kembali, dan eksemplarnya; hitung denda per eksemplar dengan `calculateItemFine()`; simpan hasil per item; ubah status eksemplar lewat `nextCopyStatus()` (rusak/hilang tidak pernah kembali `TERSEDIA`, BR-07); hitung ulang `total_fine` dan status pinjaman; audit `return.process`. Pengembalian sebagian didukung.

Task ini juga membuat dua query yang dipakai layar pengembalian dan riwayat: detail satu pinjaman, dan pencarian pinjaman terbuka dengan satu kolom universal (nomor transaksi, NIS, nama, atau barcode).

**Files:**
- Create: `src/server/queries/loans.ts`
- Create: `src/server/validation/return.ts`, `src/server/validation/return.test.ts`
- Create: `src/server/services/returns.ts`
- Create: `tests/integration/returns.test.ts`, `tests/integration/loan-queries.test.ts`

**Interfaces:**
- Consumes: `calculateItemFine`, `nextCopyStatus`, `resolveLoanStatus`, `diffDays` (domain); `getLibrarySettings`; `openItemCounts` (Task 2); `containsPattern`; `formatRupiah`; `writeAudit`; `ok`/`fail`/`ServiceResult`; `createLoan` dan fixture (Task 2–3)
- Produces:
  - `interface LoanItemDetail { id: string; bookCopyId: string; barcode: string; bookTitle: string; bookPrice: number; returnedAt: Date | null; returnCondition: ReturnCondition | null; daysLate: number; lateFine: number; replacementFee: number; conditionNote: string | null }`
  - `interface LoanPaymentRow { id: string; amount: number; paidAt: Date; receivedByName: string; note: string | null }`
  - `interface LoanDetail { id; transactionNumber; status: LoanStatus; loanDate: string; dueDate: string; notes: string | null; studentId; studentName; studentNis; studentClass; academicYearName; createdByName; totalFine: number; paidTotal: number; unpaidFine: number; daysOverdue: number; items: LoanItemDetail[]; payments: LoanPaymentRow[] }` (seluruh id/nama bertipe `string`)
  - `getLoanDetail(id: string, today: IsoDate, executor?): Promise<LoanDetail | null>`
  - `interface ReturnCandidate { id: string; transactionNumber: string; studentName: string; studentNis: string; studentClass: string; loanDate: string; dueDate: string; openCount: number; daysOverdue: number }`
  - `findLoansForReturn(query: string, today: IsoDate, executor?): Promise<ReturnCandidate[]>` — maks. 20, hanya pinjaman yang masih punya item terbuka
  - `returnSchema`; `type ReturnInput = { loanId: string; items: { loanItemId: string; condition: ReturnCondition; replacementFee: number | null; note: string | null }[] }`
  - `processReturn(input: ReturnInput, actor: Actor, today: IsoDate, executor?): Promise<ServiceResult>` — `ok(loanId, notice)`; notice menyebut denda pengembalian KALI INI dan sisa tagihan transaksi (bukan denda kumulatif, I2 pada tinjauan akhir): `'Denda pengembalian ini Rp3.000. Sisa tagihan transaksi Rp43.000.'`, `'Tidak ada denda baru. Sisa tagihan transaksi Rp43.000.'`, atau `'Tidak ada denda baru.'` (sisa tagihan lunas)
  - Audit `return.process` (entity `loans`, metadata `{ transactionNumber, items: [{ barcode, condition, daysLate, lateFine, replacementFee }], totalFine, status }`)

- [x] **Step 1: Tulis uji validasi yang gagal**

Buat `src/server/validation/return.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { returnSchema } from './return';

const loanId = '6f1c2b1e-4b1a-4c3e-9f7a-2d1e3c4b5a6f';
const loanItemId = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

function messagesOf(result: z.ZodSafeParseResult<unknown>): string[] {
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe('returnSchema', () => {
  it('menerima item dengan biaya ganti dan catatan yang dirapikan', () => {
    expect(returnSchema.parse({
      loanId,
      items: [{ loanItemId, condition: 'RUSAK', replacementFee: 30000, note: '  sampul sobek ' }],
    })).toEqual({
      loanId,
      items: [{ loanItemId, condition: 'RUSAK', replacementFee: 30000, note: 'sampul sobek' }],
    });
  });

  it('menyimpan catatan kosong sebagai null', () => {
    const parsed = returnSchema.parse({ loanId, items: [{ loanItemId, condition: 'BAIK', replacementFee: null, note: '  ' }] });
    expect(parsed.items[0].note).toBeNull();
  });

  it('meminta minimal satu buku', () => {
    expect(messagesOf(returnSchema.safeParse({ loanId, items: [] })))
      .toEqual(['Centang minimal satu buku yang dikembalikan.']);
  });

  it('menolak kondisi dan biaya ganti yang tidak sah', () => {
    expect(messagesOf(returnSchema.safeParse({
      loanId, items: [{ loanItemId, condition: 'LECEK', replacementFee: -1, note: null }],
    }))).toEqual([
      'Kondisi harus Baik, Rusak, atau Hilang.',
      'Biaya ganti harus nominal rupiah bulat, misalnya 50000.',
    ]);
  });
});
```

Run: `npx vitest run src/server/validation/return.test.ts`
Expected: FAIL — modul `./return` tidak ditemukan.

- [x] **Step 2: Implementasikan validasi**

Buat `src/server/validation/return.ts`:

```ts
import { z } from 'zod';

const FEE = 'Biaya ganti harus nominal rupiah bulat, misalnya 50000.';

export const returnSchema = z.object({
  loanId: z.uuid('Transaksi tidak valid. Cari ulang transaksinya.'),
  items: z
    .array(
      z.object({
        loanItemId: z.uuid('Buku tidak valid. Muat ulang halaman.'),
        condition: z.enum(['BAIK', 'RUSAK', 'HILANG'], 'Kondisi harus Baik, Rusak, atau Hilang.'),
        // null berarti memakai harga katalog buku (spec 5.3).
        replacementFee: z.number({ error: FEE }).int(FEE).min(0, FEE).max(9_999_999_999, FEE).nullable(),
        note: z
          .string()
          .max(500, 'Catatan kondisi maksimal 500 karakter.')
          .nullable()
          .transform((value) => value?.trim() || null),
      }),
      { error: 'Data pengembalian tidak valid. Muat ulang halaman.' },
    )
    .min(1, 'Centang minimal satu buku yang dikembalikan.'),
});

export type ReturnInput = z.output<typeof returnSchema>;
```

Run: `npx vitest run src/server/validation/return.test.ts`
Expected: PASS.

- [x] **Step 3: Tulis uji integrasi pengembalian yang gagal**

Buat `tests/integration/returns.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { ReturnCondition } from '@/domain/shared/types';
import type { Transaction } from '@/server/db/executor';
import { auditLogs, bookCopies, loanItems, loans } from '@/server/db/schema';
import { getLoanDetail } from '@/server/queries/loans';
import { createLoan } from '@/server/services/loans';
import { processReturn } from '@/server/services/returns';
import { circulationFixture, TODAY, type CirculationFixture } from './circulation-fixture';
import { withRollback } from './helpers';

/** Pinjaman TODAY (jatuh tempo 2090-03-05) untuk siswa pertama. */
async function borrow(tx: Transaction, fx: CirculationFixture, copyIndexes: number[]) {
  const result = await createLoan({
    studentId: fx.students[0].id, copyIds: copyIndexes.map((index) => fx.copies[index].id), notes: null,
  }, fx.actor, TODAY, tx);
  if (!result.ok) throw new Error(JSON.stringify(result));
  const detail = await getLoanDetail(result.id, TODAY, tx);
  if (!detail) throw new Error('detail pinjaman tidak terbaca');
  return detail;
}

function item(loanItemId: string, condition: ReturnCondition = 'BAIK', replacementFee: number | null = null) {
  return { loanItemId, condition, replacementFee, note: null };
}

async function copyStatus(tx: Transaction, copyId: string) {
  const [copy] = await tx.select({ status: bookCopies.status }).from(bookCopies).where(eq(bookCopies.id, copyId));
  return copy?.status;
}

describe('processReturn', () => {
  it('menyelesaikan pinjaman yang kembali tepat waktu tanpa denda', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      const loan = await borrow(tx, fx, [0]);

      const result = await processReturn({ loanId: loan.id, items: [item(loan.items[0].id)] }, fx.actor, '2090-03-05', tx);

      expect(result).toEqual({ ok: true, id: loan.id, notice: 'Tidak ada denda.' });
      const [row] = await tx.select({ status: loans.status, totalFine: loans.totalFine }).from(loans).where(eq(loans.id, loan.id));
      expect(row).toEqual({ status: 'SELESAI', totalFine: '0.00' });
      expect(await copyStatus(tx, fx.copies[0].id)).toBe('TERSEDIA');
      const [returned] = await tx.select().from(loanItems).where(eq(loanItems.id, loan.items[0].id));
      expect(returned).toMatchObject({ returnCondition: 'BAIK', daysLate: 0, returnedBy: fx.actor.id });
      expect(returned?.returnedAt).toBeInstanceOf(Date);
    });
  });

  it('mendukung pengembalian sebagian lalu menyelesaikannya', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      const loan = await borrow(tx, fx, [0, 1]);
      const [first, second] = loan.items;

      await processReturn({ loanId: loan.id, items: [item(first.id)] }, fx.actor, TODAY, tx);
      let [row] = await tx.select({ status: loans.status }).from(loans).where(eq(loans.id, loan.id));
      expect(row?.status).toBe('SEBAGIAN_KEMBALI');
      expect(await copyStatus(tx, second.bookCopyId)).toBe('DIPINJAM');

      await processReturn({ loanId: loan.id, items: [item(second.id)] }, fx.actor, TODAY, tx);
      [row] = await tx.select({ status: loans.status }).from(loans).where(eq(loans.id, loan.id));
      expect(row?.status).toBe('SELESAI');
    });
  });

  it('menumpuk denda telat dan biaya ganti untuk buku rusak yang terlambat (spec 5.3)', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      const loan = await borrow(tx, fx, [0]);

      const result = await processReturn({
        loanId: loan.id,
        items: [{ loanItemId: loan.items[0].id, condition: 'RUSAK', replacementFee: null, note: 'UJI sampul sobek' }],
      }, fx.actor, '2090-03-09', tx);

      expect(result).toEqual({ ok: true, id: loan.id, notice: 'Total denda transaksi ini Rp54.000.' });
      const [returned] = await tx.select().from(loanItems).where(eq(loanItems.id, loan.items[0].id));
      expect(returned).toMatchObject({
        returnCondition: 'RUSAK', daysLate: 4, lateFine: '4000.00', replacementFee: '50000.00', conditionNote: 'UJI sampul sobek',
      });
      const [row] = await tx.select({ totalFine: loans.totalFine }).from(loans).where(eq(loans.id, loan.id));
      expect(row?.totalFine).toBe('54000.00');
      // BR-07: eksemplar rusak tidak kembali TERSEDIA secara otomatis.
      expect(await copyStatus(tx, fx.copies[0].id)).toBe('RUSAK');

      const [audit] = await tx
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.entityId, loan.id), eq(auditLogs.action, 'return.process')));
      expect(audit?.metadata).toEqual({
        transactionNumber: loan.transactionNumber,
        items: [{ barcode: 'UJI-SRK-01', condition: 'RUSAK', daysLate: 4, lateFine: 4000, replacementFee: 50000 }],
        totalFine: 54000,
        status: 'SELESAI',
      });
    });
  });

  it('memakai biaya ganti yang ditimpa petugas untuk buku hilang', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      const loan = await borrow(tx, fx, [0]);

      await processReturn({ loanId: loan.id, items: [item(loan.items[0].id, 'HILANG', 30000)] }, fx.actor, '2090-03-05', tx);

      const [returned] = await tx.select({ replacementFee: loanItems.replacementFee }).from(loanItems).where(eq(loanItems.id, loan.items[0].id));
      expect(returned?.replacementFee).toBe('30000.00');
      expect(await copyStatus(tx, fx.copies[0].id)).toBe('HILANG');
    });
  });

  it('menolak item yang sudah kembali atau bukan milik transaksi ini, tanpa mengubah apa pun', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      const loan = await borrow(tx, fx, [0, 1]);
      await processReturn({ loanId: loan.id, items: [item(loan.items[0].id)] }, fx.actor, TODAY, tx);

      const result = await processReturn({
        loanId: loan.id, items: [item(loan.items[0].id), item(loan.items[1].id)],
      }, fx.actor, TODAY, tx);

      expect(result).toEqual({
        ok: false,
        message: 'Salah satu buku sudah dikembalikan atau bukan bagian dari transaksi ini. Muat ulang halaman lalu pilih lagi.',
      });
      expect(await copyStatus(tx, loan.items[1].bookCopyId)).toBe('DIPINJAM');
    });
  });

  it('menolak transaksi yang sudah selesai, transaksi tak dikenal, dan pilihan kosong', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      const loan = await borrow(tx, fx, [0]);
      await processReturn({ loanId: loan.id, items: [item(loan.items[0].id)] }, fx.actor, TODAY, tx);

      expect(await processReturn({ loanId: loan.id, items: [item(loan.items[0].id)] }, fx.actor, TODAY, tx)).toEqual({
        ok: false, message: `Transaksi ${loan.transactionNumber} sudah selesai; seluruh bukunya sudah kembali.`,
      });
      expect(await processReturn({ loanId: crypto.randomUUID(), items: [item(loan.items[0].id)] }, fx.actor, TODAY, tx)).toEqual({
        ok: false, message: 'Transaksi tidak ditemukan. Cari ulang dengan nomor transaksi, NIS, atau barcode buku.',
      });
      expect(await processReturn({ loanId: loan.id, items: [] }, fx.actor, TODAY, tx)).toEqual({
        ok: false, message: 'Centang minimal satu buku yang dikembalikan.',
      });
    });
  });
});
```

Buat `tests/integration/loan-queries.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { finePayments } from '@/server/db/schema';
import { findLoansForReturn, getLoanDetail } from '@/server/queries/loans';
import { createLoan } from '@/server/services/loans';
import { processReturn } from '@/server/services/returns';
import { circulationFixture, TODAY } from './circulation-fixture';
import { withRollback } from './helpers';

describe('getLoanDetail', () => {
  it('memuat pinjaman, item, denda, dan pembayaran', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      const created = await createLoan({
        studentId: fx.students[0].id, copyIds: [fx.copies[0].id, fx.copies[1].id], notes: 'UJI catatan',
      }, fx.actor, TODAY, tx);
      if (!created.ok) throw new Error(JSON.stringify(created));
      const before = await getLoanDetail(created.id, TODAY, tx);
      await processReturn({
        loanId: created.id,
        items: [{ loanItemId: before!.items[0].id, condition: 'BAIK', replacementFee: null, note: null }],
      }, fx.actor, '2090-03-08', tx);
      await tx.insert(finePayments).values({ loanId: created.id, amount: '1000', receivedBy: fx.actor.id, note: 'UJI bayar' });

      const detail = await getLoanDetail(created.id, '2090-03-09', tx);

      expect(detail).toMatchObject({
        id: created.id,
        transactionNumber: 'PJM-20900302-0001',
        status: 'SEBAGIAN_KEMBALI',
        loanDate: TODAY,
        dueDate: '2090-03-05',
        notes: 'UJI catatan',
        studentId: fx.students[0].id,
        studentName: 'UJI Siswa Satu',
        studentNis: 'UJI-S1',
        studentClass: 'XI UJI 1',
        academicYearName: 'UJI-2089/2090',
        totalFine: 3000,
        paidTotal: 1000,
        unpaidFine: 2000,
        daysOverdue: 4,
      });
      expect(detail?.items.map((row) => [row.barcode, row.bookTitle, row.bookPrice, row.daysLate, row.lateFine])).toEqual([
        ['UJI-SRK-01', 'UJI-Buku Sirkulasi', 50000, 3, 3000],
        ['UJI-SRK-02', 'UJI-Buku Sirkulasi', 50000, 0, 0],
      ]);
      expect(detail?.items[0].returnedAt).toBeInstanceOf(Date);
      expect(detail?.items[1].returnedAt).toBeNull();
      expect(detail?.payments).toEqual([
        expect.objectContaining({ amount: 1000, note: 'UJI bayar', paidAt: expect.any(Date) }),
      ]);
    });
  });

  it('mengembalikan null untuk id yang tidak ada atau bukan UUID', async () => {
    await withRollback(async (tx) => {
      expect(await getLoanDetail(crypto.randomUUID(), TODAY, tx)).toBeNull();
      expect(await getLoanDetail('bukan-uuid', TODAY, tx)).toBeNull();
    });
  });
});

describe('findLoansForReturn', () => {
  it('menemukan pinjaman terbuka lewat nomor transaksi, NIS, nama, atau barcode', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      const created = await createLoan({
        studentId: fx.students[0].id, copyIds: [fx.copies[0].id, fx.copies[1].id], notes: null,
      }, fx.actor, TODAY, tx);
      if (!created.ok) throw new Error(JSON.stringify(created));

      const expected = {
        id: created.id,
        transactionNumber: 'PJM-20900302-0001',
        studentName: 'UJI Siswa Satu',
        studentNis: 'UJI-S1',
        studentClass: 'XI UJI 1',
        loanDate: TODAY,
        dueDate: '2090-03-05',
        openCount: 2,
        daysOverdue: 2,
      };
      for (const query of ['pjm-20900302-0001', 'UJI-S1', 'siswa satu', 'uji-srk-02']) {
        expect(await findLoansForReturn(query, '2090-03-07', tx)).toEqual([expected]);
      }
    });
  });

  it('tidak menampilkan pinjaman yang seluruh bukunya sudah kembali', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      const created = await createLoan({ studentId: fx.students[0].id, copyIds: [fx.copies[0].id], notes: null }, fx.actor, TODAY, tx);
      if (!created.ok) throw new Error(JSON.stringify(created));
      const detail = await getLoanDetail(created.id, TODAY, tx);
      await processReturn({
        loanId: created.id, items: [{ loanItemId: detail!.items[0].id, condition: 'BAIK', replacementFee: null, note: null }],
      }, fx.actor, TODAY, tx);

      expect(await findLoansForReturn('UJI-S1', TODAY, tx)).toEqual([]);
      expect(await findLoansForReturn('   ', TODAY, tx)).toEqual([]);
    });
  });
});
```

Run: `npx vitest run --config vitest.integration.config.ts tests/integration/returns.test.ts tests/integration/loan-queries.test.ts`
Expected: FAIL — modul `@/server/queries/loans` tidak ditemukan.

- [x] **Step 4: Implementasikan query pinjaman**

Buat `src/server/queries/loans.ts`:

```ts
import { and, asc, eq, ilike, inArray, isNull, or } from 'drizzle-orm';
import { diffDays, type IsoDate } from '@/domain/shared/date';
import type { LoanStatus, ReturnCondition } from '@/domain/shared/types';
import { db } from '@/server/db/client';
import type { Executor } from '@/server/db/executor';
import {
  academicYears, bookCopies, books, finePayments, loanItems, loans, profiles, students,
} from '@/server/db/schema';
import { isUuid } from '@/server/validation/common';
import { containsPattern } from './like';
import { openItemCounts } from './loan-aggregates';

export interface LoanItemDetail {
  id: string;
  bookCopyId: string;
  barcode: string;
  bookTitle: string;
  /** Harga katalog saat ini, dasar biaya ganti yang dapat ditimpa petugas. */
  bookPrice: number;
  returnedAt: Date | null;
  returnCondition: ReturnCondition | null;
  daysLate: number;
  lateFine: number;
  replacementFee: number;
  conditionNote: string | null;
}

export interface LoanPaymentRow {
  id: string;
  amount: number;
  paidAt: Date;
  receivedByName: string;
  note: string | null;
}

export interface LoanDetail {
  id: string;
  transactionNumber: string;
  status: LoanStatus;
  loanDate: string;
  dueDate: string;
  notes: string | null;
  studentId: string;
  studentName: string;
  studentNis: string;
  /** Snapshot kelas saat meminjam (spec 4.2), bukan kelas siswa sekarang. */
  studentClass: string;
  academicYearName: string;
  createdByName: string;
  totalFine: number;
  paidTotal: number;
  unpaidFine: number;
  /** 0 bila tidak terlambat atau seluruh bukunya sudah kembali. */
  daysOverdue: number;
  items: LoanItemDetail[];
  payments: LoanPaymentRow[];
}

/** Keterlambatan dihitung saat dibaca, tidak pernah disimpan (spec 4.2). */
function overdueDays(status: LoanStatus, dueDate: IsoDate, today: IsoDate): number {
  return status === 'SELESAI' ? 0 : Math.max(0, diffDays(dueDate, today));
}

export async function getLoanDetail(id: string, today: IsoDate, executor: Executor = db): Promise<LoanDetail | null> {
  if (!isUuid(id)) return null;
  const [loan] = await executor
    .select({
      id: loans.id,
      transactionNumber: loans.transactionNumber,
      status: loans.status,
      loanDate: loans.loanDate,
      dueDate: loans.dueDate,
      notes: loans.notes,
      studentId: students.id,
      studentName: students.name,
      studentNis: students.nis,
      studentClass: loans.studentClass,
      academicYearName: academicYears.name,
      createdByName: profiles.fullName,
      totalFine: loans.totalFine,
    })
    .from(loans)
    .innerJoin(students, eq(students.id, loans.studentId))
    .innerJoin(academicYears, eq(academicYears.id, loans.academicYearId))
    .innerJoin(profiles, eq(profiles.id, loans.createdBy))
    .where(eq(loans.id, id))
    .limit(1);
  if (!loan) return null;

  const itemRows = await executor
    .select({
      id: loanItems.id,
      bookCopyId: loanItems.bookCopyId,
      barcode: bookCopies.barcode,
      bookTitle: books.title,
      bookPrice: books.price,
      returnedAt: loanItems.returnedAt,
      returnCondition: loanItems.returnCondition,
      daysLate: loanItems.daysLate,
      lateFine: loanItems.lateFine,
      replacementFee: loanItems.replacementFee,
      conditionNote: loanItems.conditionNote,
    })
    .from(loanItems)
    .innerJoin(bookCopies, eq(bookCopies.id, loanItems.bookCopyId))
    .innerJoin(books, eq(books.id, bookCopies.bookId))
    .where(eq(loanItems.loanId, id))
    .orderBy(asc(bookCopies.barcode));

  const paymentRows = await executor
    .select({
      id: finePayments.id,
      amount: finePayments.amount,
      paidAt: finePayments.paidAt,
      receivedByName: profiles.fullName,
      note: finePayments.note,
    })
    .from(finePayments)
    .innerJoin(profiles, eq(profiles.id, finePayments.receivedBy))
    .where(eq(finePayments.loanId, id))
    .orderBy(asc(finePayments.paidAt));

  const items = itemRows.map((row) => ({
    ...row,
    bookPrice: Number(row.bookPrice),
    lateFine: Number(row.lateFine),
    replacementFee: Number(row.replacementFee),
  }));
  const payments = paymentRows.map((row) => ({ ...row, amount: Number(row.amount) }));
  const totalFine = Number(loan.totalFine);
  const paidTotal = payments.reduce((sum, payment) => sum + payment.amount, 0);

  return {
    ...loan,
    totalFine,
    paidTotal,
    unpaidFine: Math.max(0, totalFine - paidTotal),
    daysOverdue: overdueDays(loan.status, loan.dueDate, today),
    items,
    payments,
  };
}

export interface ReturnCandidate {
  id: string;
  transactionNumber: string;
  studentName: string;
  studentNis: string;
  studentClass: string;
  loanDate: string;
  dueDate: string;
  openCount: number;
  daysOverdue: number;
}

const CANDIDATE_LIMIT = 20;

/**
 * Satu kolom pencarian universal di layar pengembalian (spec 8.3). Alih-alih
 * menebak jenis masukan, keempat kemungkinan dicocokkan sekaligus: nomor
 * transaksi, NIS, sebagian nama, atau barcode buku yang belum kembali.
 * Petugas tidak perlu memilih mode. Hanya pinjaman yang masih punya buku
 * belum kembali yang tampil.
 */
export async function findLoansForReturn(
  query: string,
  today: IsoDate,
  executor: Executor = db,
): Promise<ReturnCandidate[]> {
  const keyword = query.trim();
  if (!keyword) return [];
  const upper = keyword.toUpperCase();
  const openItems = openItemCounts(executor);
  const byBarcode = executor
    .select({ loanId: loanItems.loanId })
    .from(loanItems)
    .innerJoin(bookCopies, eq(bookCopies.id, loanItems.bookCopyId))
    .where(and(isNull(loanItems.returnedAt), eq(bookCopies.barcode, upper)));

  const rows = await executor
    .select({
      id: loans.id,
      transactionNumber: loans.transactionNumber,
      studentName: students.name,
      studentNis: students.nis,
      studentClass: loans.studentClass,
      loanDate: loans.loanDate,
      dueDate: loans.dueDate,
      status: loans.status,
      openCount: openItems.openCount,
    })
    .from(loans)
    .innerJoin(students, eq(students.id, loans.studentId))
    .innerJoin(openItems, eq(openItems.loanId, loans.id))
    .where(or(
      eq(loans.transactionNumber, upper),
      eq(students.nis, keyword),
      ilike(students.name, containsPattern(keyword)),
      inArray(loans.id, byBarcode),
    ))
    .orderBy(asc(loans.dueDate), asc(loans.transactionNumber))
    .limit(CANDIDATE_LIMIT);

  return rows.map(({ status, ...row }) => ({
    ...row,
    openCount: Number(row.openCount),
    daysOverdue: overdueDays(status, row.dueDate, today),
  }));
}
```

- [x] **Step 5: Implementasikan `processReturn`**

Buat `src/server/services/returns.ts`:

```ts
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
```

- [x] **Step 6: Jalankan uji dan pastikan lulus**

Run: `npx vitest run --config vitest.integration.config.ts tests/integration/returns.test.ts tests/integration/loan-queries.test.ts`
Expected: seluruh uji PASS.

- [x] **Step 7: Jalankan seluruh uji, lint, dan tsc**

Run: `npm test && npm run test:integration && npm run lint && npx tsc --noEmit`
Expected: seluruhnya PASS/bersih. (Uji integrasi memakai `detail!` pada hasil yang baru dibuat; bila lint melarang non-null assertion di `tests/`, ganti dengan pemeriksaan `if (!detail) throw …`.)

- [x] **Step 8: Commit**

```bash
git add src/server/queries/loans.ts src/server/validation/return.ts src/server/validation/return.test.ts \
  src/server/services/returns.ts tests/integration/returns.test.ts tests/integration/loan-queries.test.ts
git commit -m "$(cat <<'EOF'
feat(pengembalian): processReturn dengan denda per eksemplar dan pengembalian sebagian

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Pelunasan Denda

Spec 5.4: setiap penekanan "Tandai Lunas" menulis satu baris `fine_payments`; status lunas dihitung (total pembayaran ≥ `total_fine`), tidak disimpan. Pembayaran sebagian diizinkan; nominal di atas sisa tagihan ditolak.

**Files:**
- Create: `src/server/validation/fine.ts`, `src/server/validation/fine.test.ts`
- Create: `src/server/services/fines.ts`
- Create: `src/server/actions/fines.ts`, `src/server/actions/fines.test.ts`
- Create: `tests/integration/fines.test.ts`

**Interfaces:**
- Consumes: `requiredText`, `optionalText`, `rupiah`, `isUuid` (common.ts); `formatRupiah`; `writeAudit`; `ok`/`fail`/`ServiceResult`; `runFormAction`; `createLoan`, `processReturn`, `getLoanDetail`, fixture (Task 2–4)
- Produces:
  - `finePaymentSchema`; `type FinePaymentInput = { amount: number; note: string | null }`
  - `payFine(loanId: string, input: FinePaymentInput, actor: Actor, executor?): Promise<ServiceResult>` — notice `'Sisa tagihan Rp2.500.'` atau `'Denda lunas.'`
  - `payFineAction(loanId: string, state: FormState, formData: FormData): Promise<FormState>` — kembali ke `/transaksi/riwayat/<loanId>` dengan `?pesan=`
  - Audit `fine.pay` (entity `loans`, metadata `{ transactionNumber, amount, remaining }`)

- [x] **Step 1: Tulis uji validasi yang gagal**

Buat `src/server/validation/fine.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { finePaymentSchema } from './fine';

function messagesOf(result: z.ZodSafeParseResult<unknown>): string[] {
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe('finePaymentSchema', () => {
  it('menerima nominal bertitik ribuan dan catatan kosong sebagai null', () => {
    expect(finePaymentSchema.parse({ amount: '4.000', note: '' })).toEqual({ amount: 4000, note: null });
  });

  it('mewajibkan nominal dan menolak nol', () => {
    expect(messagesOf(finePaymentSchema.safeParse({ amount: '', note: '' }))).toEqual(['Nominal pembayaran wajib diisi.']);
    expect(messagesOf(finePaymentSchema.safeParse({ amount: '0', note: '' }))).toEqual(['Nominal pembayaran minimal Rp1.']);
  });

  it('menolak nominal yang bukan angka', () => {
    expect(messagesOf(finePaymentSchema.safeParse({ amount: 'empat ribu', note: '' })))
      .toEqual(['Nominal pembayaran harus berupa angka rupiah, misalnya 5.000.']);
  });
});
```

Run: `npx vitest run src/server/validation/fine.test.ts`
Expected: FAIL — modul `./fine` tidak ditemukan.

- [x] **Step 2: Implementasikan validasi**

Buat `src/server/validation/fine.ts`:

```ts
import { z } from 'zod';
import { optionalText, requiredText, rupiah } from './common';

const AMOUNT = 'Nominal pembayaran harus berupa angka rupiah, misalnya 5.000.';

export const finePaymentSchema = z.object({
  amount: requiredText('Nominal pembayaran wajib diisi.', 20)
    // Pelebar tipe saja, sama seperti settingsSchema: `.pipe()` zod 4.6
    // menuntut tipe masukan rupiah() (string | undefined) persis sama.
    .transform((value): string | undefined => value)
    .pipe(rupiah(AMOUNT))
    .pipe(z.number().min(1, 'Nominal pembayaran minimal Rp1.')),
  note: optionalText(200),
});

export type FinePaymentInput = z.output<typeof finePaymentSchema>;
```

Run: `npx vitest run src/server/validation/fine.test.ts`
Expected: PASS.

- [x] **Step 3: Tulis uji integrasi yang gagal**

Buat `tests/integration/fines.test.ts`:

```ts
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
```

Run: `npx vitest run --config vitest.integration.config.ts tests/integration/fines.test.ts`
Expected: FAIL — modul `@/server/services/fines` tidak ditemukan.

- [x] **Step 4: Implementasikan `payFine`**

Buat `src/server/services/fines.ts`:

```ts
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
```

Run: `npx vitest run --config vitest.integration.config.ts tests/integration/fines.test.ts`
Expected: PASS.

- [x] **Step 5: Tulis uji Server Action yang gagal**

Buat `src/server/actions/fines.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDLE } from '@/lib/form-state';

const { mockRunFormAction, mockPayFine } = vi.hoisted(() => ({
  mockRunFormAction: vi.fn(),
  mockPayFine: vi.fn(),
}));

vi.mock('@/server/forms/run-action', () => ({ runFormAction: mockRunFormAction }));
vi.mock('@/server/services/fines', () => ({ payFine: mockPayFine }));

import { payFineAction } from './fines';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('payFineAction', () => {
  it('terbuka untuk admin dan petugas, lalu kembali ke detail transaksi agar pesannya tetap terlihat', async () => {
    await payFineAction('loan-1', IDLE, new FormData());

    const options = mockRunFormAction.mock.calls[0]?.[0];
    expect(options.roles).toEqual(['admin', 'petugas']);
    // Form pelunasan hilang setelah lunas; pesan sukses dibawa lewat ?pesan=.
    expect(options.redirectTo).toBe('/transaksi/riwayat/loan-1');
    expect(options.revalidate).toEqual(['/transaksi/riwayat', '/transaksi/riwayat/loan-1']);

    const actor = { id: 'u1', role: 'petugas' as const };
    await options.execute({ amount: 4000, note: null }, actor);
    expect(mockPayFine).toHaveBeenCalledWith('loan-1', { amount: 4000, note: null }, actor);
  });
});
```

Run: `npx vitest run src/server/actions/fines.test.ts`
Expected: FAIL — modul `./fines` tidak ditemukan.

- [x] **Step 6: Implementasikan Server Action**

Buat `src/server/actions/fines.ts`:

```ts
'use server';

import type { FormState } from '@/lib/form-state';
import { runFormAction } from '@/server/forms/run-action';
import { payFine } from '@/server/services/fines';
import { finePaymentSchema } from '@/server/validation/fine';

export async function payFineAction(loanId: string, _state: FormState, formData: FormData): Promise<FormState> {
  const detail = `/transaksi/riwayat/${loanId}`;
  return runFormAction({
    roles: ['admin', 'petugas'],
    schema: finePaymentSchema,
    formData,
    invalidMessage: 'Pembayaran denda belum dapat dicatat. Periksa kolom yang ditandai.',
    execute: (data, actor) => payFine(loanId, data, actor),
    successMessage: 'Pembayaran denda tercatat.',
    revalidate: ['/transaksi/riwayat', detail],
    redirectTo: detail,
  });
}
```

Run: `npx vitest run src/server/actions/fines.test.ts`
Expected: PASS.

- [x] **Step 7: Jalankan seluruh uji unit, lint, dan tsc**

Run: `npm test && npm run lint && npx tsc --noEmit`
Expected: PASS/bersih.

- [x] **Step 8: Commit**

```bash
git add src/server/validation/fine.ts src/server/validation/fine.test.ts src/server/services/fines.ts \
  src/server/actions/fines.ts src/server/actions/fines.test.ts tests/integration/fines.test.ts
git commit -m "$(cat <<'EOF'
feat(denda): tandai denda lunas, penuh maupun sebagian

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Riwayat Transaksi

Daftar seluruh peminjaman dengan pencarian dan filter status (termasuk "Terlambat" dan "Denda belum lunas" yang dihitung saat dibaca), serta halaman detail yang menampilkan buku, pengembalian, denda, pembayaran, dan form "Tandai Lunas" (spec 5.4). Halaman detail menjadi tujuan setelah peminjaman dan pengembalian disimpan (Task 7–8).

**Files:**
- Create: `src/lib/circulation-labels.ts`, `src/lib/circulation-labels.test.ts`
- Modify: `src/server/queries/loans.ts` (tambah `listLoans`), `tests/integration/loan-queries.test.ts`
- Create: `src/components/ui/loan-status-badge.tsx`, `src/components/ui/loan-status-badge.test.tsx`
- Create: `src/app/(app)/transaksi/riwayat/page.tsx`, `page.test.tsx`
- Create: `src/app/(app)/transaksi/riwayat/[id]/page.tsx`, `[id]/page.test.tsx`

**Interfaces:**
- Consumes: `getLoanDetail`, `LoanDetail` (Task 4); `openItemCounts`, `paidTotals` (Task 2); `payFineAction` (Task 5); `schoolToday`, `formatSchoolDateTime` (Task 1); `formatDate`, `formatRupiah`; `firstValue`, `SearchParams`; `parsePage`, `PAGE_SIZE`, `offsetOf`; `FilterBar`, `FilterSelect`, `Flash`, `PageHeader`, `Pagination`, `ScrollTable`, `TD`, `TH`, `ActionForm`, `TextField`, `buttonClass`
- Produces:
  - `type HistoryStatus = 'all' | 'open' | 'overdue' | 'unpaid' | 'done'`, `HISTORY_STATUS_OPTIONS: Option[]`, `parseHistoryStatus(value: string): HistoryStatus`
  - `RETURN_CONDITION_LABELS: Record<ReturnCondition, string>`, `RETURN_CONDITION_OPTIONS: Option[]`
  - `interface LoanRow { id; transactionNumber; loanDate; dueDate; status: LoanStatus; studentName; studentNis; studentClass; itemCount: number; openCount: number; totalFine: number; unpaidFine: number; daysOverdue: number }`
  - `listLoans(filter: { q: string; status: HistoryStatus; page: number }, today: IsoDate, executor?): Promise<{ rows: LoanRow[]; total: number }>`
  - `<LoanStatusBadge status daysOverdue />`
  - Rute `/transaksi/riwayat` dan `/transaksi/riwayat/[id]`

- [x] **Step 1: Tulis uji label yang gagal**

Buat `src/lib/circulation-labels.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  HISTORY_STATUS_OPTIONS, parseHistoryStatus, RETURN_CONDITION_LABELS, RETURN_CONDITION_OPTIONS,
} from './circulation-labels';

describe('filter status riwayat', () => {
  it('menawarkan semua status dengan "Semua" sebagai bawaan', () => {
    expect(HISTORY_STATUS_OPTIONS.map((option) => option.value)).toEqual(['all', 'open', 'overdue', 'unpaid', 'done']);
    expect(parseHistoryStatus('overdue')).toBe('overdue');
    expect(parseHistoryStatus('')).toBe('all');
    expect(parseHistoryStatus('hapus-semua')).toBe('all');
  });
});

describe('kondisi pengembalian', () => {
  it('memberi label Indonesia dengan urutan Baik, Rusak, Hilang', () => {
    expect(RETURN_CONDITION_LABELS.HILANG).toBe('Hilang');
    expect(RETURN_CONDITION_OPTIONS).toEqual([
      { value: 'BAIK', label: 'Baik' },
      { value: 'RUSAK', label: 'Rusak' },
      { value: 'HILANG', label: 'Hilang' },
    ]);
  });
});
```

Run: `npx vitest run src/lib/circulation-labels.test.ts`
Expected: FAIL — modul `./circulation-labels` tidak ditemukan.

- [x] **Step 2: Implementasikan label**

Buat `src/lib/circulation-labels.ts`:

```ts
import type { ReturnCondition } from '@/domain/shared/types';
import type { Option } from './options';

export type HistoryStatus = 'all' | 'open' | 'overdue' | 'unpaid' | 'done';

export const HISTORY_STATUS_OPTIONS: Option[] = [
  { value: 'all', label: 'Semua status' },
  { value: 'open', label: 'Masih dipinjam' },
  { value: 'overdue', label: 'Terlambat' },
  { value: 'unpaid', label: 'Denda belum lunas' },
  { value: 'done', label: 'Selesai' },
];

const HISTORY_STATUSES = new Set(HISTORY_STATUS_OPTIONS.map((option) => option.value));

/** Nilai dari URL dapat diubah siapa saja; yang tidak dikenal berarti "semua". */
export function parseHistoryStatus(value: string): HistoryStatus {
  return HISTORY_STATUSES.has(value) ? (value as HistoryStatus) : 'all';
}

export const RETURN_CONDITION_LABELS: Record<ReturnCondition, string> = {
  BAIK: 'Baik',
  RUSAK: 'Rusak',
  HILANG: 'Hilang',
};

export const RETURN_CONDITION_OPTIONS: Option[] = (['BAIK', 'RUSAK', 'HILANG'] as const).map((value) => ({
  value,
  label: RETURN_CONDITION_LABELS[value],
}));
```

Run: `npx vitest run src/lib/circulation-labels.test.ts`
Expected: PASS.

- [x] **Step 3: Tulis uji `listLoans` yang gagal**

Ubah impor di `tests/integration/loan-queries.test.ts` menjadi:

```ts
import { findLoansForReturn, getLoanDetail, listLoans } from '@/server/queries/loans';
import { circulationFixture, seedLoan, TODAY } from './circulation-fixture';
```

Lalu tambahkan di akhir berkas:

```ts
describe('listLoans', () => {
  it('menyaring menurut status yang dihitung saat dibaca dan mencari siswa', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      const late = await seedLoan(tx, fx, { student: 0, copies: [0], loanDate: '2090-02-20', dueDate: '2090-02-23' });
      const onTime = await seedLoan(tx, fx, { student: 1, copies: [1, 2], loanDate: TODAY, dueDate: '2090-03-05', returned: [2] });
      const unpaid = await seedLoan(tx, fx, { student: 1, copies: [3], loanDate: '2090-01-01', dueDate: '2090-01-04', returned: [3], totalFine: 2000 });

      const idsFor = async (status: 'all' | 'open' | 'overdue' | 'unpaid' | 'done', q = '') =>
        (await listLoans({ q, status, page: 1 }, TODAY, tx)).rows
          .map((row) => row.id)
          .filter((id) => [late.id, onTime.id, unpaid.id].includes(id));

      expect(await idsFor('open')).toEqual(expect.arrayContaining([late.id, onTime.id]));
      expect(await idsFor('open')).not.toContain(unpaid.id);
      expect(await idsFor('overdue')).toEqual([late.id]);
      expect(await idsFor('unpaid')).toEqual([unpaid.id]);
      expect(await idsFor('done')).toEqual([unpaid.id]);
      expect(await idsFor('all', 'uji siswa dua')).toEqual(expect.arrayContaining([onTime.id, unpaid.id]));
      expect(await idsFor('all', late.transactionNumber.toLowerCase())).toEqual([late.id]);
    });
  });

  it('merangkum jumlah buku, sisa denda, dan keterlambatan per baris', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      const partial = await seedLoan(tx, fx, {
        student: 0, copies: [0, 1], loanDate: '2090-02-20', dueDate: '2090-02-23', returned: [1], totalFine: 3000,
      });

      const { rows } = await listLoans({ q: partial.transactionNumber, status: 'all', page: 1 }, TODAY, tx);

      expect(rows).toEqual([{
        id: partial.id,
        transactionNumber: partial.transactionNumber,
        loanDate: '2090-02-20',
        dueDate: '2090-02-23',
        status: 'SEBAGIAN_KEMBALI',
        studentName: 'UJI Siswa Satu',
        studentNis: 'UJI-S1',
        studentClass: 'XI UJI 1',
        itemCount: 2,
        openCount: 1,
        totalFine: 3000,
        unpaidFine: 3000,
        daysOverdue: 7,
      }]);
    });
  });
});
```

Run: `npx vitest run --config vitest.integration.config.ts tests/integration/loan-queries.test.ts`
Expected: FAIL — `listLoans` tidak diekspor.

- [x] **Step 4: Implementasikan `listLoans`**

Di `src/server/queries/loans.ts`, ubah impor `drizzle-orm` menjadi `import { and, asc, desc, eq, ilike, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm';`, tambahkan `import type { HistoryStatus } from '@/lib/circulation-labels';`, `import { offsetOf, PAGE_SIZE } from '@/lib/pagination';`, dan ubah impor agregat menjadi `import { openItemCounts, paidTotals } from './loan-aggregates';`. Lalu tambahkan di akhir berkas:

```ts
export interface LoanRow {
  id: string;
  transactionNumber: string;
  loanDate: string;
  dueDate: string;
  status: LoanStatus;
  studentName: string;
  studentNis: string;
  studentClass: string;
  itemCount: number;
  openCount: number;
  totalFine: number;
  unpaidFine: number;
  daysOverdue: number;
}

export interface LoanFilter {
  q: string;
  status: HistoryStatus;
  page: number;
}

type PaidTotals = ReturnType<typeof paidTotals>;

/** Status "terlambat" dan "belum lunas" dihitung saat dibaca (spec 4.2, 5.4). */
function statusCondition(status: HistoryStatus, today: IsoDate, paid: PaidTotals) {
  switch (status) {
    case 'open':
      return ne(loans.status, 'SELESAI');
    case 'overdue':
      return and(ne(loans.status, 'SELESAI'), lt(loans.dueDate, today));
    case 'unpaid':
      return sql`${loans.totalFine} > coalesce(${paid.paid}, 0)`;
    case 'done':
      return eq(loans.status, 'SELESAI');
    case 'all':
      return undefined;
  }
}

export async function listLoans(
  filter: LoanFilter,
  today: IsoDate,
  executor: Executor = db,
): Promise<{ rows: LoanRow[]; total: number }> {
  const paid = paidTotals(executor);
  const itemCounts = executor
    .select({
      loanId: loanItems.loanId,
      itemCount: sql<number>`count(*)::int`.as('item_count'),
      openCount: sql<number>`(count(*) filter (where ${loanItems.returnedAt} is null))::int`.as('open_count'),
    })
    .from(loanItems)
    .groupBy(loanItems.loanId)
    .as('item_counts');

  const keyword = filter.q.trim();
  const where = and(
    keyword
      ? or(
          eq(loans.transactionNumber, keyword.toUpperCase()),
          eq(students.nis, keyword),
          ilike(students.name, containsPattern(keyword)),
        )
      : undefined,
    statusCondition(filter.status, today, paid),
  );

  const rows = await executor
    .select({
      id: loans.id,
      transactionNumber: loans.transactionNumber,
      loanDate: loans.loanDate,
      dueDate: loans.dueDate,
      status: loans.status,
      studentName: students.name,
      studentNis: students.nis,
      studentClass: loans.studentClass,
      itemCount: itemCounts.itemCount,
      openCount: itemCounts.openCount,
      totalFine: loans.totalFine,
      paid: sql<string>`coalesce(${paid.paid}, 0)`,
    })
    .from(loans)
    .innerJoin(students, eq(students.id, loans.studentId))
    .innerJoin(itemCounts, eq(itemCounts.loanId, loans.id))
    .leftJoin(paid, eq(paid.loanId, loans.id))
    .where(where)
    .orderBy(desc(loans.loanDate), desc(loans.transactionNumber))
    .limit(PAGE_SIZE)
    .offset(offsetOf(filter.page));

  const [{ total }] = await executor
    .select({ total: sql<number>`count(*)::int` })
    .from(loans)
    .innerJoin(students, eq(students.id, loans.studentId))
    .leftJoin(paid, eq(paid.loanId, loans.id))
    .where(where);

  return {
    rows: rows.map(({ paid: paidAmount, ...row }) => {
      const totalFine = Number(row.totalFine);
      return {
        ...row,
        itemCount: Number(row.itemCount),
        openCount: Number(row.openCount),
        totalFine,
        unpaidFine: Math.max(0, totalFine - Number(paidAmount)),
        daysOverdue: overdueDays(row.status, row.dueDate, today),
      };
    }),
    total: Number(total),
  };
}
```

Hapus `isNull` dan `inArray` dari impor bila lint menandainya tidak terpakai (keduanya masih dipakai `findLoansForReturn`, jadi seharusnya tetap).

Run: `npx vitest run --config vitest.integration.config.ts tests/integration/loan-queries.test.ts`
Expected: PASS.

- [x] **Step 5: Tulis uji badge yang gagal**

Buat `src/components/ui/loan-status-badge.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LoanStatusBadge } from './loan-status-badge';

describe('LoanStatusBadge', () => {
  it('menampilkan Terlambat beserta jumlah harinya untuk pinjaman terbuka yang lewat jatuh tempo', () => {
    const html = renderToStaticMarkup(<LoanStatusBadge status="SEBAGIAN_KEMBALI" daysOverdue={4} />);
    expect(html).toContain('Terlambat 4 hari');
  });

  it('menampilkan label status tersimpan bila tidak terlambat', () => {
    expect(renderToStaticMarkup(<LoanStatusBadge status="AKTIF" daysOverdue={0} />)).toContain('Dipinjam');
    expect(renderToStaticMarkup(<LoanStatusBadge status="SEBAGIAN_KEMBALI" daysOverdue={0} />)).toContain('Sebagian kembali');
    expect(renderToStaticMarkup(<LoanStatusBadge status="SELESAI" daysOverdue={0} />)).toContain('Selesai');
  });

  it('menyertakan ikon, tidak hanya warna (spec 8.1)', () => {
    expect(renderToStaticMarkup(<LoanStatusBadge status="AKTIF" daysOverdue={0} />)).toContain('aria-hidden="true"');
  });
});
```

Run: `npx vitest run src/components/ui/loan-status-badge.test.tsx`
Expected: FAIL — modul tidak ditemukan.

- [x] **Step 6: Implementasikan badge**

Buat `src/components/ui/loan-status-badge.tsx`:

```tsx
import type { LoanStatus } from '@/domain/shared/types';

const BASE = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium';
const LATE = 'bg-[var(--color-status-terlambat)]/10 text-[var(--color-status-terlambat)]';

const STYLES: Record<LoanStatus, { label: string; icon: string; className: string }> = {
  AKTIF: {
    label: 'Dipinjam',
    icon: '◐',
    className: 'bg-[var(--color-status-dipinjam)]/10 text-[var(--color-status-dipinjam)]',
  },
  SEBAGIAN_KEMBALI: {
    label: 'Sebagian kembali',
    icon: '◑',
    className: 'bg-[var(--color-status-dipinjam)]/10 text-[var(--color-status-dipinjam)]',
  },
  SELESAI: {
    label: 'Selesai',
    icon: '●',
    className: 'bg-[var(--color-status-tersedia)]/10 text-[var(--color-status-tersedia)]',
  },
};

/** Terlambat bukan status tersimpan (spec 4.2); badge menghitungnya dari `daysOverdue`. */
export function LoanStatusBadge({ status, daysOverdue }: { status: LoanStatus; daysOverdue: number }) {
  if (status !== 'SELESAI' && daysOverdue > 0) {
    return (
      <span className={`${BASE} ${LATE}`}>
        <span aria-hidden="true">!</span>Terlambat {daysOverdue} hari
      </span>
    );
  }
  const style = STYLES[status];
  return (
    <span className={`${BASE} ${style.className}`}>
      <span aria-hidden="true">{style.icon}</span>
      {style.label}
    </span>
  );
}
```

Run: `npx vitest run src/components/ui/loan-status-badge.test.tsx`
Expected: PASS.

- [x] **Step 7: Tulis uji halaman yang gagal**

Buat `src/app/(app)/transaksi/riwayat/page.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockListLoans } = vi.hoisted(() => ({ mockListLoans: vi.fn() }));

vi.mock('@/server/queries/loans', () => ({ listLoans: mockListLoans }));
vi.mock('@/lib/school-date', () => ({ schoolToday: () => '2090-03-09' }));
vi.mock('@/server/auth/guard', () => ({
  requireProfile: vi.fn(async () => ({ id: 'u1', role: 'petugas', fullName: 'Petugas', status: 'active' })),
}));

import HistoryPage from './page';

async function render(params: Record<string, string> = {}) {
  return renderToStaticMarkup(await HistoryPage({ searchParams: Promise.resolve(params) }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('HistoryPage', () => {
  it('menampilkan transaksi dengan tautan detail, sisa denda, dan status terlambat', async () => {
    mockListLoans.mockResolvedValueOnce({
      rows: [{
        id: 'l1', transactionNumber: 'PJM-20900302-0001', loanDate: '2090-03-02', dueDate: '2090-03-05',
        status: 'SEBAGIAN_KEMBALI', studentName: 'Ahmad Fauzi', studentNis: '202600123', studentClass: 'XI RPL 1',
        itemCount: 2, openCount: 1, totalFine: 4000, unpaidFine: 1500, daysOverdue: 4,
      }],
      total: 1,
    });

    const html = await render({ status: 'overdue', q: 'ahmad' });

    expect(mockListLoans).toHaveBeenCalledWith({ q: 'ahmad', status: 'overdue', page: 1 }, '2090-03-09');
    expect(html).toContain('href="/transaksi/riwayat/l1"');
    expect(html).toContain('PJM-20900302-0001');
    expect(html).toContain('Ahmad Fauzi');
    expect(html).toContain('1 belum kembali');
    expect(html).toContain('Rp1.500 belum lunas');
    expect(html).toContain('Terlambat 4 hari');
  });

  it('menampilkan pesan kosong', async () => {
    mockListLoans.mockResolvedValueOnce({ rows: [], total: 0 });
    expect(await render()).toContain('Belum ada transaksi yang cocok.');
  });
});
```

Buat `src/app/(app)/transaksi/riwayat/[id]/page.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockGetLoanDetail, mockNotFound } = vi.hoisted(() => ({
  mockGetLoanDetail: vi.fn(),
  mockNotFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('@/server/queries/loans', () => ({ getLoanDetail: mockGetLoanDetail }));
vi.mock('@/server/actions/fines', () => ({ payFineAction: vi.fn() }));
vi.mock('@/lib/school-date', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/school-date')>()),
  schoolToday: () => '2090-03-09',
}));
vi.mock('@/server/auth/guard', () => ({
  requireProfile: vi.fn(async () => ({ id: 'u1', role: 'petugas', fullName: 'Petugas', status: 'active' })),
}));
vi.mock('next/navigation', () => ({ notFound: mockNotFound }));

import LoanDetailPage from './page';

const baseLoan = {
  id: 'l1',
  transactionNumber: 'PJM-20900302-0001',
  status: 'SEBAGIAN_KEMBALI' as const,
  loanDate: '2090-03-02',
  dueDate: '2090-03-05',
  notes: null,
  studentId: 's1',
  studentName: 'Ahmad Fauzi',
  studentNis: '202600123',
  studentClass: 'XI RPL 1',
  academicYearName: '2089/2090',
  createdByName: 'Petugas Perpustakaan',
  totalFine: 54000,
  paidTotal: 4000,
  unpaidFine: 50000,
  daysOverdue: 4,
  items: [
    {
      id: 'i1', bookCopyId: 'c1', barcode: 'BK-000001', bookTitle: 'Pemrograman Web', bookPrice: 50000,
      returnedAt: new Date('2090-03-09T03:00:00Z'), returnCondition: 'RUSAK' as const, daysLate: 4,
      lateFine: 4000, replacementFee: 50000, conditionNote: 'sampul sobek',
    },
    {
      id: 'i2', bookCopyId: 'c2', barcode: 'BK-000002', bookTitle: 'Basis Data', bookPrice: 60000,
      returnedAt: null, returnCondition: null, daysLate: 0, lateFine: 0, replacementFee: 0, conditionNote: null,
    },
  ],
  payments: [
    { id: 'p1', amount: 4000, paidAt: new Date('2090-03-09T04:00:00Z'), receivedByName: 'Petugas Perpustakaan', note: null },
  ],
};

async function render(loan: unknown, params: Record<string, string> = {}) {
  mockGetLoanDetail.mockResolvedValueOnce(loan);
  return renderToStaticMarkup(await LoanDetailPage({
    params: Promise.resolve({ id: 'l1' }),
    searchParams: Promise.resolve(params),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LoanDetailPage', () => {
  it('menampilkan buku, pengembalian, denda, pembayaran, dan pesan sukses', async () => {
    const html = await render(baseLoan, { pesan: 'Pembayaran denda tercatat.' });

    expect(mockGetLoanDetail).toHaveBeenCalledWith('l1', '2090-03-09');
    expect(html).toContain('PJM-20900302-0001');
    expect(html).toContain('Pembayaran denda tercatat.');
    expect(html).toContain('09/03/2090 10.00');
    expect(html).toContain('Rusak');
    expect(html).toContain('sampul sobek');
    expect(html).toContain('Belum kembali');
    expect(html).toContain('Rp54.000');
    expect(html).toContain('Terlambat 4 hari');
  });

  it('mengisi form pelunasan dengan sisa tagihan dan menawarkan proses pengembalian', async () => {
    const html = await render(baseLoan);

    expect(html).toContain('name="amount"');
    expect(html).toContain('value="50000"');
    expect(html).toContain('Tandai Lunas');
    expect(html).toContain('href="/transaksi/pengembalian?q=PJM-20900302-0001&amp;pinjam=l1"');
  });

  it('menyembunyikan form pelunasan dan tombol pengembalian untuk transaksi selesai yang lunas', async () => {
    const html = await render({ ...baseLoan, status: 'SELESAI', unpaidFine: 0, paidTotal: 54000, daysOverdue: 0 });

    expect(html).not.toContain('name="amount"');
    expect(html).not.toContain('/transaksi/pengembalian');
    expect(html).toContain('Lunas');
  });

  it('menampilkan halaman tidak ditemukan untuk transaksi yang tidak ada', async () => {
    mockGetLoanDetail.mockResolvedValueOnce(null);
    await expect(LoanDetailPage({ params: Promise.resolve({ id: 'x' }), searchParams: Promise.resolve({}) }))
      .rejects.toThrow('NEXT_NOT_FOUND');
  });
});
```

Run: `npx vitest run "src/app/(app)/transaksi/riwayat"`
Expected: FAIL — modul halaman tidak ditemukan.

- [x] **Step 8: Implementasikan halaman daftar**

Buat `src/app/(app)/transaksi/riwayat/page.tsx`:

```tsx
import Link from 'next/link';
import { buttonClass } from '@/components/ui/button-styles';
import { FilterBar, FilterSelect } from '@/components/ui/filter-bar';
import { Flash } from '@/components/ui/flash';
import { LoanStatusBadge } from '@/components/ui/loan-status-badge';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { ScrollTable } from '@/components/ui/scroll-table';
import { TD, TH } from '@/components/ui/table-styles';
import { HISTORY_STATUS_OPTIONS, parseHistoryStatus } from '@/lib/circulation-labels';
import { formatDate, formatRupiah } from '@/lib/format';
import { parsePage } from '@/lib/pagination';
import { schoolToday } from '@/lib/school-date';
import { firstValue, type SearchParams } from '@/lib/search-params';
import { requireProfile } from '@/server/auth/guard';
import { listLoans, type LoanRow } from '@/server/queries/loans';

function fineLabel(row: LoanRow): string {
  if (row.unpaidFine > 0) return `${formatRupiah(row.unpaidFine)} belum lunas`;
  return row.totalFine > 0 ? 'Lunas' : '—';
}

export default async function HistoryPage({ searchParams }: { searchParams: SearchParams }) {
  await requireProfile();
  const params = await searchParams;
  const q = firstValue(params.q);
  const status = parseHistoryStatus(firstValue(params.status));
  const page = parsePage(firstValue(params.hal));
  const { rows, total } = await listLoans({ q, status, page }, schoolToday());

  return (
    <>
      <PageHeader
        title="Riwayat Transaksi"
        description="Seluruh peminjaman beserta pengembalian dan dendanya."
        actions={<Link href="/transaksi/peminjaman" className={buttonClass('primary')}>Peminjaman Baru</Link>}
      />
      <Flash message={firstValue(params.pesan)} />
      <FilterBar q={q} placeholder="Cari no. transaksi, NIS, atau nama siswa">
        <FilterSelect name="status" label="Filter status" value={status} options={HISTORY_STATUS_OPTIONS} />
      </FilterBar>

      <ScrollTable>
        <thead>
          <tr>
            <th className={TH}>No. Transaksi</th>
            <th className={TH}>Siswa</th>
            <th className={TH}>Pinjam</th>
            <th className={TH}>Jatuh Tempo</th>
            <th className={TH}>Buku</th>
            <th className={TH}>Denda</th>
            <th className={TH}>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className={`${TD} text-center text-[var(--color-ink-500)]`}>Belum ada transaksi yang cocok.</td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.id}>
              <td className={TD}>
                <Link href={`/transaksi/riwayat/${row.id}`} className="font-mono text-[var(--color-accent-600)] hover:underline">
                  {row.transactionNumber}
                </Link>
              </td>
              <td className={TD}>
                {row.studentName}
                <span className="block text-xs text-[var(--color-ink-500)]">{row.studentNis} · {row.studentClass}</span>
              </td>
              <td className={TD}>{formatDate(row.loanDate)}</td>
              <td className={TD}>{formatDate(row.dueDate)}</td>
              <td className={TD}>
                {row.itemCount} buku
                {row.openCount > 0 && row.status !== 'SELESAI' && (
                  <span className="block text-xs text-[var(--color-ink-500)]">{row.openCount} belum kembali</span>
                )}
              </td>
              <td className={TD}>{fineLabel(row)}</td>
              <td className={TD}><LoanStatusBadge status={row.status} daysOverdue={row.daysOverdue} /></td>
            </tr>
          ))}
        </tbody>
      </ScrollTable>

      <Pagination path="/transaksi/riwayat" page={page} total={total} query={{ q, status }} />
    </>
  );
}
```

- [x] **Step 9: Implementasikan halaman detail**

Buat `src/app/(app)/transaksi/riwayat/[id]/page.tsx`:

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/ui/action-form';
import { buttonClass } from '@/components/ui/button-styles';
import { TextField } from '@/components/ui/fields';
import { Flash } from '@/components/ui/flash';
import { LoanStatusBadge } from '@/components/ui/loan-status-badge';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollTable } from '@/components/ui/scroll-table';
import { TD, TH } from '@/components/ui/table-styles';
import { RETURN_CONDITION_LABELS } from '@/lib/circulation-labels';
import { formatDate, formatRupiah } from '@/lib/format';
import { formatSchoolDateTime, schoolToday } from '@/lib/school-date';
import { firstValue, withQuery, type SearchParams } from '@/lib/search-params';
import { payFineAction } from '@/server/actions/fines';
import { requireProfile } from '@/server/auth/guard';
import { getLoanDetail } from '@/server/queries/loans';

const SECTION = 'page-title mb-3 mt-8 text-lg font-semibold';

function money(amount: number): string {
  return amount > 0 ? formatRupiah(amount) : '—';
}

export default async function LoanDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  await requireProfile();
  const { id } = await params;
  const query = await searchParams;
  const loan = await getLoanDetail(id, schoolToday());
  if (!loan) notFound();

  const isOpen = loan.status !== 'SELESAI';

  return (
    <>
      <PageHeader
        title={loan.transactionNumber}
        description={`${loan.studentName} · NIS ${loan.studentNis} · ${loan.studentClass}`}
        actions={isOpen ? (
          <Link
            href={withQuery('/transaksi/pengembalian', { q: loan.transactionNumber, pinjam: loan.id })}
            className={buttonClass('primary')}
          >
            Proses Pengembalian
          </Link>
        ) : undefined}
      />
      <Flash message={firstValue(query.pesan)} />

      <dl className="grid gap-4 rounded-lg border border-[var(--color-ink-100)] bg-white p-4 text-sm sm:grid-cols-3">
        <div><dt className="text-[var(--color-ink-500)]">Tanggal pinjam</dt><dd>{formatDate(loan.loanDate)}</dd></div>
        <div><dt className="text-[var(--color-ink-500)]">Jatuh tempo</dt><dd>{formatDate(loan.dueDate)}</dd></div>
        <div>
          <dt className="text-[var(--color-ink-500)]">Status</dt>
          <dd><LoanStatusBadge status={loan.status} daysOverdue={loan.daysOverdue} /></dd>
        </div>
        <div><dt className="text-[var(--color-ink-500)]">Tahun ajaran</dt><dd>{loan.academicYearName}</dd></div>
        <div><dt className="text-[var(--color-ink-500)]">Dicatat oleh</dt><dd>{loan.createdByName}</dd></div>
        {loan.notes && <div><dt className="text-[var(--color-ink-500)]">Catatan</dt><dd>{loan.notes}</dd></div>}
      </dl>

      <h2 className={SECTION}>Buku</h2>
      <ScrollTable>
        <thead>
          <tr>
            <th className={TH}>Barcode</th>
            <th className={TH}>Judul</th>
            <th className={TH}>Dikembalikan</th>
            <th className={TH}>Kondisi</th>
            <th className={TH}>Telat</th>
            <th className={TH}>Denda Telat</th>
            <th className={TH}>Biaya Ganti</th>
          </tr>
        </thead>
        <tbody>
          {loan.items.map((item) => (
            <tr key={item.id}>
              <td className={`${TD} font-mono`}>{item.barcode}</td>
              <td className={TD}>{item.bookTitle}</td>
              <td className={TD}>{item.returnedAt ? formatSchoolDateTime(item.returnedAt) : 'Belum kembali'}</td>
              <td className={TD}>
                {item.returnCondition ? RETURN_CONDITION_LABELS[item.returnCondition] : '—'}
                {item.conditionNote && <span className="block text-xs text-[var(--color-ink-500)]">{item.conditionNote}</span>}
              </td>
              <td className={TD}>{item.daysLate > 0 ? `${item.daysLate} hari` : '—'}</td>
              <td className={TD}>{money(item.lateFine)}</td>
              <td className={TD}>{money(item.replacementFee)}</td>
            </tr>
          ))}
        </tbody>
      </ScrollTable>

      <h2 className={SECTION}>Denda</h2>
      <dl className="grid gap-4 rounded-lg border border-[var(--color-ink-100)] bg-white p-4 text-sm sm:grid-cols-3">
        <div><dt className="text-[var(--color-ink-500)]">Total denda</dt><dd className="tabular">{formatRupiah(loan.totalFine)}</dd></div>
        <div><dt className="text-[var(--color-ink-500)]">Sudah dibayar</dt><dd className="tabular">{formatRupiah(loan.paidTotal)}</dd></div>
        <div>
          <dt className="text-[var(--color-ink-500)]">Sisa</dt>
          <dd className="tabular font-semibold">
            {loan.unpaidFine > 0 ? formatRupiah(loan.unpaidFine) : loan.totalFine > 0 ? 'Lunas' : 'Tidak ada denda'}
          </dd>
        </div>
      </dl>

      {loan.payments.length > 0 && (
        <div className="mt-4">
          <ScrollTable>
            <thead>
              <tr>
                <th className={TH}>Waktu</th>
                <th className={TH}>Nominal</th>
                <th className={TH}>Diterima oleh</th>
                <th className={TH}>Catatan</th>
              </tr>
            </thead>
            <tbody>
              {loan.payments.map((payment) => (
                <tr key={payment.id}>
                  <td className={TD}>{formatSchoolDateTime(payment.paidAt)}</td>
                  <td className={TD}>{formatRupiah(payment.amount)}</td>
                  <td className={TD}>{payment.receivedByName}</td>
                  <td className={TD}>{payment.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </ScrollTable>
        </div>
      )}

      {loan.unpaidFine > 0 && (
        <>
          <h2 className={SECTION}>Pelunasan Denda</h2>
          <ActionForm action={payFineAction.bind(null, loan.id)} submitLabel="Tandai Lunas">
            <TextField
              name="amount"
              label="Nominal dibayar (Rp)"
              inputMode="numeric"
              required
              defaultValue={String(loan.unpaidFine)}
              hint={`Sisa tagihan ${formatRupiah(loan.unpaidFine)}. Ubah bila siswa membayar sebagian.`}
            />
            <TextField name="note" label="Catatan" maxLength={200} />
          </ActionForm>
        </>
      )}
    </>
  );
}
```

- [x] **Step 10: Jalankan uji halaman dan pastikan lulus**

Run: `npx vitest run "src/app/(app)/transaksi/riwayat" src/components/ui/loan-status-badge.test.tsx`
Expected: PASS. Uji waktu memakai `formatSchoolDateTime` asli: `2090-03-09T03:00:00Z` tampil `09/03/2090 10.00`.

- [x] **Step 11: Jalankan seluruh uji unit, lint, dan tsc**

Run: `npm test && npm run lint && npx tsc --noEmit`
Expected: PASS/bersih.

- [x] **Step 12: Commit**

```bash
git add src/lib/circulation-labels.ts src/lib/circulation-labels.test.ts src/server/queries/loans.ts \
  tests/integration/loan-queries.test.ts src/components/ui/loan-status-badge.tsx src/components/ui/loan-status-badge.test.tsx \
  "src/app/(app)/transaksi/riwayat"
git commit -m "$(cat <<'EOF'
feat(riwayat): daftar dan detail transaksi dengan form pelunasan denda

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Meja Peminjaman

Satu layar, dua kolom, tanpa wizard (spec 8.2). Petugas memindai kartu/NIS siswa → kartu siswa tampil dengan sisa slot dan peringatan, fokus pindah ke kolom buku → setiap `Enter` di kolom buku menambahkan eksemplar lalu mengosongkan kolom → `Ctrl+Enter` menyimpan → konfirmasi menampilkan nomor transaksi.

Eksemplar yang tidak boleh dipinjam ditolak **saat dipindai**, dengan alasannya, sebelum tombol simpan ditekan. Logika daftar berada di reducer murni `desk-state.ts` yang diuji tanpa DOM; komponen `loan-desk.tsx` hanya merangkai.

**Files:**
- Create: `src/lib/circulation-results.ts`
- Create: `src/server/actions/loans.ts`, `src/server/actions/loans.test.ts`
- Create: `src/app/(app)/transaksi/peminjaman/desk-state.ts`, `desk-state.test.ts`
- Create: `src/app/(app)/transaksi/peminjaman/loan-desk.tsx`
- Create: `src/app/(app)/transaksi/peminjaman/page.tsx`, `page.test.tsx`

**Interfaces:**
- Consumes: `searchBorrowers`, `getBorrowerCard`, `findCopyByBarcode`, `BorrowerOption`, `BorrowerCard`, `CopyLookup` (Task 2); `createLoan` (Task 3); `createLoanSchema` (Task 3); `schoolToday`, `describeViolation` (Task 1); `calculateDueDate` (domain); `getLibrarySettings`, `getActiveAcademicYear`; `authorize`; `formatDate`, `formatRupiah`; `PageHeader`, `buttonClass`
- Produces:
  - `type LookupResult<T> = { ok: true; data: T } | { ok: false; message: string }`
  - `type CreateLoanState = { status: 'success'; loanId: string; transactionNumber: string; dueDate: string } | { status: 'rejected'; violations: Violation[] } | { status: 'error'; message: string }`
  - Server Action: `searchBorrowersAction(query: string)`, `getBorrowerCardAction(studentId: string)`, `lookupCopyAction(barcode: string)`, `createLoanAction(input: unknown): Promise<CreateLoanState>`
  - `deskReducer`, `INITIAL_DESK`, `remainingSlots(state)`, `cardWarnings(card)`, tipe `DeskState`, `DeskAction`, `DeskCopy`, `CardWarning`
  - `<LoanDesk loanDate dueDate durationDays />`; rute `/transaksi/peminjaman`

- [x] **Step 1: Tulis uji Server Action yang gagal**

Buat `src/server/actions/loans.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockAuthorize, mockSearch, mockCard, mockFindCopy, mockCreateLoan, mockRevalidatePath,
} = vi.hoisted(() => ({
  mockAuthorize: vi.fn(),
  mockSearch: vi.fn(),
  mockCard: vi.fn(),
  mockFindCopy: vi.fn(),
  mockCreateLoan: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

vi.mock('@/server/auth/guard', () => ({ authorize: mockAuthorize }));
vi.mock('@/server/queries/circulation', () => ({
  searchBorrowers: mockSearch,
  getBorrowerCard: mockCard,
  findCopyByBarcode: mockFindCopy,
}));
vi.mock('@/server/services/loans', () => ({ createLoan: mockCreateLoan }));
vi.mock('@/lib/school-date', () => ({ schoolToday: () => '2090-03-02' }));
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }));

import {
  createLoanAction, getBorrowerCardAction, lookupCopyAction, searchBorrowersAction,
} from './loans';

const actor = { id: 'u1', role: 'petugas' as const };
const studentId = '6f1c2b1e-4b1a-4c3e-9f7a-2d1e3c4b5a6f';
const copyId = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthorize.mockResolvedValue({ ok: true, actor });
});

describe('Server Action baca meja peminjaman', () => {
  it('menolak tanpa membaca data bila peran tidak diizinkan', async () => {
    mockAuthorize.mockResolvedValueOnce({ ok: false, message: 'Akses ditolak.' });

    expect(await searchBorrowersAction('ahmad')).toEqual({ ok: false, message: 'Akses ditolak.' });
    expect(mockAuthorize).toHaveBeenCalledWith(['admin', 'petugas']);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('meneruskan pencarian siswa', async () => {
    mockSearch.mockResolvedValueOnce([{ id: studentId }]);
    expect(await searchBorrowersAction('ahmad')).toEqual({ ok: true, data: [{ id: studentId }] });
    expect(mockSearch).toHaveBeenCalledWith('ahmad');
  });

  it('memuat kartu siswa dengan tanggal sekolah, atau menjelaskan bila tidak ditemukan', async () => {
    mockCard.mockResolvedValueOnce({ activeCount: 1 });
    expect(await getBorrowerCardAction(studentId)).toEqual({ ok: true, data: { activeCount: 1 } });
    expect(mockCard).toHaveBeenCalledWith(studentId, '2090-03-02');

    mockCard.mockResolvedValueOnce(null);
    expect(await getBorrowerCardAction(studentId)).toEqual({
      ok: false, message: 'Siswa tidak ditemukan. Cari ulang dengan NIS atau nama.',
    });
  });

  it('menjelaskan barcode yang tidak terdaftar dan barcode kosong', async () => {
    mockFindCopy.mockResolvedValueOnce(null);
    expect(await lookupCopyAction(' xx-9 ')).toEqual({
      ok: false,
      message: 'Barcode XX-9 tidak terdaftar. Periksa label buku, atau daftarkan eksemplarnya di Master Data → Buku.',
    });
    expect(await lookupCopyAction('  ')).toEqual({ ok: false, message: 'Pindai atau ketik barcode buku terlebih dahulu.' });
  });
});

describe('createLoanAction', () => {
  const input = { studentId, copyIds: [copyId], notes: '' };

  it('menyimpan dengan tanggal sekolah dan mengembalikan nomor transaksi', async () => {
    mockCreateLoan.mockResolvedValueOnce({ ok: true, id: 'l1', transactionNumber: 'PJM-20900302-0001', dueDate: '2090-03-05' });

    expect(await createLoanAction(input)).toEqual({
      status: 'success', loanId: 'l1', transactionNumber: 'PJM-20900302-0001', dueDate: '2090-03-05',
    });
    expect(mockCreateLoan).toHaveBeenCalledWith({ studentId, copyIds: [copyId], notes: null }, actor, '2090-03-02');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/transaksi/riwayat');
  });

  it('meneruskan pelanggaran aturan apa adanya', async () => {
    mockCreateLoan.mockResolvedValueOnce({ ok: false, violations: [{ code: 'NO_ACTIVE_YEAR' }] });
    expect(await createLoanAction(input)).toEqual({ status: 'rejected', violations: [{ code: 'NO_ACTIVE_YEAR' }] });
  });

  it('meneruskan pesan galat service dan galat validasi', async () => {
    mockCreateLoan.mockResolvedValueOnce({ ok: false, message: 'Siswa tidak ditemukan.' });
    expect(await createLoanAction(input)).toEqual({ status: 'error', message: 'Siswa tidak ditemukan.' });

    expect(await createLoanAction({ copyIds: [], notes: '' })).toEqual({ status: 'error', message: 'Pilih siswa terlebih dahulu.' });
  });
});
```

Run: `npx vitest run src/server/actions/loans.test.ts`
Expected: FAIL — modul `./loans` tidak ditemukan.

- [x] **Step 2: Implementasikan tipe hasil dan Server Action**

Buat `src/lib/circulation-results.ts`:

```ts
import type { Violation } from '@/domain/shared/violations';

/**
 * Hasil Server Action baca di meja sirkulasi. Galat dikembalikan, tidak
 * dilempar: Next.js menyamarkan galat yang dilempar Server Action di produksi.
 */
export type LookupResult<T> = { ok: true; data: T } | { ok: false; message: string };

export type CreateLoanState =
  | { status: 'success'; loanId: string; transactionNumber: string; dueDate: string }
  | { status: 'rejected'; violations: Violation[] }
  | { status: 'error'; message: string };
```

Buat `src/server/actions/loans.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import type { UserRole } from '@/domain/shared/types';
import type { CreateLoanState, LookupResult } from '@/lib/circulation-results';
import { schoolToday } from '@/lib/school-date';
import { authorize } from '@/server/auth/guard';
import {
  findCopyByBarcode, getBorrowerCard, searchBorrowers,
  type BorrowerCard, type BorrowerOption, type CopyLookup,
} from '@/server/queries/circulation';
import { createLoan } from '@/server/services/loans';
import { createLoanSchema } from '@/server/validation/loan';

const ROLES: UserRole[] = ['admin', 'petugas'];

export async function searchBorrowersAction(query: string): Promise<LookupResult<BorrowerOption[]>> {
  const auth = await authorize(ROLES);
  if (!auth.ok) return { ok: false, message: auth.message };
  return { ok: true, data: await searchBorrowers(String(query ?? '')) };
}

export async function getBorrowerCardAction(studentId: string): Promise<LookupResult<BorrowerCard>> {
  const auth = await authorize(ROLES);
  if (!auth.ok) return { ok: false, message: auth.message };
  const card = await getBorrowerCard(String(studentId ?? ''), schoolToday());
  return card
    ? { ok: true, data: card }
    : { ok: false, message: 'Siswa tidak ditemukan. Cari ulang dengan NIS atau nama.' };
}

export async function lookupCopyAction(barcode: string): Promise<LookupResult<CopyLookup>> {
  const auth = await authorize(ROLES);
  if (!auth.ok) return { ok: false, message: auth.message };
  const code = String(barcode ?? '').trim().toUpperCase();
  if (!code) return { ok: false, message: 'Pindai atau ketik barcode buku terlebih dahulu.' };
  const copy = await findCopyByBarcode(code);
  return copy
    ? { ok: true, data: copy }
    : {
        ok: false,
        message: `Barcode ${code} tidak terdaftar. Periksa label buku, atau daftarkan eksemplarnya di Master Data → Buku.`,
      };
}

export async function createLoanAction(input: unknown): Promise<CreateLoanState> {
  const auth = await authorize(ROLES);
  if (!auth.ok) return { status: 'error', message: auth.message };

  const parsed = createLoanSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Data peminjaman tidak valid. Muat ulang halaman.' };
  }

  const result = await createLoan(parsed.data, auth.actor, schoolToday());
  if (!result.ok) {
    return 'violations' in result
      ? { status: 'rejected', violations: result.violations }
      : { status: 'error', message: result.message };
  }

  revalidatePath('/transaksi/riwayat');
  revalidatePath('/master/buku');
  return { status: 'success', loanId: result.id, transactionNumber: result.transactionNumber, dueDate: result.dueDate };
}
```

Run: `npx vitest run src/server/actions/loans.test.ts`
Expected: PASS.

- [x] **Step 3: Tulis uji reducer yang gagal**

Buat `src/app/(app)/transaksi/peminjaman/desk-state.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { BorrowerCard, CopyLookup } from '@/server/queries/circulation';
import { cardWarnings, deskReducer, INITIAL_DESK, remainingSlots, type DeskState } from './desk-state';

function card(overrides: Partial<BorrowerCard> = {}): BorrowerCard {
  return {
    student: { id: 's1', nis: '202600123', name: 'Ahmad Fauzi', className: 'XI RPL 1', status: 'active' },
    activeCount: 0,
    maxActiveLoans: 3,
    overdue: [],
    unpaidFine: 0,
    blockWhenOverdue: true,
    blockWhenUnpaidFine: false,
    ...overrides,
  };
}

function copy(overrides: Partial<CopyLookup> = {}): CopyLookup {
  return {
    id: 'c1',
    barcode: 'BK-000123',
    status: 'TERSEDIA',
    bookId: 'b1',
    bookTitle: 'Pemrograman Web',
    bookStatus: 'active',
    rackCode: 'A-3',
    ...overrides,
  };
}

function withStudent(overrides: Partial<BorrowerCard> = {}): DeskState {
  return deskReducer(INITIAL_DESK, { type: 'selectStudent', card: card(overrides) });
}

describe('deskReducer — menambah eksemplar', () => {
  it('menambahkan eksemplar yang tersedia dan mengurangi sisa slot', () => {
    const state = deskReducer(withStudent({ activeCount: 1 }), { type: 'addCopy', copy: copy() });

    expect(state.copies).toEqual([{ id: 'c1', barcode: 'BK-000123', bookTitle: 'Pemrograman Web', rackCode: 'A-3' }]);
    expect(state.notice).toBeNull();
    expect(remainingSlots(state)).toBe(1);
  });

  it('menolak eksemplar yang sudah ada di daftar', () => {
    const once = deskReducer(withStudent(), { type: 'addCopy', copy: copy() });
    const twice = deskReducer(once, { type: 'addCopy', copy: copy() });

    expect(twice.copies).toHaveLength(1);
    expect(twice.notice).toBe('Eksemplar BK-000123 sudah ada di daftar.');
  });

  it('menolak eksemplar yang sedang dipinjam siswa lain dan menyebut peminjamnya', () => {
    const state = deskReducer(withStudent(), {
      type: 'addCopy',
      copy: copy({ status: 'DIPINJAM', borrowedBy: { name: 'Siti Aminah', nis: '202600456', dueDate: '2026-09-24' } }),
    });

    expect(state.copies).toEqual([]);
    expect(state.notice).toBe('Eksemplar BK-000123 sedang dipinjam — Siti Aminah (NIS 202600456), jatuh tempo 24/09/2026. Pilih eksemplar lain.');
  });

  it('menolak eksemplar rusak dan eksemplar milik buku nonaktif', () => {
    expect(deskReducer(withStudent(), { type: 'addCopy', copy: copy({ status: 'RUSAK' }) }).notice)
      .toBe('Eksemplar BK-000123 berstatus rusak — "Pemrograman Web" tidak dapat dipinjam. Pilih eksemplar lain.');
    expect(deskReducer(withStudent(), { type: 'addCopy', copy: copy({ bookStatus: 'inactive' }) }).notice)
      .toBe('Buku "Pemrograman Web" nonaktif — Eksemplar BK-000123 tidak dapat dipinjam. Aktifkan bukunya di Master Data → Buku bila masih dipakai.');
  });

  it('menolak eksemplar yang melebihi sisa kuota siswa', () => {
    const state = deskReducer(withStudent({ activeCount: 3 }), { type: 'addCopy', copy: copy() });

    expect(state.copies).toEqual([]);
    expect(state.notice).toBe('Kuota penuh: Ahmad Fauzi hanya boleh meminjam 3 buku sekaligus.');
  });

  it('mengizinkan memindai buku sebelum siswa dipilih', () => {
    const state = deskReducer(INITIAL_DESK, { type: 'addCopy', copy: copy() });
    expect(state.copies).toHaveLength(1);
    expect(remainingSlots(state)).toBeNull();
  });
});

describe('deskReducer — aksi lain', () => {
  it('menghapus eksemplar, mengganti siswa tanpa membuang daftar buku, dan mengosongkan semuanya', () => {
    const filled = deskReducer(withStudent(), { type: 'addCopy', copy: copy() });

    expect(deskReducer(filled, { type: 'removeCopy', id: 'c1' }).copies).toEqual([]);
    const cleared = deskReducer(filled, { type: 'clearStudent' });
    expect(cleared.student).toBeNull();
    expect(cleared.copies).toHaveLength(1);
    expect(deskReducer(filled, { type: 'reset' })).toEqual(INITIAL_DESK);
    expect(deskReducer(filled, { type: 'notice', message: 'Barcode tidak terdaftar.' }).notice).toBe('Barcode tidak terdaftar.');
  });
});

describe('cardWarnings', () => {
  it('menyatakan tidak ada masalah untuk siswa yang bersih', () => {
    expect(cardWarnings(card())).toEqual([{ tone: 'ok', text: 'Tidak ada keterlambatan atau tunggakan denda.' }]);
  });

  it('menandai hal yang akan menolak peminjaman sebagai blokir dan sisanya sebagai peringatan', () => {
    expect(cardWarnings(card({
      student: { id: 's1', nis: '202600123', name: 'Ahmad Fauzi', className: 'XI RPL 1', status: 'inactive' },
      activeCount: 3,
      overdue: [{ transactionNumber: 'PJM-20260917-0003', daysLate: 4 }],
      unpaidFine: 4000,
    }))).toEqual([
      { tone: 'block', text: 'Ahmad Fauzi berstatus nonaktif; peminjaman akan ditolak.' },
      { tone: 'block', text: 'Kuota penuh. Kembalikan salah satu buku terlebih dahulu.' },
      { tone: 'block', text: 'PJM-20260917-0003 terlambat 4 hari. Selesaikan dahulu sebelum meminjam.' },
      { tone: 'warn', text: 'Tunggakan denda Rp4.000.' },
    ]);
  });

  it('menurunkan keterlambatan menjadi peringatan bila blokir dimatikan, dan tunggakan menjadi blokir bila dinyalakan', () => {
    expect(cardWarnings(card({
      overdue: [{ transactionNumber: 'PJM-20260917-0003', daysLate: 4 }],
      unpaidFine: 4000,
      blockWhenOverdue: false,
      blockWhenUnpaidFine: true,
    }))).toEqual([
      { tone: 'warn', text: 'PJM-20260917-0003 terlambat 4 hari.' },
      { tone: 'block', text: 'Tunggakan denda Rp4.000. Lunasi dahulu sebelum meminjam.' },
    ]);
  });
});
```

Run: `npx vitest run "src/app/(app)/transaksi/peminjaman/desk-state.test.ts"`
Expected: FAIL — modul `./desk-state` tidak ditemukan.

- [x] **Step 4: Implementasikan reducer**

Buat `src/app/(app)/transaksi/peminjaman/desk-state.ts`:

```ts
import { formatRupiah } from '@/lib/format';
import { describeViolation, type ViolationMessage } from '@/lib/violation-message';
import type { BorrowerCard, CopyLookup } from '@/server/queries/circulation';

export interface DeskCopy {
  id: string;
  barcode: string;
  bookTitle: string;
  rackCode: string | null;
}

export interface DeskState {
  student: BorrowerCard | null;
  copies: DeskCopy[];
  /** Alasan pindaian terakhir ditolak, atau pesan pencarian. */
  notice: string | null;
}

export type DeskAction =
  | { type: 'selectStudent'; card: BorrowerCard }
  | { type: 'clearStudent' }
  | { type: 'addCopy'; copy: CopyLookup }
  | { type: 'removeCopy'; id: string }
  | { type: 'notice'; message: string }
  | { type: 'reset' };

export const INITIAL_DESK: DeskState = { student: null, copies: [], notice: null };

/** Sisa slot setelah buku di daftar ikut dihitung; null bila siswa belum dipilih. */
export function remainingSlots(state: DeskState): number | null {
  if (!state.student) return null;
  return Math.max(0, state.student.maxActiveLoans - state.student.activeCount - state.copies.length);
}

function sentence(message: ViolationMessage): string {
  return `${message.title} — ${message.detail}`;
}

/**
 * Alasan eksemplar tidak boleh masuk daftar, atau null. Menolak saat dipindai
 * lebih baik daripada menampilkan galat setelah tombol simpan (spec 8.2).
 * Server tetap memeriksa ulang semuanya saat menyimpan.
 */
function rejectionOf(state: DeskState, copy: CopyLookup): string | null {
  if (state.copies.some((listed) => listed.id === copy.id)) {
    return `Eksemplar ${copy.barcode} sudah ada di daftar.`;
  }
  if (copy.bookStatus !== 'active') {
    return sentence(describeViolation({ code: 'BOOK_INACTIVE', barcode: copy.barcode, bookTitle: copy.bookTitle }));
  }
  if (copy.status !== 'TERSEDIA') {
    return sentence(describeViolation({
      code: 'COPY_UNAVAILABLE',
      barcode: copy.barcode,
      bookTitle: copy.bookTitle,
      status: copy.status,
      ...(copy.borrowedBy ? { borrowedBy: copy.borrowedBy } : {}),
    }));
  }
  if (state.student && remainingSlots(state) === 0) {
    return `Kuota penuh: ${state.student.student.name} hanya boleh meminjam ${state.student.maxActiveLoans} buku sekaligus.`;
  }
  return null;
}

export function deskReducer(state: DeskState, action: DeskAction): DeskState {
  switch (action.type) {
    case 'selectStudent':
      return { ...state, student: action.card, notice: null };
    case 'clearStudent':
      return { ...state, student: null, notice: null };
    case 'addCopy': {
      const reason = rejectionOf(state, action.copy);
      if (reason) return { ...state, notice: reason };
      const { id, barcode, bookTitle, rackCode } = action.copy;
      return { ...state, copies: [...state.copies, { id, barcode, bookTitle, rackCode }], notice: null };
    }
    case 'removeCopy':
      return { ...state, copies: state.copies.filter((listed) => listed.id !== action.id), notice: null };
    case 'notice':
      return { ...state, notice: action.message };
    case 'reset':
      return INITIAL_DESK;
  }
}

export interface CardWarning {
  /** block: peminjaman akan ditolak; warn: dicatat tetapi tidak menghalangi. */
  tone: 'block' | 'warn' | 'ok';
  text: string;
}

/** Peringatan di kartu siswa, ditampilkan sebelum petugas menambahkan buku (spec 8.2). */
export function cardWarnings(card: BorrowerCard): CardWarning[] {
  const warnings: CardWarning[] = [];
  if (card.student.status !== 'active') {
    warnings.push({ tone: 'block', text: `${card.student.name} berstatus nonaktif; peminjaman akan ditolak.` });
  }
  if (card.activeCount >= card.maxActiveLoans) {
    warnings.push({ tone: 'block', text: 'Kuota penuh. Kembalikan salah satu buku terlebih dahulu.' });
  }
  for (const late of card.overdue) {
    warnings.push(card.blockWhenOverdue
      ? { tone: 'block', text: `${late.transactionNumber} terlambat ${late.daysLate} hari. Selesaikan dahulu sebelum meminjam.` }
      : { tone: 'warn', text: `${late.transactionNumber} terlambat ${late.daysLate} hari.` });
  }
  if (card.unpaidFine > 0) {
    warnings.push(card.blockWhenUnpaidFine
      ? { tone: 'block', text: `Tunggakan denda ${formatRupiah(card.unpaidFine)}. Lunasi dahulu sebelum meminjam.` }
      : { tone: 'warn', text: `Tunggakan denda ${formatRupiah(card.unpaidFine)}.` });
  }
  return warnings.length > 0 ? warnings : [{ tone: 'ok', text: 'Tidak ada keterlambatan atau tunggakan denda.' }];
}
```

Run: `npx vitest run "src/app/(app)/transaksi/peminjaman/desk-state.test.ts"`
Expected: PASS.

- [x] **Step 5: Tulis uji halaman yang gagal**

Buat `src/app/(app)/transaksi/peminjaman/page.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockActiveYear } = vi.hoisted(() => ({ mockActiveYear: vi.fn() }));

vi.mock('@/server/actions/loans', () => ({
  searchBorrowersAction: vi.fn(),
  getBorrowerCardAction: vi.fn(),
  lookupCopyAction: vi.fn(),
  createLoanAction: vi.fn(),
}));
vi.mock('@/server/queries/settings', () => ({
  getLibrarySettings: vi.fn(async () => ({ loanDurationDays: 3 })),
}));
vi.mock('@/server/queries/academic-years', () => ({ getActiveAcademicYear: mockActiveYear }));
vi.mock('@/lib/school-date', () => ({ schoolToday: () => '2090-03-02' }));
vi.mock('@/server/auth/guard', () => ({
  requireProfile: vi.fn(async () => ({ id: 'u1', role: 'petugas', fullName: 'Petugas', status: 'active' })),
}));

import LoanPage from './page';

beforeEach(() => {
  mockActiveYear.mockResolvedValue({ id: 'y1', name: '2089/2090' });
});

describe('LoanPage', () => {
  it('menampilkan kolom scan siswa yang langsung aktif, kolom scan buku, dan tanggal jatuh tempo', async () => {
    const html = renderToStaticMarkup(await LoanPage());

    expect(html).toMatch(/<input[^>]*id="student"[^>]*autofocus=""/i);
    expect(html).toContain('id="barcode"');
    expect(html).toContain('02/03/2090');
    expect(html).toContain('05/03/2090');
    expect(html).toContain('(3 hari)');
    expect(html).toContain('Ctrl+Enter');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Simpan Peminjaman/);
  });

  it('memperingatkan bila belum ada tahun ajaran aktif', async () => {
    mockActiveYear.mockResolvedValueOnce(null);
    expect(renderToStaticMarkup(await LoanPage())).toContain('Belum ada tahun ajaran aktif');
  });
});
```

Run: `npx vitest run "src/app/(app)/transaksi/peminjaman/page.test.tsx"`
Expected: FAIL — modul `./page` tidak ditemukan.

- [x] **Step 6: Implementasikan komponen meja peminjaman**

Buat `src/app/(app)/transaksi/peminjaman/loan-desk.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { useReducer, useRef, useState, useTransition, type FormEvent, type KeyboardEvent } from 'react';
import { buttonClass } from '@/components/ui/button-styles';
import type { CreateLoanState } from '@/lib/circulation-results';
import { formatDate } from '@/lib/format';
import { describeViolation } from '@/lib/violation-message';
import {
  createLoanAction, getBorrowerCardAction, lookupCopyAction, searchBorrowersAction,
} from '@/server/actions/loans';
import type { BorrowerCard, BorrowerOption } from '@/server/queries/circulation';
import { cardWarnings, deskReducer, INITIAL_DESK, remainingSlots } from './desk-state';

const INPUT = 'w-full rounded-md border border-[var(--color-ink-300)] bg-white px-3 py-2 text-sm';
const PANEL = 'rounded-lg border border-[var(--color-ink-100)] bg-white p-4';
const HEADING = 'mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-500)]';
const ALERT = 'text-sm text-[var(--color-status-terlambat)]';

const TONE_CLASS = {
  block: 'text-[var(--color-status-terlambat)]',
  warn: 'text-[var(--color-status-rusak)]',
  ok: 'text-[var(--color-status-tersedia)]',
};
const TONE_ICON = { block: '⛔', warn: '!', ok: '✓' };

function StudentCard({ card, onChange }: { card: BorrowerCard; onChange: () => void }) {
  const used = Math.min(card.activeCount, card.maxActiveLoans);
  const dots = '●'.repeat(used) + '○'.repeat(Math.max(0, card.maxActiveLoans - used));
  return (
    <div>
      <p className="font-semibold">{card.student.name}</p>
      <p className="text-sm text-[var(--color-ink-500)]">{card.student.nis} · {card.student.className}</p>
      <p className="mt-2 text-sm">
        <span aria-hidden="true" className="tracking-widest">{dots}</span>{' '}
        Sedang dipinjam {card.activeCount} dari {card.maxActiveLoans}
      </p>
      <ul className="mt-2 space-y-1 text-sm">
        {cardWarnings(card).map((warning) => (
          <li key={warning.text} className={TONE_CLASS[warning.tone]}>
            <span aria-hidden="true">{TONE_ICON[warning.tone]}</span> {warning.text}
          </li>
        ))}
      </ul>
      <button type="button" onClick={onChange} className={`${buttonClass('secondary', 'sm')} mt-3`}>Ganti siswa</button>
    </div>
  );
}

export function LoanDesk({ loanDate, dueDate, durationDays }: { loanDate: string; dueDate: string; durationDays: number }) {
  const [desk, dispatch] = useReducer(deskReducer, INITIAL_DESK);
  const [candidates, setCandidates] = useState<BorrowerOption[]>([]);
  const [studentMessage, setStudentMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [outcome, setOutcome] = useState<CreateLoanState | null>(null);
  const [pending, startTransition] = useTransition();
  const copyInput = useRef<HTMLInputElement>(null);

  const slots = remainingSlots(desk);
  const canSave = desk.student !== null && desk.copies.length > 0 && !pending;

  async function loadCard(studentId: string) {
    const result = await getBorrowerCardAction(studentId);
    if (!result.ok) {
      setStudentMessage(result.message);
      return;
    }
    dispatch({ type: 'selectStudent', card: result.data });
    setCandidates([]);
    setStudentMessage(null);
    // Spec 8.2: begitu siswa terpilih, fokus pindah ke kolom scan buku.
    copyInput.current?.focus();
  }

  function searchStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = String(new FormData(event.currentTarget).get('student') ?? '');
    startTransition(async () => {
      const result = await searchBorrowersAction(query);
      if (!result.ok) {
        setStudentMessage(result.message);
        return;
      }
      if (result.data.length === 1) {
        await loadCard(result.data[0].id);
        return;
      }
      setCandidates(result.data);
      setStudentMessage(result.data.length === 0 ? 'Siswa tidak ditemukan. Periksa NIS atau ejaan nama.' : null);
    });
  }

  function scanCopy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const barcode = String(new FormData(form).get('barcode') ?? '');
    startTransition(async () => {
      const result = await lookupCopyAction(barcode);
      dispatch(result.ok ? { type: 'addCopy', copy: result.data } : { type: 'notice', message: result.message });
      // Spec 8.2: Enter menambahkan buku lalu mengosongkan kolom untuk pindaian berikutnya.
      form.reset();
      copyInput.current?.focus();
    });
  }

  function save() {
    if (!canSave || !desk.student) return;
    const input = { studentId: desk.student.student.id, copyIds: desk.copies.map((copy) => copy.id), notes };
    startTransition(async () => {
      const result = await createLoanAction(input);
      setOutcome(result);
      if (result.status === 'success') {
        dispatch({ type: 'reset' });
        setNotes('');
      }
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      save();
    }
  }

  if (outcome?.status === 'success') {
    return (
      <div role="status" className={`${PANEL} max-w-xl`}>
        <h2 className="page-title text-xl font-semibold">Peminjaman tersimpan</h2>
        <p className="mt-2 text-sm">
          Nomor transaksi <strong className="font-mono">{outcome.transactionNumber}</strong>. Jatuh tempo{' '}
          <strong>{formatDate(outcome.dueDate)}</strong>.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" autoFocus onClick={() => setOutcome(null)} className={buttonClass('primary')}>
            Peminjaman Baru
          </button>
          <Link href={`/transaksi/riwayat/${outcome.loanId}`} className={buttonClass('secondary')}>Lihat Transaksi</Link>
        </div>
      </div>
    );
  }

  return (
    <div onKeyDown={onKeyDown} className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="siswa-heading" className={PANEL}>
          <h2 id="siswa-heading" className={HEADING}>Siswa</h2>
          {desk.student ? (
            <StudentCard card={desk.student} onChange={() => dispatch({ type: 'clearStudent' })} />
          ) : (
            <>
              <form role="search" onSubmit={searchStudent}>
                <label htmlFor="student" className="sr-only">Scan kartu, NIS, atau nama siswa</label>
                <input id="student" name="student" autoFocus autoComplete="off" placeholder="Scan kartu / NIS / nama siswa" className={INPUT} />
              </form>
              {studentMessage && <p role="alert" className={`${ALERT} mt-2`}>{studentMessage}</p>}
              {candidates.length > 0 && (
                <ul className="mt-2 divide-y divide-[var(--color-ink-100)] rounded-md border border-[var(--color-ink-100)]">
                  {candidates.map((candidate) => (
                    <li key={candidate.id}>
                      <button
                        type="button"
                        onClick={() => startTransition(() => loadCard(candidate.id))}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-ink-50)]"
                      >
                        {candidate.name}
                        <span className="text-[var(--color-ink-500)]">
                          {' '}· {candidate.nis} · {candidate.className}{candidate.status === 'active' ? '' : ' · nonaktif'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

        <section aria-labelledby="buku-heading" className={PANEL}>
          <h2 id="buku-heading" className={HEADING}>Buku</h2>
          <form onSubmit={scanCopy}>
            <label htmlFor="barcode" className="sr-only">Scan barcode buku</label>
            <input ref={copyInput} id="barcode" name="barcode" autoComplete="off" placeholder="Scan barcode buku" className={INPUT} />
          </form>
          {desk.notice && <p role="alert" className={`${ALERT} mt-2`}>{desk.notice}</p>}
          {desk.copies.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-ink-500)]">Belum ada buku. Pindai barcode pada eksemplar.</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {desk.copies.map((copy, index) => (
                <li key={copy.id} className="flex items-start justify-between gap-2 text-sm">
                  <span>
                    {index + 1}. {copy.bookTitle}
                    <span className="block text-xs text-[var(--color-ink-500)]">
                      <span className="font-mono">{copy.barcode}</span>{copy.rackCode ? ` · Rak ${copy.rackCode}` : ''}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'removeCopy', id: copy.id })}
                    aria-label={`Hapus ${copy.barcode} dari daftar`}
                    className={buttonClass('secondary', 'sm')}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className={PANEL}>
        <p className="text-sm">
          Pinjam: <strong>{formatDate(loanDate)}</strong> · Jatuh tempo: <strong>{formatDate(dueDate)}</strong> ({durationDays} hari)
        </p>
        <label htmlFor="notes" className="mb-1 mt-3 block text-sm font-medium">Catatan</label>
        <textarea
          id="notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
          maxLength={500}
          className={INPUT}
        />
      </section>

      {outcome?.status === 'rejected' && (
        <div role="alert" className="rounded-md bg-[var(--color-status-terlambat)]/10 p-3 text-sm text-[var(--color-status-terlambat)]">
          <p className="font-semibold">Peminjaman ditolak</p>
          <ul className="mt-1 space-y-1">
            {outcome.violations.map((violation, index) => {
              const message = describeViolation(violation);
              return (
                <li key={`${violation.code}-${index}`}>
                  <span aria-hidden="true">⛔</span> <strong>{message.title}</strong> — {message.detail}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {outcome?.status === 'error' && <p role="alert" className={ALERT}>{outcome.message}</p>}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <span className="text-sm text-[var(--color-ink-500)]">
          {desk.copies.length} buku{slots === null ? '' : ` · slot tersisa ${slots}`}
        </span>
        <button type="button" onClick={save} disabled={!canSave} className={buttonClass('primary')}>
          {pending ? 'Memproses…' : 'Simpan Peminjaman'}
          <kbd className="ml-2 text-xs opacity-80">Ctrl+Enter</kbd>
        </button>
      </div>
    </div>
  );
}
```

- [x] **Step 7: Implementasikan halaman**

Buat `src/app/(app)/transaksi/peminjaman/page.tsx`:

```tsx
import { calculateDueDate } from '@/domain/loan/due-date';
import { PageHeader } from '@/components/ui/page-header';
import { schoolToday } from '@/lib/school-date';
import { requireProfile } from '@/server/auth/guard';
import { getActiveAcademicYear } from '@/server/queries/academic-years';
import { getLibrarySettings } from '@/server/queries/settings';
import { LoanDesk } from './loan-desk';

export default async function LoanPage() {
  await requireProfile();
  const today = schoolToday();
  const [settings, activeYear] = await Promise.all([getLibrarySettings(), getActiveAcademicYear()]);

  return (
    <>
      <PageHeader
        title="Peminjaman"
        description="Pindai kartu siswa, lalu pindai barcode setiap buku. Tekan Ctrl+Enter untuk menyimpan."
      />
      {!activeYear && (
        <p role="alert" className="mb-4 rounded-md bg-[var(--color-status-terlambat)]/10 px-3 py-2 text-sm text-[var(--color-status-terlambat)]">
          Belum ada tahun ajaran aktif. Peminjaman tidak dapat disimpan sampai admin mengaktifkannya di Pengaturan → Tahun Ajaran.
        </p>
      )}
      <LoanDesk
        loanDate={today}
        dueDate={calculateDueDate(today, settings.loanDurationDays)}
        durationDays={settings.loanDurationDays}
      />
    </>
  );
}
```

- [x] **Step 8: Jalankan uji halaman dan pastikan lulus**

Run: `npx vitest run "src/app/(app)/transaksi/peminjaman"`
Expected: PASS. Bila React merender atribut `autoFocus` dengan ejaan lain di markup statis, sesuaikan regex uji agar tetap memeriksa bahwa kolom siswa difokuskan otomatis (catat di laporan).

- [x] **Step 9: Jalankan seluruh uji unit, lint, dan tsc**

Run: `npm test && npm run lint && npx tsc --noEmit`
Expected: PASS/bersih.

- [x] **Step 10: Commit**

```bash
git add src/lib/circulation-results.ts src/server/actions/loans.ts src/server/actions/loans.test.ts \
  "src/app/(app)/transaksi/peminjaman"
git commit -m "$(cat <<'EOF'
feat(peminjaman): meja peminjaman satu layar dengan pindai papan ketik

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Layar Pengembalian

Satu kolom pencarian universal (nomor transaksi, NIS, nama, atau barcode buku; spec 8.3). Bila hanya satu pinjaman yang cocok, pinjaman itu langsung terbuka. Setiap buku yang belum kembali tampil dengan kotak centang (tercentang secara bawaan — mengembalikan semua adalah kasus tersering) dan pilihan kondisi. Panel kanan menghitung denda **saat pilihan berubah**, sebelum tombol ditekan, memakai `calculateItemFine()` yang sama dengan server. Setelah disimpan, petugas diarahkan ke detail transaksi dengan pesan total denda.

**Files:**
- Modify: `src/components/ui/filter-bar.tsx`, `src/components/ui/list-parts.test.tsx`
- Create: `src/server/actions/returns.ts`, `src/server/actions/returns.test.ts`
- Create: `src/app/(app)/transaksi/pengembalian/return-preview.ts`, `return-preview.test.ts`
- Create: `src/app/(app)/transaksi/pengembalian/return-form.tsx`
- Create: `src/app/(app)/transaksi/pengembalian/page.tsx`, `page.test.tsx`

**Interfaces:**
- Consumes: `processReturn` (Task 4), `returnSchema` (Task 4), `findLoansForReturn`, `getLoanDetail`, `ReturnCandidate`, `LoanDetail` (Task 4); `RETURN_CONDITION_OPTIONS` (Task 6); `LoanStatusBadge` (Task 6); `calculateItemFine` (domain); `schoolToday`; `getLibrarySettings`; `authorize`; `formError`, `FormState`; `formatDate`, `formatRupiah`; `withQuery`, `firstValue`
- Produces:
  - `FilterBar` menerima `autoFocus?: boolean`
  - `processReturnAction(input: unknown): Promise<FormState>` — sukses: redirect ke `/transaksi/riwayat/<id>?pesan=…`
  - `interface ReturnableItem { id: string; barcode: string; bookTitle: string; bookPrice: number }`, `interface ReturnRowState { selected: boolean; condition: ReturnCondition; replacementFee: string; note: string }`
  - `initialRows(items)`, `parseRupiahInput(raw: string): number | null`, `previewReturn(items, rows, context): ReturnPreview`, `toReturnInput(loanId, items, rows)`
  - `<ReturnForm loan today finePerDay />`; rute `/transaksi/pengembalian`

- [x] **Step 1: Tulis uji `autoFocus` FilterBar yang gagal**

Tambahkan di `src/components/ui/list-parts.test.tsx` (impor `FilterBar` dari `./filter-bar` bila belum ada):

```tsx
describe('FilterBar autoFocus', () => {
  it('memfokuskan kolom pencarian bila diminta, dan tidak secara bawaan', () => {
    expect(renderToStaticMarkup(<FilterBar q="" placeholder="Cari" autoFocus />)).toMatch(/<input[^>]*autofocus=""/i);
    expect(renderToStaticMarkup(<FilterBar q="" placeholder="Cari" />)).not.toMatch(/autofocus/i);
  });
});
```

Run: `npx vitest run src/components/ui/list-parts.test.tsx`
Expected: FAIL — `autoFocus` belum diteruskan ke `<input>`.

- [x] **Step 2: Tambahkan `autoFocus` ke FilterBar**

Di `src/components/ui/filter-bar.tsx`, ubah tanda tangan dan `<input>` `FilterBar`:

```tsx
export function FilterBar({
  q, placeholder, autoFocus, children,
}: { q: string; placeholder: string; autoFocus?: boolean; children?: ReactNode }) {
  return (
    <form role="search" className="mb-4 flex flex-wrap items-center gap-2">
      <input
        type="search"
        name="q"
        defaultValue={q}
        placeholder={placeholder}
        aria-label={placeholder}
        autoFocus={autoFocus}
        className={`${CONTROL} min-w-64 flex-1`}
      />
      {children}
      <button type="submit" className={buttonClass('secondary')}>Cari</button>
    </form>
  );
}
```

Run: `npx vitest run src/components/ui/list-parts.test.tsx`
Expected: PASS.

- [x] **Step 3: Tulis uji pratinjau yang gagal**

Buat `src/app/(app)/transaksi/pengembalian/return-preview.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  initialRows, parseRupiahInput, previewReturn, toReturnInput, type ReturnableItem,
} from './return-preview';

const items: ReturnableItem[] = [
  { id: 'i1', barcode: 'BK-000001', bookTitle: 'Pemrograman Web', bookPrice: 85000 },
  { id: 'i2', barcode: 'BK-000002', bookTitle: 'Buku Sumbangan', bookPrice: 0 },
];
const context = { dueDate: '2090-03-05', today: '2090-03-09', finePerDay: 1000 };

describe('parseRupiahInput', () => {
  it('menerima titik ribuan, menganggap kosong sebagai null, dan menandai selain angka', () => {
    expect(parseRupiahInput('30.000')).toBe(30000);
    expect(parseRupiahInput(' ')).toBeNull();
    expect(parseRupiahInput('tiga puluh')).toBeNaN();
  });
});

describe('previewReturn', () => {
  it('mencentang semua buku dengan kondisi Baik dan biaya ganti sebesar harga katalog secara bawaan', () => {
    expect(initialRows(items)).toEqual({
      i1: { selected: true, condition: 'BAIK', replacementFee: '85000', note: '' },
      i2: { selected: true, condition: 'BAIK', replacementFee: '0', note: '' },
    });
  });

  it('menghitung denda telat per eksemplar yang dicentang', () => {
    const rows = { ...initialRows(items), i2: { ...initialRows(items).i2, selected: false } };

    expect(previewReturn(items, rows, context)).toEqual({
      lines: [{ itemId: 'i1', daysLate: 4, lateFine: 4000, replacementFee: 0, total: 4000 }],
      total: 4000,
      problems: [],
      warnings: [],
    });
  });

  it('menumpuk biaya ganti yang ditimpa petugas untuk buku rusak', () => {
    const rows = initialRows(items);
    rows.i1 = { ...rows.i1, condition: 'RUSAK', replacementFee: '60.000' };
    rows.i2 = { ...rows.i2, selected: false };

    expect(previewReturn(items, rows, context).lines).toEqual([
      { itemId: 'i1', daysLate: 4, lateFine: 4000, replacementFee: 60000, total: 64000 },
    ]);
  });

  it('memperingatkan biaya ganti Rp0 untuk buku rusak atau hilang (spec §12)', () => {
    const rows = initialRows(items);
    rows.i1 = { ...rows.i1, selected: false };
    rows.i2 = { ...rows.i2, condition: 'HILANG' };

    expect(previewReturn(items, rows, context).warnings).toEqual([
      'Biaya ganti BK-000002 Rp0. Isi biaya ganti bila buku ini memang harus diganti.',
    ]);
  });

  it('menahan penyimpanan bila biaya ganti bukan angka atau tidak ada buku yang dicentang', () => {
    const invalid = initialRows(items);
    invalid.i1 = { ...invalid.i1, condition: 'RUSAK', replacementFee: 'mahal' };
    expect(previewReturn(items, invalid, context).problems).toEqual([
      'Isi biaya ganti BK-000001 dengan angka, misalnya 50.000.',
    ]);

    const none = { i1: { ...invalid.i1, selected: false }, i2: { ...invalid.i2, selected: false } };
    expect(previewReturn(items, none, context).problems).toEqual(['Centang minimal satu buku yang dikembalikan.']);
  });
});

describe('toReturnInput', () => {
  it('mengirim hanya buku yang dicentang, dengan biaya ganti hanya untuk yang rusak atau hilang', () => {
    const rows = initialRows(items);
    rows.i1 = { ...rows.i1, condition: 'RUSAK', replacementFee: '60.000', note: ' sampul sobek ' };
    rows.i2 = { ...rows.i2, selected: false };

    expect(toReturnInput('l1', items, rows)).toEqual({
      loanId: 'l1',
      items: [{ loanItemId: 'i1', condition: 'RUSAK', replacementFee: 60000, note: 'sampul sobek' }],
    });
  });

  it('mengirim biaya ganti null untuk buku dalam kondisi baik', () => {
    expect(toReturnInput('l1', [items[0]], initialRows([items[0]])).items[0])
      .toEqual({ loanItemId: 'i1', condition: 'BAIK', replacementFee: null, note: null });
  });
});
```

Run: `npx vitest run "src/app/(app)/transaksi/pengembalian/return-preview.test.ts"`
Expected: FAIL — modul `./return-preview` tidak ditemukan.

- [x] **Step 4: Implementasikan pratinjau**

Buat `src/app/(app)/transaksi/pengembalian/return-preview.ts`:

```ts
import { calculateItemFine } from '@/domain/return/fine';
import type { IsoDate } from '@/domain/shared/date';
import type { ReturnCondition } from '@/domain/shared/types';

export interface ReturnableItem {
  id: string;
  barcode: string;
  bookTitle: string;
  bookPrice: number;
}

export interface ReturnRowState {
  selected: boolean;
  condition: ReturnCondition;
  /** Isian mentah kolom biaya ganti, misalnya '85.000'. */
  replacementFee: string;
  note: string;
}

export interface PreviewLine {
  itemId: string;
  daysLate: number;
  lateFine: number;
  replacementFee: number;
  total: number;
}

export interface ReturnPreview {
  lines: PreviewLine[];
  total: number;
  /** Menahan penyimpanan. */
  problems: string[];
  /** Diperlihatkan, tetapi tidak menahan penyimpanan. */
  warnings: string[];
}

/** Mengembalikan semua buku adalah kasus tersering, jadi semuanya tercentang. */
export function initialRows(items: ReturnableItem[]): Record<string, ReturnRowState> {
  return Object.fromEntries(items.map((item) => [
    item.id,
    { selected: true, condition: 'BAIK' as ReturnCondition, replacementFee: String(item.bookPrice), note: '' },
  ]));
}

/** '30.000' → 30000; kosong → null; selain angka → NaN. */
export function parseRupiahInput(raw: string): number | null {
  const digits = raw.replace(/[.\s]/g, '');
  if (digits === '') return null;
  return /^\d+$/.test(digits) ? Number(digits) : Number.NaN;
}

function feeOf(row: ReturnRowState): number | null {
  return row.condition === 'BAIK' ? null : parseRupiahInput(row.replacementFee);
}

/**
 * Denda dihitung di peramban dengan fungsi domain yang sama dengan server,
 * sehingga nominalnya terlihat SEBELUM tombol ditekan (spec 8.3). Server tetap
 * menghitung ulang saat menyimpan.
 */
export function previewReturn(
  items: ReturnableItem[],
  rows: Record<string, ReturnRowState>,
  context: { dueDate: IsoDate; today: IsoDate; finePerDay: number },
): ReturnPreview {
  const lines: PreviewLine[] = [];
  const problems: string[] = [];
  const warnings: string[] = [];

  for (const item of items) {
    const row = rows[item.id];
    if (!row?.selected) continue;
    const fee = feeOf(row);
    if (row.condition !== 'BAIK' && (fee === null || Number.isNaN(fee))) {
      problems.push(`Isi biaya ganti ${item.barcode} dengan angka, misalnya 50.000.`);
      continue;
    }
    if (row.condition !== 'BAIK' && fee === 0) {
      warnings.push(`Biaya ganti ${item.barcode} Rp0. Isi biaya ganti bila buku ini memang harus diganti.`);
    }
    const fine = calculateItemFine({
      dueDate: context.dueDate,
      returnDate: context.today,
      condition: row.condition,
      finePerDay: context.finePerDay,
      bookPrice: item.bookPrice,
      replacementFeeOverride: fee ?? undefined,
    });
    lines.push({ itemId: item.id, ...fine });
  }

  if (lines.length === 0 && problems.length === 0) problems.push('Centang minimal satu buku yang dikembalikan.');
  return { lines, total: lines.reduce((sum, line) => sum + line.total, 0), problems, warnings };
}

export function toReturnInput(loanId: string, items: ReturnableItem[], rows: Record<string, ReturnRowState>) {
  return {
    loanId,
    items: items
      .filter((item) => rows[item.id]?.selected)
      .map((item) => {
        const row = rows[item.id];
        return {
          loanItemId: item.id,
          condition: row.condition,
          replacementFee: feeOf(row),
          note: row.note.trim() || null,
        };
      }),
  };
}
```

Run: `npx vitest run "src/app/(app)/transaksi/pengembalian/return-preview.test.ts"`
Expected: PASS.

- [x] **Step 5: Tulis uji Server Action yang gagal**

Buat `src/server/actions/returns.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formError } from '@/lib/form-state';

const { mockAuthorize, mockProcessReturn, mockRevalidatePath, mockRedirect } = vi.hoisted(() => ({
  mockAuthorize: vi.fn(),
  mockProcessReturn: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockRedirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

vi.mock('@/server/auth/guard', () => ({ authorize: mockAuthorize }));
vi.mock('@/server/services/returns', () => ({ processReturn: mockProcessReturn }));
vi.mock('@/lib/school-date', () => ({ schoolToday: () => '2090-03-09' }));
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }));
vi.mock('next/navigation', () => ({ redirect: mockRedirect }));

import { processReturnAction } from './returns';

const actor = { id: 'u1', role: 'petugas' as const };
const loanId = '6f1c2b1e-4b1a-4c3e-9f7a-2d1e3c4b5a6f';
const loanItemId = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const input = { loanId, items: [{ loanItemId, condition: 'BAIK', replacementFee: null, note: null }] };

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthorize.mockResolvedValue({ ok: true, actor });
});

describe('processReturnAction', () => {
  it('menolak sebelum membaca isian bila peran tidak diizinkan', async () => {
    mockAuthorize.mockResolvedValueOnce({ ok: false, message: 'Akses ditolak.' });
    expect(await processReturnAction(input)).toEqual(formError('Akses ditolak.'));
    expect(mockAuthorize).toHaveBeenCalledWith(['admin', 'petugas']);
    expect(mockProcessReturn).not.toHaveBeenCalled();
  });

  it('menampilkan galat validasi pertama', async () => {
    expect(await processReturnAction({ loanId, items: [] }))
      .toEqual(formError('Centang minimal satu buku yang dikembalikan.'));
  });

  it('meneruskan penolakan service', async () => {
    mockProcessReturn.mockResolvedValueOnce({ ok: false, message: 'Transaksi tidak ditemukan.' });
    expect(await processReturnAction(input)).toEqual(formError('Transaksi tidak ditemukan.'));
  });

  it('menyimpan dengan tanggal sekolah lalu pindah ke detail transaksi dengan total denda', async () => {
    mockProcessReturn.mockResolvedValueOnce({ ok: true, id: loanId, notice: 'Total denda transaksi ini Rp4.000.' });

    await expect(processReturnAction(input)).rejects.toThrow('NEXT_REDIRECT');

    expect(mockProcessReturn).toHaveBeenCalledWith(input, actor, '2090-03-09');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/transaksi/riwayat');
    expect(mockRedirect).toHaveBeenCalledWith(
      `/transaksi/riwayat/${loanId}?pesan=${encodeURIComponent('Pengembalian tersimpan. Total denda transaksi ini Rp4.000.')}`,
    );
  });
});
```

Run: `npx vitest run src/server/actions/returns.test.ts`
Expected: FAIL — modul `./returns` tidak ditemukan.

- [x] **Step 6: Implementasikan Server Action**

Buat `src/server/actions/returns.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { formError, type FormState } from '@/lib/form-state';
import { schoolToday } from '@/lib/school-date';
import { authorize } from '@/server/auth/guard';
import { processReturn } from '@/server/services/returns';
import { returnSchema } from '@/server/validation/return';

/**
 * Masukan berbentuk objek (bukan FormData) karena satu pengembalian memuat
 * beberapa buku, masing-masing dengan kondisi dan biaya gantinya.
 */
export async function processReturnAction(input: unknown): Promise<FormState> {
  const auth = await authorize(['admin', 'petugas']);
  if (!auth.ok) return formError(auth.message);

  const parsed = returnSchema.safeParse(input);
  if (!parsed.success) {
    return formError(parsed.error.issues[0]?.message ?? 'Data pengembalian tidak valid. Muat ulang halaman.');
  }

  const result = await processReturn(parsed.data, auth.actor, schoolToday());
  if (!result.ok) return formError(result.message);

  for (const path of ['/transaksi/riwayat', '/transaksi/pengembalian', '/master/buku']) revalidatePath(path);
  const message = result.notice ? `Pengembalian tersimpan. ${result.notice}` : 'Pengembalian tersimpan.';
  // redirect() melempar; sengaja di luar try/catch.
  redirect(`/transaksi/riwayat/${result.id}?pesan=${encodeURIComponent(message)}`);
}
```

Run: `npx vitest run src/server/actions/returns.test.ts`
Expected: PASS.

- [x] **Step 7: Tulis uji halaman yang gagal**

Buat `src/app/(app)/transaksi/pengembalian/page.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockFind, mockDetail } = vi.hoisted(() => ({ mockFind: vi.fn(), mockDetail: vi.fn() }));

vi.mock('@/server/queries/loans', () => ({ findLoansForReturn: mockFind, getLoanDetail: mockDetail }));
vi.mock('@/server/queries/settings', () => ({ getLibrarySettings: vi.fn(async () => ({ finePerDay: 1000 })) }));
vi.mock('@/server/actions/returns', () => ({ processReturnAction: vi.fn() }));
vi.mock('@/lib/school-date', () => ({ schoolToday: () => '2090-03-09' }));
vi.mock('@/server/auth/guard', () => ({
  requireProfile: vi.fn(async () => ({ id: 'u1', role: 'petugas', fullName: 'Petugas', status: 'active' })),
}));

import ReturnPage from './page';

const candidate = {
  id: 'l1', transactionNumber: 'PJM-20900302-0001', studentName: 'Ahmad Fauzi', studentNis: '202600123',
  studentClass: 'XI RPL 1', loanDate: '2090-03-02', dueDate: '2090-03-05', openCount: 1, daysOverdue: 4,
};

const detail = {
  ...candidate,
  status: 'SEBAGIAN_KEMBALI',
  notes: null,
  studentId: 's1',
  academicYearName: '2089/2090',
  createdByName: 'Petugas',
  totalFine: 0,
  paidTotal: 0,
  unpaidFine: 0,
  items: [
    {
      id: 'i1', bookCopyId: 'c1', barcode: 'BK-000001', bookTitle: 'Pemrograman Web', bookPrice: 85000,
      returnedAt: new Date(), returnCondition: 'BAIK', daysLate: 0, lateFine: 0, replacementFee: 0, conditionNote: null,
    },
    {
      id: 'i2', bookCopyId: 'c2', barcode: 'BK-000002', bookTitle: 'Basis Data', bookPrice: 60000,
      returnedAt: null, returnCondition: null, daysLate: 0, lateFine: 0, replacementFee: 0, conditionNote: null,
    },
  ],
  payments: [],
};

async function render(params: Record<string, string> = {}) {
  return renderToStaticMarkup(await ReturnPage({ searchParams: Promise.resolve(params) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFind.mockResolvedValue([]);
  mockDetail.mockResolvedValue(null);
});

describe('ReturnPage', () => {
  it('memfokuskan kolom pencarian universal saat dibuka tanpa kata kunci', async () => {
    const html = await render();
    expect(html).toMatch(/<input[^>]*autofocus=""/i);
    expect(mockFind).not.toHaveBeenCalled();
  });

  it('langsung membuka satu-satunya pinjaman yang cocok, hanya dengan buku yang belum kembali', async () => {
    mockFind.mockResolvedValueOnce([candidate]);
    mockDetail.mockResolvedValueOnce(detail);

    const html = await render({ q: '202600123' });

    expect(mockFind).toHaveBeenCalledWith('202600123', '2090-03-09');
    expect(mockDetail).toHaveBeenCalledWith('l1', '2090-03-09');
    expect(html).toContain('BK-000002');
    expect(html).not.toContain('BK-000001');
    expect(html).toContain('Terlambat 4 hari');
    expect(html).toContain('Simpan Pengembalian');
    expect(html).toContain('Rp4.000');
  });

  it('menampilkan daftar pilihan bila lebih dari satu pinjaman cocok', async () => {
    mockFind.mockResolvedValueOnce([candidate, { ...candidate, id: 'l2', transactionNumber: 'PJM-20900302-0002' }]);

    const html = await render({ q: 'ahmad' });

    expect(mockDetail).not.toHaveBeenCalled();
    expect(html).toContain('href="/transaksi/pengembalian?q=ahmad&amp;pinjam=l2"');
  });

  it('menjelaskan bila tidak ada pinjaman terbuka yang cocok', async () => {
    const html = await render({ q: 'tidak-ada' });
    expect(html).toContain('Tidak ada peminjaman yang masih berjalan untuk &quot;tidak-ada&quot;.');
  });

  it('mengarahkan ke riwayat bila pinjaman yang dipilih sudah selesai', async () => {
    mockDetail.mockResolvedValueOnce({ ...detail, status: 'SELESAI' });
    const html = await render({ pinjam: 'l1' });
    expect(html).toContain('sudah selesai');
    expect(html).toContain('href="/transaksi/riwayat/l1"');
  });
});
```

Run: `npx vitest run "src/app/(app)/transaksi/pengembalian/page.test.tsx"`
Expected: FAIL — modul `./page` tidak ditemukan.

- [x] **Step 8: Implementasikan form pengembalian**

Buat `src/app/(app)/transaksi/pengembalian/return-form.tsx`:

```tsx
'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { buttonClass } from '@/components/ui/button-styles';
import type { ReturnCondition } from '@/domain/shared/types';
import { RETURN_CONDITION_OPTIONS } from '@/lib/circulation-labels';
import { formatRupiah } from '@/lib/format';
import { processReturnAction } from '@/server/actions/returns';
import {
  initialRows, previewReturn, toReturnInput, type ReturnableItem, type ReturnRowState,
} from './return-preview';

const CONTROL = 'rounded-md border border-[var(--color-ink-300)] bg-white px-2 py-1.5 text-sm';

export function ReturnForm({
  loan,
  today,
  finePerDay,
}: {
  loan: { id: string; dueDate: string; items: ReturnableItem[] };
  today: string;
  finePerDay: number;
}) {
  const [rows, setRows] = useState(() => initialRows(loan.items));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const preview = previewReturn(loan.items, rows, { dueDate: loan.dueDate, today, finePerDay });
  const lineOf = new Map(preview.lines.map((line) => [line.itemId, line]));

  function update(id: string, patch: Partial<ReturnRowState>) {
    setRows((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (preview.problems.length > 0) return;
    setError(null);
    startTransition(async () => {
      // Berhasil: Server Action mengarahkan ke detail transaksi.
      const state = await processReturnAction(toReturnInput(loan.id, loan.items, rows));
      if (state.status === 'error') setError(state.message);
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-3 lg:col-span-2">
        {loan.items.map((item) => {
          const row = rows[item.id];
          const line = lineOf.get(item.id);
          return (
            <fieldset key={item.id} className="rounded-lg border border-[var(--color-ink-100)] bg-white p-3">
              <legend className="sr-only">{item.barcode} {item.bookTitle}</legend>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  id={`kembali-${item.id}`}
                  type="checkbox"
                  checked={row.selected}
                  onChange={(event) => update(item.id, { selected: event.target.checked })}
                  className="size-4 accent-[var(--color-accent-600)]"
                />
                <label htmlFor={`kembali-${item.id}`} className="flex-1 text-sm">
                  <span className="font-mono">{item.barcode}</span> · {item.bookTitle}
                </label>
                <label htmlFor={`kondisi-${item.id}`} className="sr-only">Kondisi {item.barcode}</label>
                <select
                  id={`kondisi-${item.id}`}
                  value={row.condition}
                  disabled={!row.selected}
                  onChange={(event) => update(item.id, { condition: event.target.value as ReturnCondition })}
                  className={CONTROL}
                >
                  {RETURN_CONDITION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              {row.selected && row.condition !== 'BAIK' && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor={`ganti-${item.id}`} className="mb-1 block text-xs font-medium">Biaya ganti (Rp)</label>
                    <input
                      id={`ganti-${item.id}`}
                      inputMode="numeric"
                      value={row.replacementFee}
                      onChange={(event) => update(item.id, { replacementFee: event.target.value })}
                      className={`${CONTROL} w-full`}
                    />
                    <p className="mt-1 text-xs text-[var(--color-ink-500)]">Harga katalog {formatRupiah(item.bookPrice)}.</p>
                  </div>
                  <div>
                    <label htmlFor={`catatan-${item.id}`} className="mb-1 block text-xs font-medium">Catatan kondisi</label>
                    <input
                      id={`catatan-${item.id}`}
                      value={row.note}
                      maxLength={500}
                      onChange={(event) => update(item.id, { note: event.target.value })}
                      className={`${CONTROL} w-full`}
                    />
                  </div>
                </div>
              )}
              {line && line.total > 0 && (
                <p className="mt-2 text-xs text-[var(--color-ink-700)]">
                  {line.daysLate > 0 && `Telat ${line.daysLate} hari · ${formatRupiah(line.lateFine)}`}
                  {line.daysLate > 0 && line.replacementFee > 0 && ' · '}
                  {line.replacementFee > 0 && `Biaya ganti ${formatRupiah(line.replacementFee)}`}
                </p>
              )}
            </fieldset>
          );
        })}
      </div>

      <aside className="h-fit rounded-lg border border-[var(--color-ink-100)] bg-white p-4" aria-live="polite">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-500)]">Denda pengembalian ini</p>
        <p className="tabular mt-1 text-2xl font-semibold">{formatRupiah(preview.total)}</p>
        <p className="mt-1 text-xs text-[var(--color-ink-500)]">{preview.lines.length} buku dikembalikan</p>
        {preview.warnings.map((warning) => (
          <p key={warning} className="mt-2 text-xs text-[var(--color-status-rusak)]">{warning}</p>
        ))}
        {preview.problems.map((problem) => (
          <p key={problem} role="alert" className="mt-2 text-xs text-[var(--color-status-terlambat)]">{problem}</p>
        ))}
        {error && <p role="alert" className="mt-2 text-sm text-[var(--color-status-terlambat)]">{error}</p>}
        <button
          type="submit"
          disabled={pending || preview.problems.length > 0}
          className={`${buttonClass('primary')} mt-4 w-full`}
        >
          {pending ? 'Menyimpan…' : 'Simpan Pengembalian'}
        </button>
      </aside>
    </form>
  );
}
```

- [x] **Step 9: Implementasikan halaman**

Buat `src/app/(app)/transaksi/pengembalian/page.tsx`:

```tsx
import Link from 'next/link';
import { buttonClass } from '@/components/ui/button-styles';
import { FilterBar } from '@/components/ui/filter-bar';
import { LoanStatusBadge } from '@/components/ui/loan-status-badge';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollTable } from '@/components/ui/scroll-table';
import { TD, TH } from '@/components/ui/table-styles';
import { formatDate } from '@/lib/format';
import { schoolToday } from '@/lib/school-date';
import { firstValue, withQuery, type SearchParams } from '@/lib/search-params';
import { requireProfile } from '@/server/auth/guard';
import { findLoansForReturn, getLoanDetail } from '@/server/queries/loans';
import { getLibrarySettings } from '@/server/queries/settings';
import { ReturnForm } from './return-form';

export default async function ReturnPage({ searchParams }: { searchParams: SearchParams }) {
  await requireProfile();
  const params = await searchParams;
  const q = firstValue(params.q);
  const chosen = firstValue(params.pinjam);
  const today = schoolToday();

  const candidates = q ? await findLoansForReturn(q, today) : [];
  const selectedId = chosen || (candidates.length === 1 ? candidates[0].id : '');
  const [loan, settings] = await Promise.all([
    selectedId ? getLoanDetail(selectedId, today) : Promise.resolve(null),
    getLibrarySettings(),
  ]);

  return (
    <>
      <PageHeader
        title="Pengembalian"
        description="Cari dengan nomor transaksi, NIS, nama siswa, atau pindai barcode salah satu bukunya."
      />
      <FilterBar q={q} placeholder="No. transaksi, NIS, nama siswa, atau barcode buku" autoFocus={!loan} />

      {q && candidates.length === 0 && !loan && (
        <p className="mb-4 text-sm text-[var(--color-ink-500)]">
          Tidak ada peminjaman yang masih berjalan untuk &quot;{q}&quot;. Periksa ejaan, atau cari di{' '}
          <Link href="/transaksi/riwayat" className="text-[var(--color-accent-600)] hover:underline">Riwayat Transaksi</Link>{' '}
          bila bukunya sudah dikembalikan.
        </p>
      )}

      {candidates.length > 1 && (
        <div className="mb-6">
          <ScrollTable>
            <thead>
              <tr>
                <th className={TH}>No. Transaksi</th>
                <th className={TH}>Siswa</th>
                <th className={TH}>Jatuh Tempo</th>
                <th className={TH}>Belum Kembali</th>
                <th className={TH}><span className="sr-only">Aksi</span></th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((candidate) => (
                <tr key={candidate.id} aria-current={candidate.id === selectedId ? 'true' : undefined}>
                  <td className={`${TD} font-mono`}>{candidate.transactionNumber}</td>
                  <td className={TD}>
                    {candidate.studentName}
                    <span className="block text-xs text-[var(--color-ink-500)]">{candidate.studentNis} · {candidate.studentClass}</span>
                  </td>
                  <td className={TD}>
                    {formatDate(candidate.dueDate)}
                    {candidate.daysOverdue > 0 && (
                      <span className="block text-xs text-[var(--color-status-terlambat)]">Terlambat {candidate.daysOverdue} hari</span>
                    )}
                  </td>
                  <td className={TD}>{candidate.openCount} buku</td>
                  <td className={TD}>
                    <Link href={withQuery('/transaksi/pengembalian', { q, pinjam: candidate.id })} className={buttonClass('secondary', 'sm')}>
                      Pilih
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </ScrollTable>
        </div>
      )}

      {loan && loan.status === 'SELESAI' && (
        <p className="text-sm">
          Transaksi {loan.transactionNumber} sudah selesai; seluruh bukunya sudah kembali.{' '}
          <Link href={`/transaksi/riwayat/${loan.id}`} className="text-[var(--color-accent-600)] hover:underline">Lihat rinciannya</Link>.
        </p>
      )}

      {loan && loan.status !== 'SELESAI' && (
        <section aria-labelledby="pinjaman-heading">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 id="pinjaman-heading" className="page-title text-lg font-semibold">
              <span className="font-mono">{loan.transactionNumber}</span> · {loan.studentName}
            </h2>
            <span className="text-sm text-[var(--color-ink-500)]">
              NIS {loan.studentNis} · jatuh tempo {formatDate(loan.dueDate)}
            </span>
            <LoanStatusBadge status={loan.status} daysOverdue={loan.daysOverdue} />
          </div>
          <ReturnForm
            key={loan.id}
            loan={{
              id: loan.id,
              dueDate: loan.dueDate,
              items: loan.items
                .filter((item) => item.returnedAt === null)
                .map(({ id, barcode, bookTitle, bookPrice }) => ({ id, barcode, bookTitle, bookPrice })),
            }}
            today={today}
            finePerDay={settings.finePerDay}
          />
        </section>
      )}
    </>
  );
}
```

- [x] **Step 10: Jalankan uji halaman dan pastikan lulus**

Run: `npx vitest run "src/app/(app)/transaksi/pengembalian"`
Expected: PASS. (Pratinjau di markup statis: satu buku BK-000002 tercentang, jatuh tempo 05/03, hari ini 09/03, denda Rp1.000/hari → `Rp4.000`.)

- [x] **Step 11: Jalankan seluruh uji unit, lint, dan tsc**

Run: `npm test && npm run lint && npx tsc --noEmit`
Expected: PASS/bersih.

- [x] **Step 12: Commit**

```bash
git add src/components/ui/filter-bar.tsx src/components/ui/list-parts.test.tsx \
  src/server/actions/returns.ts src/server/actions/returns.test.ts "src/app/(app)/transaksi/pengembalian"
git commit -m "$(cat <<'EOF'
feat(pengembalian): pencarian universal dan pratinjau denda sebelum simpan

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Verifikasi Akhir

Tidak ada kode baru. Task ini membuktikan seluruh alur transaksi bekerja bersama, di mesin dan di peramban, lalu mengembalikan eksemplar seed ke keadaan `TERSEDIA`.

**Files:**
- Tidak ada berkas yang dibuat. Pemeriksaan manual menulis transaksi sungguhan ke Supabase cloud (lihat Step 5).

**Interfaces:**
- Consumes: seluruh keluaran Task 1–8
- Produces: bukti bahwa Rencana 04 selesai

- [x] **Step 1: Jalankan seluruh pemeriksaan otomatis**

```bash
npm test
npm run test:integration
npm run lint
npx tsc --noEmit
npm run build
```

Harapan: seluruhnya lulus, termasuk `tests/integration/loan-concurrency.test.ts`. `npm run build` mencantumkan rute `/transaksi/peminjaman`, `/transaksi/pengembalian`, `/transaksi/riwayat`, dan `/transaksi/riwayat/[id]`.

- [x] **Step 2: Pastikan uji integrasi tidak meninggalkan jejak**

`npx tsx -e "import(...)"` tidak dapat dipakai di repo ini. Pakai berkas sementara dengan impor statis, lalu hapus:

```bash
cat > tmp-sisa.ts <<'EOF'
import { sql } from 'drizzle-orm';
import { db } from './src/server/db/client';

async function main() {
  const [row] = await db.execute(sql`
    select
      (select count(*) from loans where transaction_number like 'UJI-%' or transaction_number like 'PJM-2090%')
    + (select count(*) from counters where scope like 'loan:2090%')
    + (select count(*) from students where nis like 'UJI-%')
    + (select count(*) from book_copies where barcode like 'UJI-%')
    + (select count(*) from academic_years where name like 'UJI-%') as sisa
  `);
  console.log('Sisa data uji:', row?.sisa);
  process.exit(0);
}
main();
EOF
npx tsx --env-file=.env.local tmp-sisa.ts
rm tmp-sisa.ts
```

Harapan: `Sisa data uji: 0`. Angka lain berarti ada uji yang ditulis di luar `withRollback()`; temukan dan perbaiki ujinya, jangan hapus datanya tanpa memahami asalnya.

- [x] **Step 3: Uji alur lengkap di peramban**

Jalankan `npm run dev`. Bila memakai agen, gunakan skill `/browse` (bukan `mcp__claude-in-chrome__*`).

Persiapan sebagai **petugas** (`petugas` / `perpus123`) di Master Data → Siswa: tambah siswa `QA-001` "Siswa QA Satu" kelas "XI QA" dan `QA-002` "Siswa QA Dua" kelas "XI QA". Seluruh transaksi di bawah memakai kedua siswa ini, bukan siswa seed.

**Peminjaman** (`/transaksi/peminjaman`):
1. Kolom siswa langsung terfokus. Ketik `QA-001` + Enter → kartu "Siswa QA Satu", "Sedang dipinjam 0 dari 3", "Tidak ada keterlambatan atau tunggakan denda."; fokus pindah ke kolom buku.
2. Pindai `BK-000001` + Enter → masuk daftar, kolom kosong lagi. Pindai `bk-000004` (huruf kecil) → masuk. Pindai `BK-000001` lagi → "Eksemplar BK-000001 sudah ada di daftar." Pindai `XX-1` → "Barcode XX-1 tidak terdaftar…".
3. Pindai `BK-000007` (buku "Contoh QA" yang nonaktif sejak Rencana 02) → pesan "Buku "Contoh QA" nonaktif…", tidak masuk daftar.
4. Tekan `Ctrl+Enter` → "Peminjaman tersimpan" dengan nomor `PJM-<tanggal hari ini WIB>-NNNN` dan jatuh tempo +3 hari. Tekan "Peminjaman Baru" → kolom siswa terfokus lagi.
5. Pilih `QA-002`, pindai `BK-000001` → "Eksemplar BK-000001 sedang dipinjam — Siswa QA Satu (NIS QA-001), jatuh tempo …", tidak masuk daftar.
6. Pilih `QA-001` lagi (kartu kini 2 dari 3), pindai `BK-000002` → masuk; pindai `BK-000005` → "Kuota penuh: Siswa QA Satu hanya boleh meminjam 3 buku sekaligus." Simpan dengan `Ctrl+Enter`.

**Pengembalian** (`/transaksi/pengembalian`):
7. Kolom pencarian terfokus. Ketik `QA-001` + Enter → dua pinjaman terbuka tampil sebagai daftar. Pilih pinjaman pertama (BK-000001, BK-000004).
8. Lepas centang BK-000004. Ubah BK-000001 menjadi "Rusak" → kolom biaya ganti terisi Rp85.000 (harga katalog); ubah menjadi `60.000` → panel kanan langsung menampilkan Rp60.000 sebelum disimpan. Simpan → diarahkan ke detail transaksi dengan pesan "Pengembalian tersimpan. Denda pengembalian ini Rp60.000. Sisa tagihan transaksi Rp60.000."; status "Sebagian kembali".
9. Di Master Data → Buku → "Pemrograman Web": BK-000001 berstatus Rusak.

**Riwayat dan denda** (`/transaksi/riwayat/<id>` dari langkah 8):
10. Form "Pelunasan Denda" terisi 60000. Ubah menjadi `20.000` → "Pembayaran denda tercatat. Sisa tagihan Rp40.000.", form masih ada dan terisi 40000.
11. Coba bayar `50.000` → galat "Nominal melebihi sisa tagihan Rp40.000. Ubah nominalnya." pada kolom nominal.
12. Tekan "Tandai Lunas" dengan 40000 → pesan "… Denda lunas." tetap terlihat, form pelunasan hilang, sisa "Lunas".
13. `/transaksi/riwayat` → filter "Masih dipinjam" menampilkan kedua pinjaman QA; filter "Denda belum lunas" tidak menampilkannya; cari nomor transaksi langkah 4 → satu baris.

**Menyelesaikan pinjaman**:
14. `/transaksi/pengembalian`, pindai `BK-000004` → pinjaman pertama langsung terbuka (satu hasil); simpan dengan kondisi Baik → status "Selesai".
15. Kembalikan pinjaman kedua (BK-000002) dengan kondisi Baik lewat pencarian nomor transaksinya.

Di lebar tablet (`$B viewport 768x1024`):
16. Meja peminjaman menumpuk kolom Siswa dan Buku; layar pengembalian menumpuk panel denda di bawah daftar buku; tabel riwayat digulir di dalam kotaknya; halaman tidak melebar.

Seluruh langkah peminjaman dan pengembalian harus dapat diselesaikan dengan papan ketik saja (Tab, Enter, Spasi, Ctrl+Enter).

- [x] **Step 4: Periksa jejak audit**

```bash
cat > tmp-audit.ts <<'EOF'
import { sql } from 'drizzle-orm';
import { db } from './src/server/db/client';

async function main() {
  const rows = await db.execute(sql`
    select a.action, p.username, a.metadata
    from audit_logs a join profiles p on p.id = a.user_id
    where a.action in ('loan.create', 'return.process', 'fine.pay')
    order by a.created_at desc limit 10
  `);
  console.table(rows);
  process.exit(0);
}
main();
EOF
npx tsx --env-file=.env.local tmp-audit.ts
rm tmp-audit.ts
```

Harapan: dua `loan.create`, tiga `return.process` (satu dengan `items[0].condition = 'RUSAK'` dan `totalFine: 60000`), dua `fine.pay` (`remaining` 40000 lalu 0), seluruhnya oleh `petugas`.

- [x] **Step 5: Bereskan data pemeriksaan**

Transaksi QA tetap tersimpan sebagai riwayat (BR-08; `loans` tidak dapat dihapus). Kembalikan keadaan koleksi:
1. Sebagai **admin**, Master Data → Buku → "Pemrograman Web": pulihkan BK-000001 (Rusak → Tersedia).
2. Pastikan BK-000001 s.d. BK-000006 seluruhnya "Tersedia" — uji konkurensi (Step 1) membutuhkan setidaknya satu eksemplar TERSEDIA dari buku aktif.
3. Nonaktifkan siswa `QA-001` dan `QA-002` di Master Data → Siswa.

- [x] **Step 6: Tandai rencana selesai**

Ubah seluruh `- [ ]` di berkas rencana ini menjadi `- [x]`, lalu commit:

```bash
git add docs/superpowers/plans/2026-09-25-perpustakaan-04-transaksi.md
git commit -m "$(cat <<'EOF'
docs: tandai Rencana 04 (Transaksi) selesai

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Hasil Akhir Rencana 04

- Petugas mencatat peminjaman di satu layar dengan papan ketik: pindai kartu siswa, pindai buku, `Ctrl+Enter`. Kartu siswa menampilkan sisa slot dan peringatan sebelum buku ditambahkan, dan setiap eksemplar yang tidak boleh dipinjam ditolak saat dipindai beserta alasannya.
- `createLoan()` mengikuti spec 6.1 dengan penguncian baris; bukti konkurensi (spec §10) berjalan di database sungguhan tanpa meninggalkan data. Eksemplar milik buku nonaktif ditolak (`BOOK_INACTIVE`, kewajiban dari Rencana 02).
- Pengembalian menerima nomor transaksi, NIS, nama, atau barcode di satu kolom; mendukung pengembalian sebagian; menghitung denda telat dan biaya ganti per eksemplar, terlihat sebelum disimpan. Eksemplar rusak/hilang tidak kembali tersedia secara otomatis (BR-07).
- Denda dapat dilunasi penuh atau sebagian; status lunas dan terlambat dihitung saat dibaca, tidak disimpan (spec 4.2, 5.4).
- Riwayat transaksi dapat dicari dan disaring (masih dipinjam, terlambat, denda belum lunas, selesai), dengan detail lengkap per transaksi.
- Seluruh tanggal kalender mengikuti WIB, walau server berjalan dalam UTC. Setiap perubahan status transaksi dan eksemplar tercatat di audit log.

## Yang Sengaja Belum Ada

| Hal | Ditangani di / Alasan |
|---|---|
| Tombol "Cetak Struk" di konfirmasi peminjaman (spec 8.2, 8.5) | Rencana 05, bersama halaman cetak struk thermal |
| Dashboard (tujuh widget + jatuh tempo hari ini) | Rencana 05 |
| Tampilan audit log | Rencana 05 |
| Laporan peminjaman, pengembalian, keterlambatan | Rencana 06 |
| Uji end-to-end Playwright (spec §10) | Digantikan pemeriksaan peramban Task 9 lewat `/browse`, seperti Rencana 02–03. Playwright E2E akan menulis transaksi sungguhan ke database cloud; dapat ditambah bila tersedia database uji terpisah |
| Membatalkan peminjaman yang salah catat | Belum diminta spec. Koreksi dilakukan dengan memproses pengembalian kondisi Baik pada hari yang sama (tanpa denda) |
| Mengubah jatuh tempo (perpanjangan) | Di luar lingkup PRD Phase 1 |

## Verifikasi Sebelum Melanjutkan ke Rencana 05

```bash
npm test                   # seluruh uji unit lulus
npm run test:integration   # seluruh uji integrasi lulus, termasuk loan-concurrency
npm run lint               # bersih
npm run build              # sukses
```

Dan secara manual: satu peminjaman tiga buku selesai dicatat dalam waktu di bawah 30 detik (spec §1), lalu dikembalikan sebagian dengan satu buku rusak, dan dendanya dilunasi.
