# Perpustakaan — Rencana 05: Dashboard, Cetak, dan Audit Log

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Petugas membuka aplikasi dan langsung melihat keadaan perpustakaan hari ini, dapat mencetak struk peminjaman thermal dan label barcode eksemplar, dan admin dapat menelusuri audit log. Rencana ini juga menutup temuan tertunda Rencana 04 yang berdampak pada petugas.

**Architecture:** Pola lima lapis Rencana 02–04 tetap berlaku (validasi → service → query → Server Action → halaman yang memanggil `requireProfile()` sendiri). Rencana ini hampir seluruhnya **baca**: query dashboard dan audit log, serta halaman cetak. Halaman cetak berada di grup rute `(cetak)` dengan layout sendiri tanpa sidebar, sehingga yang tercetak hanya struk atau lembar label. Barcode Code128 dirender sebagai SVG oleh encoder murni di `src/lib/code128.ts`, tanpa pustaka tambahan.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS 4 · Drizzle ORM 0.45 · Supabase Postgres · zod 4 · Vitest 5

**Spec:** `docs/superpowers/specs/2026-09-21-sistem-peminjaman-perpustakaan-design.md` — terutama §3.1, §7, §8.1, §8.4, §8.5, §9, §12
**Rencana sebelumnya:** `docs/superpowers/plans/2026-09-25-perpustakaan-04-transaksi.md` (selesai, `master` di `28c1715`)

| Rencana | Isi |
|---|---|
| 01–04 | Fondasi domain, Master Data, Pengaturan, Transaksi (selesai) |
| 05 (ini) | Dashboard, Cetak struk dan label barcode, Tampilan audit log, pengerasan transaksi |
| 06 | Laporan |

**Keputusan pemilik produk yang sudah berlaku:** seluruh antarmuka memakai **Plus Jakarta Sans** (25 September 2026, commit `28c1715`). Spec §8.1 masih menyebut Inter dan Source Serif 4; Task 1 merevisinya.

**Keputusan desain rencana ini** (dapat dikoreksi pemilik produk sebelum eksekusi):

| Topik | Keputusan | Alasan |
|---|---|---|
| Barcode | Encoder Code128 subset B sendiri (`src/lib/code128.ts`), dirender SVG | Tanpa dependensi baru; murni sehingga dapat diuji tanpa DOM; subset B mencakup seluruh barcode yang dapat diketik |
| Halaman cetak | Grup rute `(cetak)` dengan layout tanpa sidebar: `/cetak/struk/[id]` dan `/cetak/label-barcode` | URL sesuai spec §3.2, dan yang tercetak hanya isi cetakannya |
| Struk | Lebar 58 mm (bawaan) atau 80 mm lewat `?lebar=80`. Tinggi halaman `@page` diperkirakan dari jumlah buku. Nomor transaksi ikut dicetak sebagai barcode | CSS `@page` tidak mengenal tinggi "otomatis". Barcode nomor transaksi mempercepat pengembalian: layar pengembalian menerima nomor transaksi (spec §8.3) |
| Label | A4, 3 × 7 label berukuran 63,5 × 38,1 mm (ukuran lembar label siap-tempel yang umum). Dipilih per judul (tombol "Cetak Label" di detail buku) atau per rentang barcode. Maksimal 210 label (10 lembar) per cetak | Spec §8.5, "per rentang atau per judul" |
| Angka dashboard | Total Buku = eksemplar yang tidak `NONAKTIF`. Buku Tersedia = eksemplar `TERSEDIA` dari judul aktif. Sedang Dipinjam = eksemplar `DIPINJAM`. Terlambat = transaksi terbuka yang lewat jatuh tempo, ditambah jumlah bukunya. Peminjaman Hari Ini = transaksi bertanggal pinjam hari ini. Pengembalian Hari Ini = eksemplar yang kembali hari ini menurut tanggal WIB | PRD bab 12.1 tidak ada di repo; definisi ini dipilih agar setiap angka dapat ditelusuri ke halaman lain |
| Audit log | Admin saja (spec §7). Filter: jenis data, tanggal (WIB), dan kata kunci yang dicari di isi catatannya (nomor transaksi, barcode, NIS, username). Ringkasan dibuat per aksi; isi lengkapnya dapat dibuka | Pertanyaan audit yang lazim: "siapa yang mengubah BK-000123", "apa yang terjadi pada PJM-…" |

## Global Constraints

- **Versi terpasang:** `next@16.3.5`, `react@19.2.8`, `drizzle-orm@0.45.3`, `vitest@5.0.1`, `zod@4.6.5`. Node.js 24. **Tidak ada dependensi baru** (tidak ada pustaka barcode, testing-library, atau jsdom; logika komponen klien diuji lewat modul murni).
- **Lingkungan Windows:** Node berada di `D:\nvm\nodejs` dan **tidak** ada di PATH shell agen. Awali setiap perintah `npm`/`npx` dengan `export PATH="/d/nvm/nodejs:$PATH";` (Git Bash) atau `$env:Path = "D:\nvm\nodejs;" + $env:Path;` (PowerShell).
- **TypeScript mode `strict`.** `any` dilarang.
- **Tanggal kalender adalah untai `'YYYY-MM-DD'` (`IsoDate`).** "Hari ini" selalu `schoolToday()` yang dipanggil di halaman atau Server Action; query menerima `today: IsoDate`. Kolom `timestamptz` (`loan_items.returned_at`, `audit_logs.created_at`) dibandingkan dengan tanggal sekolah lewat `(kolom at time zone 'Asia/Jakarta')::date`. `src/domain/**` tetap murni (aturan ESLint).
- **Nominal rupiah** di kolom `numeric(12,2)`: ditulis `String(bilanganBulat)`, dibaca `Number(...)`. Tampilan lewat `formatRupiah()`.
- **Nilai status persis:** eksemplar `TERSEDIA` `DIPINJAM` `RUSAK` `HILANG` `NONAKTIF`; peminjaman `AKTIF` `SEBAGIAN_KEMBALI` `SELESAI`. `TERLAMBAT` dihitung saat dibaca (spec §4.2).
- **Otorisasi (spec §7):** dashboard, struk, dan label → `admin` dan `petugas`. Audit log → `admin` saja; petugas yang membuka URL-nya melihat `<AccessDenied />`. Setiap halaman memanggil `requireProfile()` sendiri; layout bukan batas keamanan.
- **Pesan (spec §9):** menyebut entitas yang terlibat dan tindakan yang harus diambil. "Transaksi gagal" atau pesan generik tidak diterima.
- **Seluruh teks antarmuka berbahasa Indonesia.** Nama variabel, fungsi, dan tabel berbahasa Inggris.
- **DATABASE_URL menunjuk ke database Supabase cloud berisi data sungguhan.** Uji integrasi hanya di dalam `withRollback()`; dilarang `truncate`, `delete` tanpa `where`, atau commit. Karena tabel berisi data sungguhan, uji query agregat (dashboard, audit log) **tidak boleh** menegaskan angka mutlak atas seluruh tabel: bandingkan selisih sebelum–sesudah fixture di transaksi yang sama, atau batasi dengan tanggal uji `2090-…` dan nilai berawalan `UJI-`.
- **Berkas `'use server'` hanya mengekspor fungsi async.** Konstanta pesan bersama berada di `src/lib/`.
- **Desktop dan tablet (PRD bab 9):** tabel dibungkus `<ScrollTable>`; kisi dua/tiga kolom hanya dari breakpoint `sm`/`lg`.
- **Font:** seluruh teks memakai token `--font-sans` (Plus Jakarta Sans). Jangan menambah `font-serif`; `font-mono` sudah diarahkan ke font yang sama dan dipakai hanya untuk kode (barcode, NIS, nomor transaksi) agar angkanya tabular.
- **Repo ini memasang hook tdd-guard.** Urutan langkah (uji gagal → implementasi → uji lulus) wajib diikuti. Perubahan tanpa perilaku baru (refaktor) dilakukan setelah uji terkait dijalankan hijau.
- **Setiap commit diakhiri baris:** `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## Review Focus

Lima kondisi yang paling mungkin menggigit pengguna, masing-masing sudah diberi uji di task pemiliknya:

1. **Pengembalian antara pukul 00.00–07.00 WIB.** `returned_at` tersimpan dalam UTC; tanpa konversi zona waktu, "Pengembalian Hari Ini" menghitung buku yang kembali kemarin malam atau melewatkan yang kembali pagi ini. (Task 2: uji batas waktu `pengembalianHariIni`.)
2. **Barcode yang tidak dapat dikodekan Code128 B** (karakter di luar ASCII 32–126, misalnya huruf beraksen dari barcode manual). Halaman label tidak boleh gagal seluruhnya; label itu menampilkan teks barcode dan peringatan. (Task 4: uji `encodeCode128`; Task 6: uji halaman.)
3. **Rentang label yang terbalik, kosong, atau terlalu besar.** Petugas mendapat pesan yang menyebut rentangnya dan batasnya, bukan halaman ribuan label atau halaman kosong tanpa penjelasan. (Task 6: uji `parseLabelRequest` dan query.)
4. **Isi audit log.** Ringkasan tidak pernah menampilkan password (tidak pernah disimpan, tetapi ringkasan tidak boleh mengarang kolomnya). Perubahan menampilkan nama kolom yang berubah. Aksi yang tidak dikenal tetap tampil dengan kode aksinya, tidak kosong. (Task 7: uji `summarizeAudit`.)
5. **Struk untuk transaksi yang sebagian bukunya sudah kembali, atau id yang salah.** Struk tetap memuat seluruh buku yang dipinjam; id yang tidak ada atau bukan UUID menghasilkan halaman 404, bukan galat database. (Task 5: uji halaman struk.)

---

## Struktur Berkas

| Berkas | Tanggung jawab |
|---|---|
| `src/lib/circulation-results.ts` | + pesan `LOAN_SAVE_FAILED`, `RETURN_SAVE_FAILED` |
| `src/server/actions/{loans,returns}.ts` | Galat tak terduga saat menyimpan menjadi pesan yang dapat ditindaklanjuti |
| `src/server/queries/dashboard.ts` | Angka dashboard dan daftar jatuh tempo hari ini |
| `src/app/(app)/dashboard/page.tsx` | Halaman dashboard |
| `src/lib/code128.ts` | Encoder Code128 subset B → pola lebar modul |
| `src/components/ui/barcode.tsx` | `<Barcode>` SVG dari pola encoder |
| `src/app/(cetak)/layout.tsx`, `src/components/print/print-toolbar.tsx` | Kerangka halaman cetak tanpa sidebar |
| `src/lib/receipt.ts` | Tinggi halaman struk dan pilihan lebar |
| `src/app/(cetak)/cetak/struk/[id]/page.tsx` | Struk peminjaman thermal |
| `src/lib/label-request.ts` | Membaca pilihan label dari URL (per judul / per rentang) |
| `src/server/queries/labels.ts` | Eksemplar untuk label |
| `src/app/(cetak)/cetak/label-barcode/page.tsx` | Lembar label A4 |
| `src/lib/audit-labels.ts` | Label aksi, jenis data, tautan entitas, dan ringkasan catatan audit |
| `src/server/queries/audit-logs.ts` | Daftar audit log dengan filter |
| `src/app/(app)/pengaturan/audit-log/page.tsx` | Halaman audit log (admin) |
| `src/components/layout/sidebar.tsx` | + "Label Barcode" dan "Audit Log" |
| `tests/integration/{dashboard,labels,audit-logs}.test.ts` | Uji integrasi |

---

## Task 1: Pengerasan Transaksi dan Revisi Spec Tipografi

Menutup temuan review akhir Rencana 04 yang berdampak langsung pada petugas. Galat database tak terduga saat menyimpan tidak lagi mengganti layar dengan "Halaman ini gagal dimuat" dan membuang daftar buku yang sudah dipindai. Biaya ganti dibatasi agar total denda tidak melampaui kolom `numeric(12,2)`. Penulisan "Rp60.000" diterima di kolom biaya ganti. Tiga kasus pengembalian yang belum diuji ikut diuji.

**Files:**
- Modify: `src/lib/circulation-results.ts`
- Modify: `src/server/actions/loans.ts`, `src/server/actions/loans.test.ts`
- Modify: `src/server/actions/returns.ts`, `src/server/actions/returns.test.ts`
- Modify: `src/app/(app)/transaksi/peminjaman/loan-desk.tsx` (fungsi `save`)
- Modify: `src/server/validation/return.ts`, `src/server/validation/return.test.ts`
- Modify: `src/server/services/returns.ts` (satu baris di dalam loop item)
- Modify: `src/app/(app)/transaksi/pengembalian/return-preview.ts`, `return-preview.test.ts` (`parseRupiahInput`)
- Modify: `tests/integration/returns.test.ts`
- Modify: `docs/superpowers/specs/2026-09-21-sistem-peminjaman-perpustakaan-design.md` (§8.1 paragraf Tipografi)

**Interfaces:**
- Consumes: `createLoanAction`, `processReturnAction`, `createLoan`, `processReturn`, `returnSchema`, `parseRupiahInput` (Rencana 04); `formError` (`src/lib/form-state.ts`); `ServiceResult` (`src/server/services/result.ts`); `LoanResult` (`src/server/services/loans.ts`)
- Produces:
  - `LOAN_SAVE_FAILED: string`, `RETURN_SAVE_FAILED: string` di `src/lib/circulation-results.ts`
  - `MAX_REPLACEMENT_FEE = 99_999_999` di `src/server/validation/return.ts`
  - `parseRupiahInput` menerima awalan `Rp`/`Rp.` tanpa membedakan huruf besar-kecil

- [x] **Step 1: Tulis uji Server Action yang gagal**

Tambahkan di akhir `describe` yang menguji `createLoanAction` di `src/server/actions/loans.test.ts` (setelah uji terakhirnya). Tambahkan juga `LOAN_SAVE_FAILED` ke impor, dari `@/lib/circulation-results`:

```ts
import { LOAN_SAVE_FAILED } from '@/lib/circulation-results';
```

```ts
  it('mengubah galat database tak terduga menjadi pesan yang meminta petugas memeriksa riwayat', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockCreateLoan.mockRejectedValueOnce(new Error('Connection terminated unexpectedly'));

    expect(await createLoanAction(input))
      .toEqual({ status: 'error', message: LOAN_SAVE_FAILED });
    expect(LOAN_SAVE_FAILED).toBe(
      'Peminjaman belum tersimpan karena gangguan koneksi ke database. Periksa Riwayat Transaksi sebelum menyimpan ulang.',
    );
    expect(quiet).toHaveBeenCalled();
    quiet.mockRestore();
  });
```

Tambahkan di akhir `describe('processReturnAction')` di `src/server/actions/returns.test.ts`, dengan impor `RETURN_SAVE_FAILED` dari `@/lib/circulation-results`:

```ts
  it('mengubah galat database tak terduga menjadi pesan tanpa mengarahkan ke halaman lain', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockProcessReturn.mockRejectedValueOnce(new Error('canceling statement due to lock timeout'));

    expect(await processReturnAction(input)).toEqual(formError(RETURN_SAVE_FAILED));
    expect(RETURN_SAVE_FAILED).toBe(
      'Pengembalian belum tersimpan karena gangguan koneksi ke database. Buka ulang transaksi ini untuk memeriksa sebelum menyimpan ulang.',
    );
    expect(mockRedirect).not.toHaveBeenCalled();
    quiet.mockRestore();
  });
```

- [x] **Step 2: Jalankan uji dan pastikan gagal**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test -- src/server/actions/loans.test.ts src/server/actions/returns.test.ts
```

Harapan: FAIL. Impor `LOAN_SAVE_FAILED`/`RETURN_SAVE_FAILED` bernilai `undefined`, dan galat yang ditolak mock terlempar keluar dari action.

- [x] **Step 3: Tambahkan pesan dan tangkap galat di kedua action**

Tambahkan di akhir `src/lib/circulation-results.ts`:

```ts
/**
 * Galat tak terduga saat menyimpan (koneksi pooler putus, batas waktu kunci).
 * Petugas tidak dapat tahu apakah transaksinya sempat ter-commit, jadi
 * pesannya meminta pemeriksaan sebelum menyimpan ulang.
 */
export const LOAN_SAVE_FAILED =
  'Peminjaman belum tersimpan karena gangguan koneksi ke database. Periksa Riwayat Transaksi sebelum menyimpan ulang.';

export const RETURN_SAVE_FAILED =
  'Pengembalian belum tersimpan karena gangguan koneksi ke database. Buka ulang transaksi ini untuk memeriksa sebelum menyimpan ulang.';
```

Di `src/server/actions/loans.ts`, ubah impor `circulation-results` dan `services/loans` menjadi:

```ts
import { LOAN_SAVE_FAILED, type CreateLoanState, type LookupResult } from '@/lib/circulation-results';
```

```ts
import { createLoan, type LoanResult } from '@/server/services/loans';
```

Lalu ganti baris `const result = await createLoan(parsed.data, auth.actor, schoolToday());` dengan:

```ts
  let result: LoanResult;
  try {
    result = await createLoan(parsed.data, auth.actor, schoolToday());
  } catch (error) {
    // Pelanggaran aturan sudah dikembalikan sebagai nilai; yang sampai ke
    // sini hanya galat infrastruktur. Tanpa tangkapan ini, layar meja
    // peminjaman diganti error boundary dan daftar bukunya hilang.
    console.error('createLoan gagal', error);
    return { status: 'error', message: LOAN_SAVE_FAILED };
  }
```

Di `src/server/actions/returns.ts`, tambahkan impor:

```ts
import { RETURN_SAVE_FAILED } from '@/lib/circulation-results';
import type { ServiceResult } from '@/server/services/result';
```

Lalu ganti baris `const result = await processReturn(parsed.data, auth.actor, schoolToday());` dengan:

```ts
  let result: ServiceResult;
  try {
    result = await processReturn(parsed.data, auth.actor, schoolToday());
  } catch (error) {
    console.error('processReturn gagal', error);
    return formError(RETURN_SAVE_FAILED);
  }
```

`redirect()` tetap di luar `try` (ia melempar sinyal navigasi yang tidak boleh ditangkap).

- [x] **Step 4: Jalankan uji dan pastikan lulus**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test -- src/server/actions/loans.test.ts src/server/actions/returns.test.ts
```

Harapan: PASS, keluaran bersih (tanpa log `console.error` yang bocor).

- [x] **Step 5: Pertahankan daftar buku saat jaringan putus di meja peminjaman**

Galat jaringan antara peramban dan server (Wi-Fi putus) melempar dari `await createLoanAction(...)` di sisi klien. Di `src/app/(app)/transaksi/peminjaman/loan-desk.tsx`, ubah impor `circulation-results` menjadi:

```ts
import { LOAN_SAVE_FAILED, type CreateLoanState } from '@/lib/circulation-results';
```

Lalu ganti isi `startTransition` di fungsi `save` dengan:

```ts
    startTransition(async () => {
      let result: CreateLoanState;
      try {
        result = await createLoanAction(input);
      } catch {
        // Jawaban server tidak pernah tiba: daftar buku dan siswa dipertahankan
        // agar petugas dapat memeriksa riwayat lalu menyimpan ulang.
        result = { status: 'error', message: LOAN_SAVE_FAILED };
      }
      setOutcome(result);
      if (result.status === 'success') {
        dispatch({ type: 'reset' });
        setNotes('');
      }
    });
```

Layar pengembalian **tidak** diberi tangkapan serupa di sisi klien. `processReturnAction` mengakhiri keberhasilan dengan `redirect()`, dan menangkap di klien berisiko menelan sinyal navigasi itu. Galat server sudah ditangani di Step 3.

Komponen klien tidak dapat diuji tanpa jsdom (Global Constraints). Periksa perubahan ini dengan `npx tsc --noEmit` dan membaca ulang fungsinya.

- [x] **Step 6: Tulis uji batas biaya ganti dan awalan "Rp" yang gagal**

Tambahkan di akhir `describe('returnSchema')` di `src/server/validation/return.test.ts`:

```ts
  it('menolak biaya ganti di atas Rp99.999.999 agar total denda muat di kolomnya', () => {
    const tooHigh = returnSchema.safeParse({
      loanId,
      items: [{ loanItemId, condition: 'HILANG', replacementFee: 100_000_000, note: null }],
    });
    expect(messagesOf(tooHigh)).toEqual(['Biaya ganti maksimal Rp99.999.999 per buku. Periksa nominalnya.']);

    const atCap = returnSchema.safeParse({
      loanId,
      items: [{ loanItemId, condition: 'HILANG', replacementFee: 99_999_999, note: null }],
    });
    expect(atCap.success).toBe(true);
  });
```

Ganti uji `describe('parseRupiahInput')` di `src/app/(app)/transaksi/pengembalian/return-preview.test.ts` dengan:

```ts
describe('parseRupiahInput', () => {
  it('menerima titik ribuan, menganggap kosong sebagai null, dan menandai selain angka', () => {
    expect(parseRupiahInput('30.000')).toBe(30000);
    expect(parseRupiahInput(' ')).toBeNull();
    expect(parseRupiahInput('tiga puluh')).toBeNaN();
  });

  it('menerima awalan Rp seperti yang tertulis di label kolom', () => {
    expect(parseRupiahInput('Rp60.000')).toBe(60000);
    expect(parseRupiahInput('rp 60.000')).toBe(60000);
    expect(parseRupiahInput('Rp. 5.000')).toBe(5000);
    expect(parseRupiahInput('Rp')).toBeNull();
    expect(parseRupiahInput('60.000 Rp')).toBeNaN();
  });
});
```

- [x] **Step 7: Jalankan uji dan pastikan gagal**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test -- src/server/validation/return.test.ts "src/app/(app)/transaksi/pengembalian/return-preview.test.ts"
```

Harapan: FAIL. `100_000_000` masih diterima, dan `'Rp60.000'` menghasilkan `NaN`.

- [x] **Step 8: Terapkan batas dan awalan**

Di `src/server/validation/return.ts`, tambahkan di bawah konstanta `FEE`:

```ts
/**
 * Batas per buku. `loans.total_fine` bertipe numeric(12,2) (maks. 9.999.999.999,99);
 * dengan batas ini total denda tetap muat walau satu transaksi berisi 20 buku hilang.
 */
export const MAX_REPLACEMENT_FEE = 99_999_999;
```

dan ganti rantai `replacementFee` menjadi:

```ts
        replacementFee: z
          .number({ error: FEE })
          .int(FEE)
          .min(0, FEE)
          .max(MAX_REPLACEMENT_FEE, 'Biaya ganti maksimal Rp99.999.999 per buku. Periksa nominalnya.')
          .nullable(),
```

Di `src/app/(app)/transaksi/pengembalian/return-preview.ts`, ganti `parseRupiahInput` dengan:

```ts
export function parseRupiahInput(raw: string): number | null {
  // Label kolomnya "Biaya ganti (Rp)", jadi petugas wajar mengetik "Rp60.000".
  const digits = raw.replace(/^\s*rp\.?/i, '').replace(/[.\s]/g, '');
  if (digits === '') return null;
  return /^\d+$/.test(digits) ? Number(digits) : Number.NaN;
}
```

- [x] **Step 9: Jalankan uji dan pastikan lulus**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test -- src/server/validation/return.test.ts "src/app/(app)/transaksi/pengembalian/return-preview.test.ts"
```

Harapan: PASS. Bila ada uji lama di `return.test.ts` yang memakai nominal di atas `99_999_999` dan mengharapkan pesan `FEE`, ubah nominalnya menjadi nilai di bawah batas. Uji itu menguji bentuk angka, bukan batasnya.

- [x] **Step 10: Tulis uji pengembalian yang belum ada**

Tambahkan di akhir `describe('processReturn')` di `tests/integration/returns.test.ts`:

```ts
  it('menolak buku yang dipilih dua kali tanpa menulis apa pun', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      const loan = await borrow(tx, fx, [0]);

      const result = await processReturn(
        { loanId: loan.id, items: [item(loan.items[0].id), item(loan.items[0].id)] }, fx.actor, TODAY, tx,
      );

      expect(result).toEqual({ ok: false, message: 'Setiap buku hanya boleh dipilih sekali. Muat ulang halaman.' });
      expect(await copyStatus(tx, fx.copies[0].id)).toBe('DIPINJAM');
    });
  });

  it('menolak buku milik transaksi lain tanpa menulis apa pun', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      const mine = await borrow(tx, fx, [0]);
      const other = await createLoan(
        { studentId: fx.students[1].id, copyIds: [fx.copies[1].id], notes: null }, fx.actor, TODAY, tx,
      );
      if (!other.ok) throw new Error(JSON.stringify(other));
      const otherDetail = await getLoanDetail(other.id, TODAY, tx);
      if (!otherDetail) throw new Error('detail pinjaman lain tidak terbaca');

      const result = await processReturn(
        { loanId: mine.id, items: [item(otherDetail.items[0].id)] }, fx.actor, TODAY, tx,
      );

      expect(result).toEqual({
        ok: false,
        message: 'Salah satu buku sudah dikembalikan atau bukan bagian dari transaksi ini. Muat ulang halaman lalu pilih lagi.',
      });
      expect(await copyStatus(tx, fx.copies[1].id)).toBe('DIPINJAM');
    });
  });

  it('mempertahankan denda pengembalian pertama saat pengembalian kedua juga didenda', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      const loan = await borrow(tx, fx, [0, 1]);
      const [first, second] = loan.items;

      // Jatuh tempo 2090-03-05. Kembali 03-07: telat 2 hari = Rp2.000.
      const firstResult = await processReturn({ loanId: loan.id, items: [item(first.id)] }, fx.actor, '2090-03-07', tx);
      expect(firstResult).toEqual({
        ok: true, id: loan.id, notice: 'Denda pengembalian ini Rp2.000. Sisa tagihan transaksi Rp2.000.',
      });

      // Kembali 03-08, rusak: telat 3 hari Rp3.000 + harga katalog Rp50.000.
      const secondResult = await processReturn(
        { loanId: loan.id, items: [item(second.id, 'RUSAK')] }, fx.actor, '2090-03-08', tx,
      );
      expect(secondResult).toEqual({
        ok: true, id: loan.id, notice: 'Denda pengembalian ini Rp53.000. Sisa tagihan transaksi Rp55.000.',
      });

      const [row] = await tx.select({ totalFine: loans.totalFine, status: loans.status }).from(loans).where(eq(loans.id, loan.id));
      expect(row).toEqual({ totalFine: '55000.00', status: 'SELESAI' });
    });
  });
```

- [x] **Step 11: Jalankan uji integrasi pengembalian**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm run test:integration -- tests/integration/returns.test.ts
```

Harapan: PASS. Ketiga uji ini mengunci perilaku yang **sudah** benar (pertahanan regresi), jadi boleh langsung hijau. Bila ada yang merah, perilakunya menyimpang dari spec §6.2. Laporkan, jangan ubah harapan ujinya.

- [x] **Step 12: Ubah cabang yang tidak mungkin tercapai menjadi galat**

Di `src/server/services/returns.ts`, di dalam `for (const item of input.items)`, ganti:

```ts
      if (!open) return fail(STALE);
```

dengan:

```ts
      // Tidak mungkin terjadi: seluruh id sudah diperiksa sebelum loop. Melempar,
      // bukan `return fail(...)`, karena transaksi yang callback-nya kembali
      // normal akan meng-commit item yang sudah ditulis di putaran sebelumnya.
      if (!open) throw new Error(`Item ${item.loanItemId} tidak ada di antara item yang dikunci.`);
```

Ini refaktor tanpa perilaku baru. Uji `returns.test.ts` sudah hijau di Step 11; jalankan ulang setelah mengubahnya:

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm run test:integration -- tests/integration/returns.test.ts
```

Harapan: PASS.

- [x] **Step 13: Revisi spec §8.1 Tipografi**

Di `docs/superpowers/specs/2026-09-21-sistem-peminjaman-perpustakaan-design.md`, ganti paragraf yang diawali `Tipografi: **Inter** untuk antarmuka` dengan:

```markdown
Tipografi: **Plus Jakarta Sans** untuk seluruh antarmuka — judul, teks, dan kode seperti barcode, NIS, dan nomor transaksi — dengan **angka tabular diaktifkan** pada seluruh tabel, kode, dan nominal. Kolom tanggal dan denda yang tidak sejajar secara vertikal jauh lebih lambat dipindai mata. *(Revisi 25 September 2026: pemilik produk mengganti Inter dan Source Serif 4 dengan satu keluarga font.)*
```

- [x] **Step 14: Jalankan seluruh pemeriksaan lalu commit**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test && npm run test:integration && npm run lint && npx tsc --noEmit
```

Harapan: seluruhnya lulus.

```bash
git add src/lib/circulation-results.ts src/server/actions/loans.ts src/server/actions/loans.test.ts \
  src/server/actions/returns.ts src/server/actions/returns.test.ts \
  "src/app/(app)/transaksi/peminjaman/loan-desk.tsx" \
  src/server/validation/return.ts src/server/validation/return.test.ts src/server/services/returns.ts \
  "src/app/(app)/transaksi/pengembalian/return-preview.ts" "src/app/(app)/transaksi/pengembalian/return-preview.test.ts" \
  tests/integration/returns.test.ts docs/superpowers/specs/2026-09-21-sistem-peminjaman-perpustakaan-design.md
git commit -F - <<'EOF'
fix(transaksi): pesan jelas saat simpan gagal, batas biaya ganti, dan awalan Rp

Galat database tak terduga di createLoanAction/processReturnAction kini
dikembalikan sebagai pesan yang meminta petugas memeriksa riwayat, dan meja
peminjaman mempertahankan daftar bukunya saat jaringan putus. Biaya ganti
dibatasi Rp99.999.999 per buku. Spec §8.1 direvisi ke Plus Jakarta Sans.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

## Task 2: Query Dashboard

**Files:**
- Create: `src/server/queries/dashboard.ts`
- Create: `tests/integration/dashboard.test.ts`

**Interfaces:**
- Consumes: `openItemCounts` (`src/server/queries/loan-aggregates.ts`); `SCHOOL_TIME_ZONE` (`src/lib/school-date.ts`); fixture `TODAY`, `circulationFixture`, `seedLoan` (`tests/integration/circulation-fixture.ts`); `withRollback` (`tests/integration/helpers.ts`); skema `bookCopies`, `books`, `loanItems`, `loans`, `students`
- Produces:
  - `interface DashboardStats { totalCopies: number; totalTitles: number; availableCopies: number; borrowedCopies: number; overdueLoans: number; overdueCopies: number; loansToday: number; copiesLentToday: number; copiesReturnedToday: number }`
  - `getDashboardStats(today: IsoDate, executor?): Promise<DashboardStats>`
  - `interface DueTodayRow { id: string; transactionNumber: string; studentName: string; studentNis: string; studentClass: string; openCount: number }`
  - `listDueToday(today: IsoDate, executor?): Promise<DueTodayRow[]>` — maks. 50, urut nama siswa

Tabel berisi data sungguhan, jadi angka keseluruhan (total eksemplar, terlambat) diuji sebagai **selisih** sebelum dan sesudah fixture di transaksi yang sama. Angka "hari ini" diuji mutlak, karena tidak ada data sungguhan bertanggal 2090.

- [x] **Step 1: Tulis uji integrasi yang gagal**

Buat `tests/integration/dashboard.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { bookCopies, books, loanItems } from '@/server/db/schema';
import { getDashboardStats, listDueToday } from '@/server/queries/dashboard';
import { circulationFixture, seedLoan, TODAY } from './circulation-fixture';
import { withRollback } from './helpers';

describe('getDashboardStats', () => {
  it('menghitung eksemplar, pinjaman hari ini, dan keterlambatan', async () => {
    await withRollback(async (tx) => {
      const before = await getDashboardStats(TODAY, tx);
      const fx = await circulationFixture(tx, { copies: 5 });
      // Terlambat: 2 buku, jatuh tempo 2090-02-20.
      await seedLoan(tx, fx, { student: 0, copies: [0, 1], loanDate: '2090-02-17', dueDate: '2090-02-20' });
      // Dipinjam hari ini: 1 buku.
      await seedLoan(tx, fx, { student: 1, copies: [2], loanDate: TODAY, dueDate: '2090-03-05' });
      // Satu eksemplar dinonaktifkan: tidak dihitung sebagai koleksi.
      await tx.update(bookCopies).set({ status: 'NONAKTIF' }).where(eq(bookCopies.id, fx.copies[4].id));

      const after = await getDashboardStats(TODAY, tx);

      expect(after.totalCopies - before.totalCopies).toBe(4);
      expect(after.totalTitles - before.totalTitles).toBe(1);
      expect(after.availableCopies - before.availableCopies).toBe(1);
      expect(after.borrowedCopies - before.borrowedCopies).toBe(3);
      expect(after.overdueLoans - before.overdueLoans).toBe(1);
      expect(after.overdueCopies - before.overdueCopies).toBe(2);
      expect(after.loansToday).toBe(1);
      expect(after.copiesLentToday).toBe(1);
    });
  });

  it('tidak menghitung eksemplar dari judul nonaktif sebagai tersedia', async () => {
    await withRollback(async (tx) => {
      const before = await getDashboardStats(TODAY, tx);
      const fx = await circulationFixture(tx, { copies: 2 });
      await tx.update(books).set({ status: 'inactive' }).where(eq(books.id, fx.bookId));

      const after = await getDashboardStats(TODAY, tx);

      expect(after.totalCopies - before.totalCopies).toBe(2);
      expect(after.totalTitles - before.totalTitles).toBe(0);
      expect(after.availableCopies - before.availableCopies).toBe(0);
    });
  });

  it('menghitung pengembalian hari ini menurut tanggal WIB, bukan UTC', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx, { copies: 3 });
      const loan = await seedLoan(tx, fx, {
        student: 0, copies: [0, 1, 2], loanDate: '2090-02-27', dueDate: '2090-03-02', returned: [0, 1, 2],
      });
      const returnedAt = (copyIndex: number, iso: string) => tx
        .update(loanItems)
        .set({ returnedAt: new Date(iso) })
        .where(and(eq(loanItems.loanId, loan.id), eq(loanItems.bookCopyId, fx.copies[copyIndex].id)));
      await returnedAt(0, '2090-03-01T17:30:00Z'); // 02/03/2090 00.30 WIB — hari ini
      await returnedAt(1, '2090-03-02T16:59:00Z'); // 02/03/2090 23.59 WIB — hari ini
      await returnedAt(2, '2090-03-01T16:59:00Z'); // 01/03/2090 23.59 WIB — kemarin

      const stats = await getDashboardStats(TODAY, tx);

      expect(stats.copiesReturnedToday).toBe(2);
    });
  });
});

describe('listDueToday', () => {
  it('mendaftar pinjaman terbuka yang jatuh tempo hari ini beserta buku yang belum kembali', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx, { copies: 4 });
      const partial = await seedLoan(tx, fx, {
        student: 0, copies: [0, 1], loanDate: '2090-02-27', dueDate: TODAY, returned: [0],
      });
      // Sudah selesai: tidak perlu diantisipasi.
      await seedLoan(tx, fx, { student: 1, copies: [2], loanDate: '2090-02-27', dueDate: TODAY, returned: [2] });
      // Jatuh tempo lain hari.
      await seedLoan(tx, fx, { student: 1, copies: [3], loanDate: TODAY, dueDate: '2090-03-05' });

      expect(await listDueToday(TODAY, tx)).toEqual([{
        id: partial.id,
        transactionNumber: partial.transactionNumber,
        studentName: 'UJI Siswa Satu',
        studentNis: 'UJI-S1',
        studentClass: 'XI UJI 1',
        openCount: 1,
      }]);
    });
  });
});
```

- [x] **Step 2: Jalankan uji dan pastikan gagal**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm run test:integration -- tests/integration/dashboard.test.ts
```

Harapan: FAIL dengan "Failed to resolve import '@/server/queries/dashboard'".

- [x] **Step 3: Tulis query dashboard**

Buat `src/server/queries/dashboard.ts`:

```ts
import { and, asc, eq, lt, ne, sql } from 'drizzle-orm';
import type { IsoDate } from '@/domain/shared/date';
import { SCHOOL_TIME_ZONE } from '@/lib/school-date';
import { db } from '@/server/db/client';
import type { Executor } from '@/server/db/executor';
import { bookCopies, books, loanItems, loans, students } from '@/server/db/schema';
import { openItemCounts } from './loan-aggregates';

/** Angka dashboard (spec 8.4). Setiap angka dapat ditelusuri ke halaman lain. */
export interface DashboardStats {
  /** Eksemplar yang tidak NONAKTIF: koleksi yang secara fisik masih dikelola. */
  totalCopies: number;
  /** Judul aktif. */
  totalTitles: number;
  /** Eksemplar TERSEDIA dari judul aktif: yang benar-benar dapat dipinjam sekarang. */
  availableCopies: number;
  borrowedCopies: number;
  /** Transaksi terbuka yang lewat jatuh tempo (spec 4.2: dihitung saat dibaca). */
  overdueLoans: number;
  /** Eksemplar yang belum kembali dari transaksi terlambat itu. */
  overdueCopies: number;
  loansToday: number;
  copiesLentToday: number;
  /** Menurut tanggal WIB dari `returned_at`, bukan tanggal UTC-nya. */
  copiesReturnedToday: number;
}

export interface DueTodayRow {
  id: string;
  transactionNumber: string;
  studentName: string;
  studentNis: string;
  studentClass: string;
  openCount: number;
}

const DUE_TODAY_LIMIT = 50;

export async function getDashboardStats(today: IsoDate, executor: Executor = db): Promise<DashboardStats> {
  const open = openItemCounts(executor);

  const [collection, [titles], [overdue], [lentToday], [returnedToday]] = await Promise.all([
    executor
      .select({
        total: sql<number>`(count(*) filter (where ${bookCopies.status} <> 'NONAKTIF'))::int`,
        available: sql<number>`(count(*) filter (where ${bookCopies.status} = 'TERSEDIA' and ${books.status} = 'active'))::int`,
        borrowed: sql<number>`(count(*) filter (where ${bookCopies.status} = 'DIPINJAM'))::int`,
      })
      .from(bookCopies)
      .innerJoin(books, eq(books.id, bookCopies.bookId)),
    executor
      .select({ total: sql<number>`count(*)::int` })
      .from(books)
      .where(eq(books.status, 'active')),
    executor
      .select({
        loans: sql<number>`count(*)::int`,
        copies: sql<number>`coalesce(sum(${open.openCount}), 0)::int`,
      })
      .from(loans)
      .innerJoin(open, eq(open.loanId, loans.id))
      .where(and(ne(loans.status, 'SELESAI'), lt(loans.dueDate, today))),
    executor
      .select({
        loans: sql<number>`count(distinct ${loans.id})::int`,
        copies: sql<number>`count(${loanItems.id})::int`,
      })
      .from(loans)
      .innerJoin(loanItems, eq(loanItems.loanId, loans.id))
      .where(eq(loans.loanDate, today)),
    executor
      .select({ copies: sql<number>`count(*)::int` })
      .from(loanItems)
      .where(sql`(${loanItems.returnedAt} at time zone ${SCHOOL_TIME_ZONE})::date = ${today}::date`),
  ]);
  const [copies] = collection;

  return {
    totalCopies: Number(copies?.total ?? 0),
    totalTitles: Number(titles?.total ?? 0),
    availableCopies: Number(copies?.available ?? 0),
    borrowedCopies: Number(copies?.borrowed ?? 0),
    overdueLoans: Number(overdue?.loans ?? 0),
    overdueCopies: Number(overdue?.copies ?? 0),
    loansToday: Number(lentToday?.loans ?? 0),
    copiesLentToday: Number(lentToday?.copies ?? 0),
    copiesReturnedToday: Number(returnedToday?.copies ?? 0),
  };
}

/** Pinjaman yang jatuh tempo hari ini dan masih punya buku di tangan siswa (spec 8.4). */
export async function listDueToday(today: IsoDate, executor: Executor = db): Promise<DueTodayRow[]> {
  const open = openItemCounts(executor);
  const rows = await executor
    .select({
      id: loans.id,
      transactionNumber: loans.transactionNumber,
      studentName: students.name,
      studentNis: students.nis,
      studentClass: loans.studentClass,
      openCount: open.openCount,
    })
    .from(loans)
    .innerJoin(students, eq(students.id, loans.studentId))
    .innerJoin(open, eq(open.loanId, loans.id))
    .where(and(ne(loans.status, 'SELESAI'), eq(loans.dueDate, today)))
    .orderBy(asc(students.name), asc(loans.transactionNumber))
    .limit(DUE_TODAY_LIMIT);

  return rows.map((row) => ({ ...row, openCount: Number(row.openCount) }));
}
```

Catatan untuk pelaksana: `Promise.all` di atas menjalankan lima kueri pada executor yang sama. Di dalam transaksi uji (`tx`), postgres-js mengantrekannya pada satu koneksi, jadi aman. Jangan ganti dengan subquery berkorelasi: di drizzle 0.45 kolom di dalam template `sql` pada select satu tabel ditulis tanpa nama tabel (lihat komentar di `loan-aggregates.ts`).

- [x] **Step 4: Jalankan uji dan pastikan lulus**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm run test:integration -- tests/integration/dashboard.test.ts
```

Harapan: PASS, 4 uji.

- [x] **Step 5: Commit**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm run lint && npx tsc --noEmit
git add src/server/queries/dashboard.ts tests/integration/dashboard.test.ts
git commit -F - <<'EOF'
feat(dashboard): angka koleksi, keterlambatan, dan jatuh tempo hari ini

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

## Task 3: Halaman Dashboard

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`
- Create: `src/app/(app)/dashboard/page.test.tsx`

**Interfaces:**
- Consumes: `getDashboardStats`, `listDueToday`, `DashboardStats`, `DueTodayRow` (Task 2); `listLoans`, `LoanRow` (`src/server/queries/loans.ts`); `LoanStatusBadge`; `schoolToday`; `formatDate`; `PageHeader`, `ScrollTable`, `TD`, `TH`, `buttonClass`
- Produces: rute `/dashboard` dengan enam kartu angka, daftar "Jatuh Tempo Hari Ini", dan tabel "Transaksi Terbaru" (8 baris)

- [x] **Step 1: Tulis uji halaman yang gagal**

Buat `src/app/(app)/dashboard/page.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { LoanRow } from '@/server/queries/loans';

const { mockStats, mockDueToday, mockListLoans } = vi.hoisted(() => ({
  mockStats: vi.fn(),
  mockDueToday: vi.fn(),
  mockListLoans: vi.fn(),
}));

vi.mock('@/server/queries/dashboard', () => ({ getDashboardStats: mockStats, listDueToday: mockDueToday }));
vi.mock('@/server/queries/loans', () => ({ listLoans: mockListLoans }));
vi.mock('@/lib/school-date', () => ({ schoolToday: () => '2090-03-02' }));
vi.mock('@/server/auth/guard', () => ({
  requireProfile: vi.fn(async () => ({ id: 'u1', role: 'petugas', fullName: 'Siti Petugas', status: 'active' })),
}));

import DashboardPage from './page';

const stats = {
  totalCopies: 1250,
  totalTitles: 310,
  availableCopies: 1100,
  borrowedCopies: 140,
  overdueLoans: 3,
  overdueCopies: 5,
  loansToday: 7,
  copiesLentToday: 12,
  copiesReturnedToday: 9,
};

function loanRow(index: number): LoanRow {
  return {
    id: `l${index}`,
    transactionNumber: `PJM-20900302-${String(index).padStart(4, '0')}`,
    loanDate: '2090-03-02',
    dueDate: '2090-03-05',
    status: 'AKTIF',
    studentName: `Siswa ${index}`,
    studentNis: `N${index}`,
    studentClass: 'XI RPL 1',
    itemCount: 1,
    openCount: 1,
    totalFine: 0,
    unpaidFine: 0,
    daysOverdue: 0,
  };
}

async function render() {
  return renderToStaticMarkup(await DashboardPage());
}

beforeEach(() => {
  vi.clearAllMocks();
  mockStats.mockResolvedValue(stats);
  mockDueToday.mockResolvedValue([]);
  mockListLoans.mockResolvedValue({ rows: [], total: 0 });
});

describe('DashboardPage', () => {
  it('menampilkan enam angka dengan tautan ke halaman rinciannya', async () => {
    const html = await render();

    expect(mockStats).toHaveBeenCalledWith('2090-03-02');
    expect(html).toContain('Total Buku');
    expect(html).toContain('1.250');
    expect(html).toContain('eksemplar dari 310 judul aktif');
    expect(html).toContain('Buku Tersedia');
    expect(html).toContain('1.100');
    expect(html).toContain('Sedang Dipinjam');
    expect(html).toContain('href="/transaksi/riwayat?status=open"');
    expect(html).toContain('Terlambat');
    expect(html).toContain('href="/transaksi/riwayat?status=overdue"');
    expect(html).toContain('transaksi · 5 buku belum kembali');
    expect(html).toContain('Peminjaman Hari Ini');
    expect(html).toContain('transaksi · 12 buku');
    expect(html).toContain('Pengembalian Hari Ini');
    expect(html).toContain('>9<');
    expect(html).toContain('02/03/2090');
  });

  it('mendaftar pinjaman yang jatuh tempo hari ini dengan tautan ke transaksinya', async () => {
    mockDueToday.mockResolvedValueOnce([{
      id: 'd1', transactionNumber: 'PJM-20900227-0004', studentName: 'Ahmad Fauzi',
      studentNis: '202600123', studentClass: 'XI RPL 1', openCount: 2,
    }]);

    const html = await render();

    expect(mockDueToday).toHaveBeenCalledWith('2090-03-02');
    expect(html).toContain('Jatuh Tempo Hari Ini');
    expect(html).toContain('href="/transaksi/riwayat/d1"');
    expect(html).toContain('Ahmad Fauzi');
    expect(html).toContain('PJM-20900227-0004');
    expect(html).toContain('2 buku');
  });

  it('menampilkan pesan bila tidak ada yang jatuh tempo dan belum ada transaksi', async () => {
    const html = await render();
    expect(html).toContain('Tidak ada pinjaman yang jatuh tempo hari ini.');
    expect(html).toContain('Belum ada transaksi.');
  });

  it('menampilkan delapan transaksi terbaru dari riwayat', async () => {
    mockListLoans.mockResolvedValueOnce({ rows: Array.from({ length: 10 }, (_, index) => loanRow(index + 1)), total: 10 });

    const html = await render();

    expect(mockListLoans).toHaveBeenCalledWith({ q: '', status: 'all', page: 1 }, '2090-03-02');
    expect(html).toContain('PJM-20900302-0008');
    expect(html).not.toContain('PJM-20900302-0009');
    expect(html).toContain('href="/transaksi/riwayat"');
  });
});
```

- [x] **Step 2: Jalankan uji dan pastikan gagal**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test -- "src/app/(app)/dashboard/page.test.tsx"
```

Harapan: FAIL. Halaman saat ini hanya menampilkan judul "Dashboard".

- [x] **Step 3: Tulis halaman dashboard**

Ganti isi `src/app/(app)/dashboard/page.tsx`:

```tsx
import Link from 'next/link';
import { buttonClass } from '@/components/ui/button-styles';
import { LoanStatusBadge } from '@/components/ui/loan-status-badge';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollTable } from '@/components/ui/scroll-table';
import { TD, TH } from '@/components/ui/table-styles';
import { formatDate } from '@/lib/format';
import { schoolToday } from '@/lib/school-date';
import { requireProfile } from '@/server/auth/guard';
import { getDashboardStats, listDueToday } from '@/server/queries/dashboard';
import { listLoans } from '@/server/queries/loans';

const RECENT_LIMIT = 8;
const SECTION = 'page-title mb-3 text-lg font-semibold';
const BOX = 'rounded-lg border border-[var(--color-ink-100)] bg-white';

function StatCard({
  href, label, value, detail, alert = false,
}: { href: string; label: string; value: number; detail: string; alert?: boolean }) {
  const valueTone = alert && value > 0 ? 'text-[var(--color-status-terlambat)]' : 'text-[var(--color-ink-900)]';
  return (
    <Link href={href} className={`${BOX} block p-4 hover:border-[var(--color-accent-600)]`}>
      <span className="block text-sm text-[var(--color-ink-500)]">{label}</span>
      <span className={`tabular mt-1 block text-3xl font-semibold ${valueTone}`}>{value.toLocaleString('id-ID')}</span>
      <span className="mt-1 block text-xs text-[var(--color-ink-500)]">{detail}</span>
    </Link>
  );
}

export default async function DashboardPage() {
  const profile = await requireProfile();
  const today = schoolToday();
  const [stats, dueToday, recent] = await Promise.all([
    getDashboardStats(today),
    listDueToday(today),
    listLoans({ q: '', status: 'all', page: 1 }, today),
  ]);
  const recentRows = recent.rows.slice(0, RECENT_LIMIT);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Keadaan perpustakaan hari ini, ${formatDate(today)}. Selamat bertugas, ${profile.fullName}.`}
        actions={(
          <>
            <Link href="/transaksi/peminjaman" className={buttonClass('primary')}>Peminjaman Baru</Link>
            <Link href="/transaksi/pengembalian" className={buttonClass('secondary')}>Pengembalian</Link>
          </>
        )}
      />

      <section aria-label="Ringkasan hari ini" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard href="/master/buku" label="Total Buku" value={stats.totalCopies} detail={`eksemplar dari ${stats.totalTitles} judul aktif`} />
        <StatCard href="/master/buku" label="Buku Tersedia" value={stats.availableCopies} detail="eksemplar siap dipinjam" />
        <StatCard href="/transaksi/riwayat?status=open" label="Sedang Dipinjam" value={stats.borrowedCopies} detail="eksemplar di tangan siswa" />
        <StatCard
          href="/transaksi/riwayat?status=overdue"
          label="Terlambat"
          value={stats.overdueLoans}
          detail={`transaksi · ${stats.overdueCopies} buku belum kembali`}
          alert
        />
        <StatCard href="/transaksi/riwayat" label="Peminjaman Hari Ini" value={stats.loansToday} detail={`transaksi · ${stats.copiesLentToday} buku`} />
        <StatCard href="/transaksi/riwayat" label="Pengembalian Hari Ini" value={stats.copiesReturnedToday} detail="buku kembali" />
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <section aria-labelledby="jatuh-tempo-hari-ini">
          <h2 id="jatuh-tempo-hari-ini" className={SECTION}>Jatuh Tempo Hari Ini</h2>
          {dueToday.length === 0 ? (
            <p className={`${BOX} p-4 text-sm text-[var(--color-ink-500)]`}>Tidak ada pinjaman yang jatuh tempo hari ini.</p>
          ) : (
            <ul className={`${BOX} divide-y divide-[var(--color-ink-100)]`}>
              {dueToday.map((row) => (
                <li key={row.id} className="px-4 py-3 text-sm">
                  <Link href={`/transaksi/riwayat/${row.id}`} className="font-medium text-[var(--color-accent-600)] hover:underline">
                    {row.studentName}
                  </Link>
                  <span className="block text-xs text-[var(--color-ink-500)]">
                    {row.studentNis} · {row.studentClass} · <span className="font-mono">{row.transactionNumber}</span> · {row.openCount} buku
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="transaksi-terbaru" className="lg:col-span-2">
          <h2 id="transaksi-terbaru" className={SECTION}>Transaksi Terbaru</h2>
          <ScrollTable>
            <thead>
              <tr>
                <th className={TH}>No. Transaksi</th>
                <th className={TH}>Siswa</th>
                <th className={TH}>Pinjam</th>
                <th className={TH}>Jatuh Tempo</th>
                <th className={TH}>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentRows.length === 0 && (
                <tr>
                  <td colSpan={5} className={`${TD} text-center text-[var(--color-ink-500)]`}>Belum ada transaksi.</td>
                </tr>
              )}
              {recentRows.map((row) => (
                <tr key={row.id}>
                  <td className={TD}>
                    <Link href={`/transaksi/riwayat/${row.id}`} className="font-mono text-[var(--color-accent-600)] hover:underline">
                      {row.transactionNumber}
                    </Link>
                  </td>
                  <td className={TD}>
                    {row.studentName}
                    <span className="block text-xs text-[var(--color-ink-500)]">{row.studentClass}</span>
                  </td>
                  <td className={TD}>{formatDate(row.loanDate)}</td>
                  <td className={TD}>{formatDate(row.dueDate)}</td>
                  <td className={TD}><LoanStatusBadge status={row.status} daysOverdue={row.daysOverdue} /></td>
                </tr>
              ))}
            </tbody>
          </ScrollTable>
          <Link href="/transaksi/riwayat" className="mt-2 inline-block text-sm text-[var(--color-accent-600)] hover:underline">
            Lihat semua transaksi
          </Link>
        </section>
      </div>
    </>
  );
}
```

- [x] **Step 4: Jalankan uji dan pastikan lulus**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test -- "src/app/(app)/dashboard/page.test.tsx"
```

Harapan: PASS, 4 uji. Bila `'>9<'` gagal karena markup angka berbeda (misalnya ada spasi), periksa keluaran `html` lalu tegaskan angka 9 di dalam elemen nilainya. Jangan melonggarkan uji menjadi `toContain('9')`.

- [x] **Step 5: Commit**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test && npm run lint && npx tsc --noEmit
git add "src/app/(app)/dashboard/page.tsx" "src/app/(app)/dashboard/page.test.tsx"
git commit -F - <<'EOF'
feat(dashboard): enam angka hari ini, jatuh tempo hari ini, dan transaksi terbaru

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

## Task 4: Encoder Code128 dan Komponen Barcode

Spec §8.5 meminta barcode Code128. Pustaka barcode umum bergantung pada DOM atau canvas; encoder di sini murni (masukan untai, keluaran lebar modul), sehingga dirender sebagai SVG di Server Component dan diuji tanpa peramban. Subset B mencakup ASCII 32–126, yaitu seluruh karakter yang dapat diketik petugas pada barcode manual. Barcode otomatis (`BK-000123`) dan nomor transaksi (`PJM-20260925-0001`) termasuk di dalamnya.

**Files:**
- Create: `src/lib/code128.ts`, `src/lib/code128.test.ts`
- Create: `src/components/ui/barcode.tsx`, `src/components/ui/barcode.test.tsx`

**Interfaces:**
- Consumes: —
- Produces:
  - `CODE128_PATTERNS: readonly string[]` (107 pola; indeks 106 = STOP)
  - `code128Values(text: string): number[] | null` — `[104 (START B), ...data, checksum, 106 (STOP)]`, atau `null` bila kosong atau ada karakter di luar ASCII 32–126
  - `encodeCode128(text: string): number[] | null` — lebar modul berselang-seling bar/spasi, dimulai bar
  - `interface BarcodeBars { bars: { x: number; width: number }[]; totalModules: number }`
  - `code128Bars(text: string): BarcodeBars | null` — posisi bar dalam modul, termasuk zona sepi 10 modul di kiri dan kanan
  - `<Barcode value className? />` — `<svg role="img" aria-label="Barcode …">`, atau teks pengganti bila tidak dapat dikodekan

- [x] **Step 1: Tulis uji encoder yang gagal**

Buat `src/lib/code128.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CODE128_PATTERNS, code128Bars, code128Values, encodeCode128 } from './code128';

const widthsOf = (pattern: string) => [...pattern].map(Number);
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

describe('CODE128_PATTERNS', () => {
  it('memuat 107 pola unik: 106 simbol selebar 11 modul dan STOP selebar 13', () => {
    expect(CODE128_PATTERNS).toHaveLength(107);
    expect(new Set(CODE128_PATTERNS).size).toBe(107);
    CODE128_PATTERNS.slice(0, 106).forEach((pattern, value) => {
      expect(pattern, `simbol ${value}`).toMatch(/^[1-4]{6}$/);
      expect(sum(widthsOf(pattern)), `simbol ${value}`).toBe(11);
    });
    expect(CODE128_PATTERNS[106]).toBe('2331112');
  });

  it('mematuhi aturan paritas Code128: jumlah lebar bar tiap simbol genap', () => {
    // Pola yang salah ketik hampir selalu melanggar aturan ini.
    CODE128_PATTERNS.slice(0, 106).forEach((pattern, value) => {
      const [b1, , b2, , b3] = widthsOf(pattern);
      expect((b1 + b2 + b3) % 2, `simbol ${value}`).toBe(0);
    });
  });

  it('memuat pola acuan dari tabel standar', () => {
    expect(CODE128_PATTERNS[0]).toBe('212222');
    expect(CODE128_PATTERNS[33]).toBe('111323');
    expect(CODE128_PATTERNS[64]).toBe('111422');
    expect(CODE128_PATTERNS[103]).toBe('211412');
    expect(CODE128_PATTERNS[104]).toBe('211214');
    expect(CODE128_PATTERNS[105]).toBe('211232');
  });
});

describe('code128Values', () => {
  it('menyusun START B, data, checksum modulo 103, dan STOP', () => {
    // Checksum: (104 + 48·1 + 42·2 + 42·3 + 17·4 + 18·5 + 19·6 + 35·7) mod 103 = 879 mod 103 = 55
    expect(code128Values('PJJ123C')).toEqual([104, 48, 42, 42, 17, 18, 19, 35, 55, 106]);
    // Barcode otomatis sistem: 896 mod 103 = 72
    expect(code128Values('BK-000001')).toEqual([104, 34, 43, 13, 16, 16, 16, 16, 16, 17, 72, 106]);
  });

  it('menolak teks kosong dan karakter di luar ASCII 32–126', () => {
    expect(code128Values('')).toBeNull();
    expect(code128Values('BUKU-É1')).toBeNull();
    expect(code128Values('BK\t1')).toBeNull();
    expect(code128Values('~ ')).toEqual([104, 94, 0, (104 + 94 * 1 + 0 * 2) % 103, 106]);
  });
});

describe('encodeCode128', () => {
  it('menghasilkan lebar modul berselang-seling yang diawali START B dan diakhiri STOP', () => {
    const widths = encodeCode128('A');
    // START B, 'A' (33), checksum (104 + 33) mod 103 = 34, STOP
    expect(widths).toEqual([
      ...widthsOf('211214'), ...widthsOf('111323'), ...widthsOf('131123'), ...widthsOf('2331112'),
    ]);
    expect(sum(widths ?? [])).toBe(11 * 3 + 13);
  });

  it('mengembalikan null bila teks tidak dapat dikodekan', () => {
    expect(encodeCode128('Buku É')).toBeNull();
  });
});

describe('code128Bars', () => {
  it('menempatkan bar setelah zona sepi 10 modul dan menghitung lebar total', () => {
    const result = code128Bars('A');
    expect(result).not.toBeNull();
    // 3 simbol × 3 bar + STOP 4 bar
    expect(result?.bars).toHaveLength(13);
    expect(result?.bars[0]).toEqual({ x: 10, width: 2 });
    expect(result?.totalModules).toBe(46 + 20);
    const last = result?.bars.at(-1);
    expect((last?.x ?? 0) + (last?.width ?? 0)).toBe(46 + 10);
  });

  it('mengembalikan null untuk teks yang tidak dapat dikodekan', () => {
    expect(code128Bars('')).toBeNull();
  });
});
```

- [x] **Step 2: Jalankan uji dan pastikan gagal**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test -- src/lib/code128.test.ts
```

Harapan: FAIL dengan "Failed to resolve import './code128'".

- [x] **Step 3: Tulis encoder**

Buat `src/lib/code128.ts`. Salin tabel pola **persis**. Uji di Step 1 memeriksa panjang, keunikan, paritas, dan beberapa pola acuan, tetapi tidak dapat menangkap dua pola yang tertukar tempat.

```ts
/**
 * Encoder Code128 subset B (spec 8.5), murni: tanpa DOM, tanpa pustaka.
 * Subset B mencakup ASCII 32–126 — seluruh karakter yang dapat diketik
 * pada barcode manual, termasuk barcode otomatis `BK-000123` dan nomor
 * transaksi `PJM-20260925-0001`.
 */

/**
 * Lebar bar dan spasi (dalam modul) untuk nilai simbol 0–106, dimulai
 * dengan bar. Indeks 103–105 adalah START A/B/C; 106 adalah STOP (7 elemen).
 */
export const CODE128_PATTERNS: readonly string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

const START_B = 104;
const STOP = 106;
const FIRST_CODE = 32;
const LAST_CODE = 126;

/** Zona sepi di kiri dan kanan barcode, dalam modul (standar: minimal 10). */
export const QUIET_ZONE_MODULES = 10;

export function code128Values(text: string): number[] | null {
  if (text.length === 0) return null;
  const data: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0) ?? -1;
    if (code < FIRST_CODE || code > LAST_CODE) return null;
    data.push(code - FIRST_CODE);
  }
  const checksum = data.reduce((total, value, index) => total + value * (index + 1), START_B) % 103;
  return [START_B, ...data, checksum, STOP];
}

export function encodeCode128(text: string): number[] | null {
  const values = code128Values(text);
  if (!values) return null;
  return values.flatMap((value) => [...CODE128_PATTERNS[value]].map(Number));
}

export interface BarcodeBars {
  bars: { x: number; width: number }[];
  /** Lebar seluruh barcode termasuk kedua zona sepi. */
  totalModules: number;
}

export function code128Bars(text: string): BarcodeBars | null {
  const widths = encodeCode128(text);
  if (!widths) return null;
  const bars: { x: number; width: number }[] = [];
  let x = QUIET_ZONE_MODULES;
  widths.forEach((width, index) => {
    if (index % 2 === 0) bars.push({ x, width });
    x += width;
  });
  return { bars, totalModules: x + QUIET_ZONE_MODULES };
}
```

- [x] **Step 4: Jalankan uji dan pastikan lulus**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test -- src/lib/code128.test.ts
```

Harapan: PASS. Bila uji paritas atau pola acuan gagal, **tabelnya salah ketik**. Bandingkan baris itu dengan tabel Code128 standar (lampiran spesifikasi ISO/IEC 15417). Jangan mengubah ujinya.

- [x] **Step 5: Tulis uji komponen yang gagal**

Buat `src/components/ui/barcode.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Barcode } from './barcode';

describe('Barcode', () => {
  it('merender SVG dengan satu persegi latar dan satu persegi per bar', () => {
    const html = renderToStaticMarkup(<Barcode value="A" className="h-[14mm] w-full" />);

    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Barcode A"');
    expect(html).toContain('viewBox="0 0 66 40"');
    expect(html).toContain('class="h-[14mm] w-full"');
    expect(html.match(/<rect /g)).toHaveLength(1 + 13);
  });

  it('menampilkan teks dan peringatan bila barcode tidak dapat dikodekan', () => {
    const html = renderToStaticMarkup(<Barcode value="BUKU-É1" />);

    expect(html).not.toContain('<svg');
    expect(html).toContain('BUKU-É1');
    expect(html).toContain('Tidak dapat dicetak sebagai barcode');
  });
});
```

- [x] **Step 6: Jalankan uji dan pastikan gagal**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test -- src/components/ui/barcode.test.tsx
```

Harapan: FAIL dengan "Failed to resolve import './barcode'".

- [x] **Step 7: Tulis komponen**

Buat `src/components/ui/barcode.tsx`:

```tsx
import { code128Bars } from '@/lib/code128';

/** Tinggi relatif di viewBox; tinggi sebenarnya diatur lewat `className`. */
const HEIGHT = 40;

/**
 * Barcode Code128 sebagai SVG. `preserveAspectRatio="none"` membiarkan
 * `className` menentukan ukuran cetaknya dalam mm; `crispEdges` menjaga
 * tepi bar tetap tajam di printer thermal dan laser.
 */
export function Barcode({ value, className }: { value: string; className?: string }) {
  const encoded = code128Bars(value);
  if (!encoded) {
    return (
      <span role="img" aria-label={`Barcode ${value} tidak dapat dicetak`} className={className}>
        <span className="block font-mono font-semibold">{value}</span>
        <span className="block text-[7pt]">Tidak dapat dicetak sebagai barcode: gunakan huruf, angka, dan tanda baca biasa.</span>
      </span>
    );
  }
  return (
    <svg
      role="img"
      aria-label={`Barcode ${value}`}
      viewBox={`0 0 ${encoded.totalModules} ${HEIGHT}`}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      className={className}
    >
      <rect x={0} y={0} width={encoded.totalModules} height={HEIGHT} fill="#fff" />
      {encoded.bars.map((bar) => (
        <rect key={bar.x} x={bar.x} y={0} width={bar.width} height={HEIGHT} fill="#000" />
      ))}
    </svg>
  );
}
```

- [x] **Step 8: Jalankan uji dan pastikan lulus**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test -- src/components/ui/barcode.test.tsx src/lib/code128.test.ts
```

Harapan: PASS.

- [x] **Step 9: Commit**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm run lint && npx tsc --noEmit
git add src/lib/code128.ts src/lib/code128.test.ts src/components/ui/barcode.tsx src/components/ui/barcode.test.tsx
git commit -F - <<'EOF'
feat(cetak): encoder Code128 subset B dan komponen barcode SVG

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

## Task 5: Kerangka Halaman Cetak dan Struk Peminjaman

Halaman cetak memakai grup rute `(cetak)` dengan layout sendiri. Halaman di dalamnya tidak memuat sidebar dan topbar, sehingga yang tercetak hanya struknya. Toolbar di atas struk (tombol Cetak, pilihan lebar, kembali) disembunyikan saat mencetak lewat varian Tailwind `print:hidden`.

**Files:**
- Create: `src/app/(cetak)/layout.tsx`
- Create: `src/components/print/print-toolbar.tsx`
- Create: `src/lib/receipt.ts`, `src/lib/receipt.test.ts`
- Create: `src/app/(cetak)/cetak/struk/[id]/page.tsx`, `src/app/(cetak)/cetak/struk/[id]/page.test.tsx`
- Modify: `src/app/globals.css` (latar putih saat mencetak)
- Modify: `src/app/(app)/transaksi/riwayat/[id]/page.tsx`, `page.test.tsx` (tombol Cetak Struk)
- Modify: `src/app/(app)/transaksi/peminjaman/loan-desk.tsx` (tombol Cetak Struk di konfirmasi)

**Interfaces:**
- Consumes: `getLoanDetail`, `LoanDetail` (`src/server/queries/loans.ts`); `getLibrarySettings` (`schoolName`, `receiptFooter`); `<Barcode>` (Task 4); `formatDate`; `schoolToday`, `formatSchoolDateTime`; `firstValue`, `withQuery`, `SearchParams`; `requireProfile`; `buttonClass`
- Produces:
  - Layout `(cetak)` — memanggil `requireProfile()`, tanpa sidebar
  - `<PrintToolbar backHref backLabel autoFocus? children? />` (komponen klien; tombol Cetak memanggil `window.print()`)
  - `type ReceiptWidth = 58 | 80`, `parseReceiptWidth(value: string): ReceiptWidth`, `receiptPageHeightMm(itemCount: number, hasFooter: boolean, hasNotes: boolean): number`, `receiptPageCss(width: ReceiptWidth, heightMm: number): string`
  - Rute `/cetak/struk/[id]` (`?lebar=80` untuk kertas 80 mm)

- [x] **Step 1: Tulis uji ukuran struk yang gagal**

Buat `src/lib/receipt.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseReceiptWidth, receiptPageCss, receiptPageHeightMm } from './receipt';

describe('parseReceiptWidth', () => {
  it('memakai 58 mm kecuali diminta 80 mm', () => {
    expect(parseReceiptWidth('80')).toBe(80);
    expect(parseReceiptWidth('58')).toBe(58);
    expect(parseReceiptWidth('')).toBe(58);
    expect(parseReceiptWidth('100')).toBe(58);
  });
});

describe('receiptPageHeightMm', () => {
  it('menambah tinggi untuk setiap buku, catatan kaki, dan catatan transaksi', () => {
    expect(receiptPageHeightMm(1, false, false)).toBe(122);
    expect(receiptPageHeightMm(3, false, false)).toBe(146);
    expect(receiptPageHeightMm(3, true, true)).toBe(170);
  });
});

describe('receiptPageCss', () => {
  it('menyusun aturan @page selebar kertas tanpa margin', () => {
    expect(receiptPageCss(58, 146)).toBe('@page { size: 58mm 146mm; margin: 0; }');
    expect(receiptPageCss(80, 122)).toBe('@page { size: 80mm 122mm; margin: 0; }');
  });
});
```

- [x] **Step 2: Jalankan uji dan pastikan gagal**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test -- src/lib/receipt.test.ts
```

Harapan: FAIL dengan "Failed to resolve import './receipt'".

- [x] **Step 3: Tulis modul ukuran struk**

Buat `src/lib/receipt.ts`:

```ts
/** Lebar kertas printer thermal yang didukung (spec 8.5). */
export type ReceiptWidth = 58 | 80;

export function parseReceiptWidth(value: string): ReceiptWidth {
  return value === '80' ? 80 : 58;
}

const BASE_HEIGHT_MM = 110;
const PER_ITEM_MM = 12;
const FOOTER_MM = 14;
const NOTES_MM = 10;

/**
 * Tinggi halaman struk. CSS `@page` tidak mengenal tinggi "otomatis",
 * jadi tingginya diperkirakan dari isi struk. Sisa kertas kosong di bawah
 * struk lebih baik daripada struk yang terpotong ke halaman kedua.
 */
export function receiptPageHeightMm(itemCount: number, hasFooter: boolean, hasNotes: boolean): number {
  return BASE_HEIGHT_MM + itemCount * PER_ITEM_MM + (hasFooter ? FOOTER_MM : 0) + (hasNotes ? NOTES_MM : 0);
}

export function receiptPageCss(width: ReceiptWidth, heightMm: number): string {
  return `@page { size: ${width}mm ${heightMm}mm; margin: 0; }`;
}
```

- [x] **Step 4: Jalankan uji dan pastikan lulus**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test -- src/lib/receipt.test.ts
```

Harapan: PASS.

- [x] **Step 5: Tulis uji halaman struk yang gagal**

Buat `src/app/(cetak)/cetak/struk/[id]/page.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockGetLoanDetail, mockSettings, mockNotFound } = vi.hoisted(() => ({
  mockGetLoanDetail: vi.fn(),
  mockSettings: vi.fn(),
  mockNotFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('@/server/queries/loans', () => ({ getLoanDetail: mockGetLoanDetail }));
vi.mock('@/server/queries/settings', () => ({ getLibrarySettings: mockSettings }));
vi.mock('@/lib/school-date', () => ({
  schoolToday: () => '2090-03-09',
  formatSchoolDateTime: () => '09/03/2090 10.15',
}));
vi.mock('@/server/auth/guard', () => ({
  requireProfile: vi.fn(async () => ({ id: 'u1', role: 'petugas', fullName: 'Petugas', status: 'active' })),
}));
vi.mock('next/navigation', () => ({ notFound: mockNotFound }));

import ReceiptPage from './page';

const loan = {
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
  createdByName: 'Siti Petugas',
  totalFine: 0,
  paidTotal: 0,
  unpaidFine: 0,
  daysOverdue: 4,
  items: [
    {
      id: 'i1', bookCopyId: 'c1', barcode: 'BK-000001', bookTitle: 'Pemrograman Web', bookPrice: 85000,
      returnedAt: new Date('2090-03-04T03:00:00Z'), returnCondition: 'BAIK' as const, daysLate: 0,
      lateFine: 0, replacementFee: 0, conditionNote: null,
    },
    {
      id: 'i2', bookCopyId: 'c2', barcode: 'BK-000002', bookTitle: 'Basis Data', bookPrice: 60000,
      returnedAt: null, returnCondition: null, daysLate: 0, lateFine: 0, replacementFee: 0, conditionNote: null,
    },
  ],
  payments: [],
};

const settings = {
  maxActiveLoans: 3, loanDurationDays: 3, finePerDay: 1000, blockWhenOverdue: true, blockWhenUnpaidFine: false,
  schoolName: 'SMK Negeri 1 Contoh', receiptFooter: 'Terima kasih. Simpan struk ini.',
};

async function render(params: Record<string, string> = {}, id = 'l1') {
  return renderToStaticMarkup(await ReceiptPage({
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve(params),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetLoanDetail.mockResolvedValue(loan);
  mockSettings.mockResolvedValue(settings);
});

describe('ReceiptPage', () => {
  it('memuat isi struk sesuai spec 8.5, termasuk buku yang sudah kembali', async () => {
    const html = await render();

    expect(mockGetLoanDetail).toHaveBeenCalledWith('l1', '2090-03-09');
    expect(html).toContain('SMK Negeri 1 Contoh');
    expect(html).toContain('STRUK PEMINJAMAN BUKU');
    expect(html).toContain('PJM-20900302-0001');
    expect(html).toContain('Ahmad Fauzi');
    expect(html).toContain('202600123');
    expect(html).toContain('XI RPL 1');
    expect(html).toContain('02/03/2090');
    expect(html).toContain('05/03/2090');
    expect(html).toContain('Pemrograman Web');
    expect(html).toContain('BK-000001');
    expect(html).toContain('Basis Data');
    expect(html).toContain('BK-000002');
    expect(html).toContain('Jumlah: 2 buku');
    expect(html).toContain('Petugas: Siti Petugas');
    expect(html).toContain('Dicetak: 09/03/2090 10.15');
    expect(html).toContain('Terima kasih. Simpan struk ini.');
    expect(html).toContain('aria-label="Barcode PJM-20900302-0001"');
  });

  it('memakai kertas 58 mm secara bawaan dan 80 mm bila diminta', async () => {
    const narrow = await render();
    expect(narrow).toContain('@page { size: 58mm 148mm; margin: 0; }');
    expect(narrow).toContain('w-[58mm]');
    expect(narrow).toContain('href="/cetak/struk/l1?lebar=80"');

    const wide = await render({ lebar: '80' });
    expect(wide).toContain('@page { size: 80mm 148mm; margin: 0; }');
    expect(wide).toContain('w-[80mm]');
    expect(wide).toContain('href="/cetak/struk/l1"');
  });

  it('memakai nama bawaan dan melewati catatan kaki yang kosong', async () => {
    mockSettings.mockResolvedValueOnce({ ...settings, schoolName: '  ', receiptFooter: null });

    const html = await render();

    expect(html).toContain('Perpustakaan Sekolah');
    expect(html).toContain('@page { size: 58mm 134mm; margin: 0; }');
  });

  it('mencetak catatan transaksi bila ada', async () => {
    mockGetLoanDetail.mockResolvedValueOnce({ ...loan, notes: 'Untuk tugas kelompok' });
    expect(await render()).toContain('Catatan: Untuk tugas kelompok');
  });

  it('menampilkan halaman tidak ditemukan untuk transaksi yang tidak ada', async () => {
    mockGetLoanDetail.mockResolvedValueOnce(null);
    await expect(render({}, 'bukan-uuid')).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
```

Tinggi yang diharapkan untuk dua buku: 110 + 2 × 12 = 134 mm, ditambah 14 mm bila ada catatan kaki (148 mm).

- [x] **Step 6: Jalankan uji dan pastikan gagal**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test -- "src/app/(cetak)/cetak/struk"
```

Harapan: FAIL dengan "Failed to resolve import './page'".

- [x] **Step 7: Tulis layout cetak, toolbar, dan halaman struk**

Buat `src/app/(cetak)/layout.tsx`:

```tsx
import { requireProfile } from '@/server/auth/guard';

/**
 * Kerangka halaman cetak: tanpa sidebar dan topbar, sehingga yang tercetak
 * hanya isi cetakannya. Setiap halaman tetap memanggil `requireProfile()`
 * sendiri; layout bukan batas keamanan (spec §7).
 */
export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  await requireProfile();
  return <div className="min-h-screen bg-white text-black">{children}</div>;
}
```

Buat `src/components/print/print-toolbar.tsx`:

```tsx
'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { buttonClass } from '@/components/ui/button-styles';

/**
 * Tombol di atas halaman cetak. Tidak ikut tercetak. Tombol Cetak mendapat
 * fokus awal agar petugas cukup menekan Enter (alur papan ketik, spec 8.1).
 */
export function PrintToolbar({
  backHref, backLabel, autoFocus = true, children,
}: { backHref: string; backLabel: string; autoFocus?: boolean; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-ink-100)] bg-[var(--color-ink-50)] px-4 py-3 print:hidden">
      <button type="button" autoFocus={autoFocus} onClick={() => window.print()} className={buttonClass('primary')}>
        Cetak
      </button>
      <Link href={backHref} className={buttonClass('secondary')}>{backLabel}</Link>
      {children}
    </div>
  );
}
```

Buat `src/app/(cetak)/cetak/struk/[id]/page.tsx`:

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PrintToolbar } from '@/components/print/print-toolbar';
import { Barcode } from '@/components/ui/barcode';
import { buttonClass } from '@/components/ui/button-styles';
import { formatDate } from '@/lib/format';
import { parseReceiptWidth, receiptPageCss, receiptPageHeightMm, type ReceiptWidth } from '@/lib/receipt';
import { formatSchoolDateTime, schoolToday } from '@/lib/school-date';
import { firstValue, withQuery, type SearchParams } from '@/lib/search-params';
import { requireProfile } from '@/server/auth/guard';
import { getLoanDetail } from '@/server/queries/loans';
import { getLibrarySettings } from '@/server/queries/settings';

const WIDTHS: ReceiptWidth[] = [58, 80];
const WIDTH_CLASS: Record<ReceiptWidth, string> = { 58: 'w-[58mm]', 80: 'w-[80mm]' };
const RULE = 'my-2 border-t border-dashed border-black';

export default async function ReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  await requireProfile();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const width = parseReceiptWidth(firstValue(query.lebar));
  const [loan, settings] = await Promise.all([getLoanDetail(id, schoolToday()), getLibrarySettings()]);
  if (!loan) notFound();

  const schoolName = settings.schoolName?.trim() || 'Perpustakaan Sekolah';
  const footer = settings.receiptFooter?.trim() || null;
  const height = receiptPageHeightMm(loan.items.length, footer !== null, loan.notes !== null);

  return (
    <>
      <style>{receiptPageCss(width, height)}</style>
      <PrintToolbar backHref={`/transaksi/riwayat/${loan.id}`} backLabel="Kembali ke transaksi">
        <span className="ml-2 text-sm text-[var(--color-ink-500)]">Lebar kertas:</span>
        {WIDTHS.map((option) => (
          <Link
            key={option}
            href={withQuery(`/cetak/struk/${loan.id}`, { lebar: option === 58 ? undefined : option })}
            aria-current={option === width ? 'true' : undefined}
            className={buttonClass(option === width ? 'primary' : 'secondary', 'sm')}
          >
            {option} mm
          </Link>
        ))}
      </PrintToolbar>

      <article
        aria-label={`Struk ${loan.transactionNumber}`}
        className={`${WIDTH_CLASS[width]} mx-auto my-6 px-[3mm] py-[4mm] text-[11px] leading-snug print:my-0`}
      >
        <header className="text-center">
          <p className="text-[13px] font-bold">{schoolName}</p>
          <p className="font-semibold">STRUK PEMINJAMAN BUKU</p>
        </header>
        <hr className={RULE} />
        <dl className="grid grid-cols-[auto_1fr] gap-x-2">
          <dt>No.</dt><dd className="font-mono">{loan.transactionNumber}</dd>
          <dt>Siswa</dt><dd>{loan.studentName}</dd>
          <dt>NIS</dt><dd className="font-mono">{loan.studentNis}</dd>
          <dt>Kelas</dt><dd>{loan.studentClass}</dd>
          <dt>Pinjam</dt><dd>{formatDate(loan.loanDate)}</dd>
          <dt>Kembali</dt><dd className="font-bold">{formatDate(loan.dueDate)}</dd>
        </dl>
        <hr className={RULE} />
        <ol className="space-y-1">
          {loan.items.map((item, index) => (
            <li key={item.id}>
              {index + 1}. {item.bookTitle}
              <span className="block pl-3 font-mono">{item.barcode}</span>
            </li>
          ))}
        </ol>
        <p className="mt-1">Jumlah: {loan.items.length} buku</p>
        {loan.notes && <p className="mt-1">Catatan: {loan.notes}</p>}
        <hr className={RULE} />
        <p>Petugas: {loan.createdByName}</p>
        <p>Dicetak: {formatSchoolDateTime(new Date())}</p>
        <Barcode value={loan.transactionNumber} className="mt-2 h-[12mm] w-full" />
        {footer && <p className="mt-2 text-center">{footer}</p>}
      </article>
    </>
  );
}
```

Tambahkan di akhir `src/app/globals.css`:

```css
/* Halaman cetak: latar abu-abu aplikasi tidak ikut tercetak. */
@media print {
  body {
    background: #fff;
  }
}
```

- [x] **Step 8: Jalankan uji dan pastikan lulus**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test -- "src/app/(cetak)/cetak/struk" src/lib/receipt.test.ts
```

Harapan: PASS, 5 uji halaman. Bila uji `@page` gagal karena React meloloskan (escape) isi `<style>`, periksa keluaran markup. React 19 tidak meloloskan teks di dalam `<style>`, jadi untai di uji harus muncul apa adanya.

- [x] **Step 9: Tulis uji tombol Cetak Struk yang gagal di detail transaksi**

Tambahkan di akhir `describe('LoanDetailPage')` di `src/app/(app)/transaksi/riwayat/[id]/page.test.tsx`:

```tsx
  it('menawarkan cetak struk, juga untuk transaksi yang sudah selesai', async () => {
    const open = await render(baseLoan);
    expect(open).toContain('href="/cetak/struk/l1"');

    const done = await render({ ...baseLoan, status: 'SELESAI', unpaidFine: 0, paidTotal: 54000, daysOverdue: 0 });
    expect(done).toContain('href="/cetak/struk/l1"');
  });
```

- [x] **Step 10: Jalankan uji dan pastikan gagal**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test -- "src/app/(app)/transaksi/riwayat/\[id\]"
```

Harapan: FAIL, tautan `/cetak/struk/l1` belum ada.

- [x] **Step 11: Tambahkan tombol Cetak Struk**

Di `src/app/(app)/transaksi/riwayat/[id]/page.tsx`, ganti prop `actions` pada `<PageHeader>` dengan:

```tsx
        actions={(
          <>
            <Link href={`/cetak/struk/${loan.id}`} className={buttonClass('secondary')}>Cetak Struk</Link>
            {isOpen && (
              <Link
                href={withQuery('/transaksi/pengembalian', { q: loan.transactionNumber, pinjam: loan.id })}
                className={buttonClass('primary')}
              >
                Proses Pengembalian
              </Link>
            )}
          </>
        )}
```

Di `src/app/(app)/transaksi/peminjaman/loan-desk.tsx`, pada panel konfirmasi `outcome?.status === 'success'`, tambahkan tautan setelah tombol "Peminjaman Baru" (sebelum "Lihat Transaksi"):

```tsx
          <Link
            href={`/cetak/struk/${outcome.loanId}`}
            target="_blank"
            rel="noopener"
            className={buttonClass('secondary')}
          >
            Cetak Struk
          </Link>
```

Struk dibuka di tab baru agar meja peminjaman tetap siap untuk siswa berikutnya (spec 8.2: "dialog konfirmasi memuat nomor transaksi dan tombol Cetak Struk"). "Peminjaman Baru" tetap mendapat fokus awal.

- [x] **Step 12: Jalankan uji dan pastikan lulus**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test -- "src/app/(app)/transaksi/riwayat/\[id\]"
```

Harapan: PASS. Uji lama "menyembunyikan … tombol pengembalian untuk transaksi selesai" tetap lulus, karena tautan struk tidak mengandung `/transaksi/pengembalian`.

- [x] **Step 13: Commit**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test && npm run lint && npx tsc --noEmit && npm run build
git add "src/app/(cetak)" src/components/print src/lib/receipt.ts src/lib/receipt.test.ts src/app/globals.css \
  "src/app/(app)/transaksi/riwayat/[id]/page.tsx" "src/app/(app)/transaksi/riwayat/[id]/page.test.tsx" \
  "src/app/(app)/transaksi/peminjaman/loan-desk.tsx"
git commit -F - <<'EOF'
feat(cetak): struk peminjaman thermal 58/80 mm dengan barcode nomor transaksi

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

Harapan `npm run build`: rute `/cetak/struk/[id]` tercantum.

---

## Task 6: Cetak Label Barcode

Spec §8.5: "halaman cetak berisi kisi label untuk ditempel pada eksemplar buku, dapat dipilih per rentang atau per judul". Per judul: tombol "Cetak Label" di halaman detail buku membuka `/cetak/label-barcode?buku=<id>`. Per rentang: form di halaman label mengisi `?dari=BK-000001&sampai=BK-000021`. Eksemplar `NONAKTIF` tidak dilabeli. Spec §12 menyebut halaman ini sebagai mitigasi data buku awal yang belum berbarcode.

**Files:**
- Create: `src/lib/label-request.ts`, `src/lib/label-request.test.ts`
- Create: `src/server/queries/labels.ts`
- Create: `tests/integration/labels.test.ts`
- Create: `src/app/(cetak)/cetak/label-barcode/page.tsx`, `page.test.tsx`
- Modify: `src/app/(app)/master/buku/[id]/page.tsx`, `page.test.tsx` (tombol Cetak Label)
- Modify: `src/components/layout/sidebar.tsx`, `sidebar.test.tsx` (menu "Label Barcode")

**Interfaces:**
- Consumes: `<PrintToolbar>`, layout `(cetak)` (Task 5); `<Barcode>`, `encodeCode128` (Task 4); `getLibrarySettings`; `isUuid`; `firstValue`, `SearchParams`; `requireProfile`; fixture `circulationFixture` (Task 2 Rencana 04)
- Produces:
  - `MAX_LABELS = 210`, `LABELS_PER_SHEET = 21`
  - `type LabelRequest = { kind: 'none' } | { kind: 'book'; bookId: string } | { kind: 'range'; from: string; to: string } | { kind: 'invalid'; message: string }`
  - `parseLabelRequest(params: { buku: string; dari: string; sampai: string }): LabelRequest`
  - `interface LabelCopy { id: string; barcode: string; bookTitle: string; rackCode: string | null }`
  - `findLabelCopies(query: { kind: 'book'; bookId: string } | { kind: 'range'; from: string; to: string }, executor?): Promise<{ copies: LabelCopy[]; total: number }>` — `copies` maks. `MAX_LABELS`, urut barcode; `total` = seluruh yang cocok
  - Rute `/cetak/label-barcode`

- [x] **Step 1: Tulis uji pembacaan permintaan label yang gagal**

Buat `src/lib/label-request.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { LABELS_PER_SHEET, MAX_LABELS, parseLabelRequest } from './label-request';

const empty = { buku: '', dari: '', sampai: '' };

describe('parseLabelRequest', () => {
  it('tanpa pilihan: belum ada yang dicetak', () => {
    expect(parseLabelRequest(empty)).toEqual({ kind: 'none' });
  });

  it('per judul bila id buku diisi, mengabaikan rentang', () => {
    expect(parseLabelRequest({ buku: ' b1 ', dari: 'BK-000001', sampai: '' })).toEqual({ kind: 'book', bookId: 'b1' });
  });

  it('per rentang, dirapikan dan dijadikan huruf besar', () => {
    expect(parseLabelRequest({ ...empty, dari: ' bk-000001 ', sampai: 'bk-000021' }))
      .toEqual({ kind: 'range', from: 'BK-000001', to: 'BK-000021' });
    expect(parseLabelRequest({ ...empty, dari: 'BK-000005', sampai: 'BK-000005' }))
      .toEqual({ kind: 'range', from: 'BK-000005', to: 'BK-000005' });
  });

  it('menjelaskan rentang yang belum lengkap', () => {
    expect(parseLabelRequest({ ...empty, dari: 'BK-000001' })).toEqual({
      kind: 'invalid',
      message: 'Isi barcode awal dan akhir rentang, misalnya BK-000001 sampai BK-000021.',
    });
  });

  it('menjelaskan rentang yang terbalik', () => {
    expect(parseLabelRequest({ ...empty, dari: 'BK-000030', sampai: 'BK-000010' })).toEqual({
      kind: 'invalid',
      message: 'Rentang terbalik: BK-000030 berada setelah BK-000010. Tukar barcode awal dan akhirnya.',
    });
  });

  it('memakai lembar A4 berisi 21 label dan batas 10 lembar sekali cetak', () => {
    expect(LABELS_PER_SHEET).toBe(21);
    expect(MAX_LABELS).toBe(210);
  });
});
```

- [x] **Step 2: Jalankan uji dan pastikan gagal**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test -- src/lib/label-request.test.ts
```

Harapan: FAIL dengan "Failed to resolve import './label-request'".

- [x] **Step 3: Tulis pembaca permintaan label**

Buat `src/lib/label-request.ts`:

```ts
/** Lembar label A4 3 × 7, tiap label 63,5 × 38,1 mm. */
export const LABELS_PER_SHEET = 21;

/** Sepuluh lembar sekali cetak: halaman tetap ringan dan printer tidak macet di tengah antrean panjang. */
export const MAX_LABELS = LABELS_PER_SHEET * 10;

export type LabelRequest =
  | { kind: 'none' }
  | { kind: 'book'; bookId: string }
  | { kind: 'range'; from: string; to: string }
  | { kind: 'invalid'; message: string };

/**
 * Membaca pilihan label dari URL. Perbandingan rentang memakai urutan
 * byte (sama dengan `collate "C"` di query), sehingga BK-000010 berada
 * setelah BK-000009 selama jumlah digitnya sama.
 */
export function parseLabelRequest(params: { buku: string; dari: string; sampai: string }): LabelRequest {
  const bookId = params.buku.trim();
  if (bookId) return { kind: 'book', bookId };

  const from = params.dari.trim().toUpperCase();
  const to = params.sampai.trim().toUpperCase();
  if (!from && !to) return { kind: 'none' };
  if (!from || !to) {
    return { kind: 'invalid', message: 'Isi barcode awal dan akhir rentang, misalnya BK-000001 sampai BK-000021.' };
  }
  if (from > to) {
    return { kind: 'invalid', message: `Rentang terbalik: ${from} berada setelah ${to}. Tukar barcode awal dan akhirnya.` };
  }
  return { kind: 'range', from, to };
}
```

- [x] **Step 4: Jalankan uji dan pastikan lulus**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test -- src/lib/label-request.test.ts
```

Harapan: PASS.

- [x] **Step 5: Tulis uji integrasi query label yang gagal**

Buat `tests/integration/labels.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { MAX_LABELS } from '@/lib/label-request';
import { bookCopies } from '@/server/db/schema';
import { findLabelCopies } from '@/server/queries/labels';
import { circulationFixture } from './circulation-fixture';
import { withRollback } from './helpers';

describe('findLabelCopies', () => {
  it('per judul: seluruh eksemplar yang tidak nonaktif, urut barcode, dengan judul dan rak', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx, { copies: 3 });
      await tx.update(bookCopies).set({ status: 'NONAKTIF' }).where(eq(bookCopies.id, fx.copies[1].id));

      const result = await findLabelCopies({ kind: 'book', bookId: fx.bookId }, tx);

      expect(result.total).toBe(2);
      expect(result.copies).toEqual([
        { id: fx.copies[0].id, barcode: 'UJI-SRK-01', bookTitle: 'UJI-Buku Sirkulasi', rackCode: 'UJI-R1' },
        { id: fx.copies[2].id, barcode: 'UJI-SRK-03', bookTitle: 'UJI-Buku Sirkulasi', rackCode: 'UJI-R1' },
      ]);
    });
  });

  it('per rentang: barcode di antara kedua ujung, termasuk ujungnya', async () => {
    await withRollback(async (tx) => {
      await circulationFixture(tx, { copies: 5 });

      const result = await findLabelCopies({ kind: 'range', from: 'UJI-SRK-02', to: 'UJI-SRK-04' }, tx);

      expect(result.total).toBe(3);
      expect(result.copies.map((copy) => copy.barcode)).toEqual(['UJI-SRK-02', 'UJI-SRK-03', 'UJI-SRK-04']);
    });
  });

  it('membatasi jumlah label tetapi melaporkan jumlah seluruhnya', async () => {
    await withRollback(async (tx) => {
      await circulationFixture(tx, { copies: MAX_LABELS + 5 });

      const result = await findLabelCopies({ kind: 'range', from: 'UJI-SRK-', to: 'UJI-SRK-~' }, tx);

      expect(result.total).toBe(MAX_LABELS + 5);
      expect(result.copies).toHaveLength(MAX_LABELS);
    });
  });

  it('mengembalikan kosong untuk id buku yang bukan UUID', async () => {
    await withRollback(async (tx) => {
      expect(await findLabelCopies({ kind: 'book', bookId: 'bukan-uuid' }, tx)).toEqual({ copies: [], total: 0 });
    });
  });
});
```

- [x] **Step 6: Jalankan uji dan pastikan gagal**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm run test:integration -- tests/integration/labels.test.ts
```

Harapan: FAIL dengan "Failed to resolve import '@/server/queries/labels'".

- [x] **Step 7: Tulis query label**

Buat `src/server/queries/labels.ts`:

```ts
import { and, eq, ne, sql } from 'drizzle-orm';
import { MAX_LABELS } from '@/lib/label-request';
import { db } from '@/server/db/client';
import type { Executor } from '@/server/db/executor';
import { bookCopies, books, racks } from '@/server/db/schema';
import { isUuid } from '@/server/validation/common';

export interface LabelCopy {
  id: string;
  barcode: string;
  bookTitle: string;
  rackCode: string | null;
}

export type LabelQuery = { kind: 'book'; bookId: string } | { kind: 'range'; from: string; to: string };

/**
 * Eksemplar untuk dicetak labelnya, maksimal MAX_LABELS. Rentang dibandingkan
 * dengan `collate "C"` (urutan byte) agar sama dengan pemeriksaan rentang
 * terbalik di `parseLabelRequest`; collation bawaan database dapat
 * mengabaikan tanda baca seperti "-".
 */
export async function findLabelCopies(
  query: LabelQuery,
  executor: Executor = db,
): Promise<{ copies: LabelCopy[]; total: number }> {
  if (query.kind === 'book' && !isUuid(query.bookId)) return { copies: [], total: 0 };

  const where = and(
    ne(bookCopies.status, 'NONAKTIF'),
    query.kind === 'book'
      ? eq(bookCopies.bookId, query.bookId)
      : sql`${bookCopies.barcode} collate "C" between ${query.from} and ${query.to}`,
  );

  const copies = await executor
    .select({
      id: bookCopies.id,
      barcode: bookCopies.barcode,
      bookTitle: books.title,
      rackCode: racks.code,
    })
    .from(bookCopies)
    .innerJoin(books, eq(books.id, bookCopies.bookId))
    .leftJoin(racks, eq(racks.id, books.rackId))
    .where(where)
    .orderBy(sql`${bookCopies.barcode} collate "C"`)
    .limit(MAX_LABELS);

  const [{ total }] = await executor
    .select({ total: sql<number>`count(*)::int` })
    .from(bookCopies)
    .where(where);

  return { copies, total: Number(total) };
}
```

- [x] **Step 8: Jalankan uji dan pastikan lulus**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm run test:integration -- tests/integration/labels.test.ts
```

Harapan: PASS, 4 uji.

- [x] **Step 9: Tulis uji halaman label yang gagal**

Buat `src/app/(cetak)/cetak/label-barcode/page.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { LabelCopy } from '@/server/queries/labels';

const { mockFind, mockSettings } = vi.hoisted(() => ({ mockFind: vi.fn(), mockSettings: vi.fn() }));

vi.mock('@/server/queries/labels', () => ({ findLabelCopies: mockFind }));
vi.mock('@/server/queries/settings', () => ({ getLibrarySettings: mockSettings }));
vi.mock('@/server/auth/guard', () => ({
  requireProfile: vi.fn(async () => ({ id: 'u1', role: 'petugas', fullName: 'Petugas', status: 'active' })),
}));

import LabelPage from './page';

function copy(barcode: string, title = 'Pemrograman Web'): LabelCopy {
  return { id: `id-${barcode}`, barcode, bookTitle: title, rackCode: 'A-3' };
}

async function render(params: Record<string, string> = {}) {
  return renderToStaticMarkup(await LabelPage({ searchParams: Promise.resolve(params) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSettings.mockResolvedValue({ schoolName: 'SMK Negeri 1 Contoh', receiptFooter: null });
});

describe('LabelPage', () => {
  it('tanpa pilihan: menampilkan petunjuk dan tidak membaca eksemplar', async () => {
    const html = await render();

    expect(mockFind).not.toHaveBeenCalled();
    expect(html).toContain('Cetak Label Barcode');
    expect(html).toContain('name="dari"');
    expect(html).toContain('name="sampai"');
    expect(html).toContain('Cetak Label');
    expect(html).toContain('@page { size: A4; margin: 10mm 7mm; }');
  });

  it('menjelaskan rentang yang tidak lengkap tanpa membaca eksemplar', async () => {
    const html = await render({ dari: 'BK-000001' });

    expect(mockFind).not.toHaveBeenCalled();
    expect(html).toContain('Isi barcode awal dan akhir rentang');
    expect(html).toContain('value="BK-000001"');
  });

  it('mencetak satu label per eksemplar dengan nama sekolah, judul, barcode, dan rak', async () => {
    mockFind.mockResolvedValueOnce({ copies: [copy('BK-000001'), copy('BK-000002')], total: 2 });

    const html = await render({ dari: 'bk-000001', sampai: 'BK-000002' });

    expect(mockFind).toHaveBeenCalledWith({ kind: 'range', from: 'BK-000001', to: 'BK-000002' });
    expect(html).toContain('2 label · 1 lembar A4');
    expect(html).toContain('aria-label="Barcode BK-000001"');
    expect(html).toContain('aria-label="Barcode BK-000002"');
    expect(html.match(/SMK Negeri 1 Contoh/g)).toHaveLength(2);
    expect(html).toContain('Rak A-3');
  });

  it('per judul: menyebut judulnya dan kembali ke halaman buku', async () => {
    mockFind.mockResolvedValueOnce({ copies: [copy('BK-000007', 'Basis Data')], total: 1 });

    const html = await render({ buku: 'b1' });

    expect(mockFind).toHaveBeenCalledWith({ kind: 'book', bookId: 'b1' });
    expect(html).toContain('1 label untuk &quot;Basis Data&quot; · 1 lembar A4');
    expect(html).toContain('href="/master/buku/b1"');
  });

  it('menjelaskan bila tidak ada eksemplar yang cocok', async () => {
    mockFind.mockResolvedValueOnce({ copies: [], total: 0 });
    expect(await render({ dari: 'BK-900000', sampai: 'BK-900010' }))
      .toContain('Tidak ada eksemplar aktif dengan barcode BK-900000 sampai BK-900010.');

    mockFind.mockResolvedValueOnce({ copies: [], total: 0 });
    expect(await render({ buku: 'b1' }))
      .toContain('Judul ini belum punya eksemplar aktif untuk dilabeli.');
  });

  it('memberi tahu bila rentang melebihi batas sekali cetak', async () => {
    const copies = Array.from({ length: 210 }, (_, index) => copy(`BK-${String(index + 1).padStart(6, '0')}`));
    mockFind.mockResolvedValueOnce({ copies, total: 250 });

    const html = await render({ dari: 'BK-000001', sampai: 'BK-000250' });

    expect(html).toContain(
      'Rentang ini berisi 250 eksemplar; sekali cetak maksimal 210 label (10 lembar). Yang tampil sampai BK-000210; cetak sisanya dengan rentang mulai setelah barcode itu.',
    );
    expect(html).toContain('210 label · 10 lembar A4');
  });

  it('memperingatkan barcode yang tidak dapat dikodekan, tanpa menggagalkan label lain', async () => {
    mockFind.mockResolvedValueOnce({ copies: [copy('BK-000001'), copy('BUKU-É1')], total: 2 });

    const html = await render({ dari: 'B', sampai: 'BZ' });

    expect(html).toContain('1 barcode tidak dapat dicetak sebagai Code128: BUKU-É1.');
    expect(html).toContain('aria-label="Barcode BK-000001"');
    expect(html).toContain('Tidak dapat dicetak sebagai barcode');
  });
});
```

- [x] **Step 10: Jalankan uji dan pastikan gagal**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test -- "src/app/(cetak)/cetak/label-barcode"
```

Harapan: FAIL dengan "Failed to resolve import './page'".

- [x] **Step 11: Tulis halaman label**

Buat `src/app/(cetak)/cetak/label-barcode/page.tsx`:

```tsx
import { PrintToolbar } from '@/components/print/print-toolbar';
import { Barcode } from '@/components/ui/barcode';
import { buttonClass } from '@/components/ui/button-styles';
import { encodeCode128 } from '@/lib/code128';
import { LABELS_PER_SHEET, MAX_LABELS, parseLabelRequest } from '@/lib/label-request';
import { firstValue, type SearchParams } from '@/lib/search-params';
import { requireProfile } from '@/server/auth/guard';
import { findLabelCopies, type LabelCopy } from '@/server/queries/labels';
import { getLibrarySettings } from '@/server/queries/settings';

const CONTROL = 'rounded-md border border-[var(--color-ink-300)] bg-white px-3 py-2 text-sm';
const ALERT = 'mt-3 rounded-md bg-[var(--color-status-terlambat)]/10 px-3 py-2 text-sm text-[var(--color-status-terlambat)]';
const WARN = 'mt-3 rounded-md bg-[var(--color-status-rusak)]/10 px-3 py-2 text-sm text-[var(--color-status-rusak)]';

function sheetsOf(count: number): number {
  return Math.ceil(count / LABELS_PER_SHEET);
}

export default async function LabelPage({ searchParams }: { searchParams: SearchParams }) {
  await requireProfile();
  const params = await searchParams;
  const dari = firstValue(params.dari);
  const sampai = firstValue(params.sampai);
  const request = parseLabelRequest({ buku: firstValue(params.buku), dari, sampai });

  const [settings, batch] = await Promise.all([
    getLibrarySettings(),
    request.kind === 'book' || request.kind === 'range' ? findLabelCopies(request) : Promise.resolve(null),
  ]);
  const schoolName = settings.schoolName?.trim() || 'Perpustakaan Sekolah';
  const copies: LabelCopy[] = batch?.copies ?? [];
  const unprintable = copies.filter((copy) => encodeCode128(copy.barcode) === null).map((copy) => copy.barcode);

  let problem: string | null = null;
  if (request.kind === 'invalid') problem = request.message;
  if (batch && batch.total === 0) {
    problem = request.kind === 'book'
      ? 'Judul ini belum punya eksemplar aktif untuk dilabeli. Tambahkan eksemplarnya di halaman buku.'
      : `Tidak ada eksemplar aktif dengan barcode ${dari.trim().toUpperCase()} sampai ${sampai.trim().toUpperCase()}.`;
  }
  const truncated = batch !== null && batch.total > MAX_LABELS
    ? `Rentang ini berisi ${batch.total} eksemplar; sekali cetak maksimal ${MAX_LABELS} label (10 lembar). Yang tampil sampai ${copies.at(-1)?.barcode ?? ''}; cetak sisanya dengan rentang mulai setelah barcode itu.`
    : null;
  const subject = request.kind === 'book' && copies.length > 0 ? ` untuk "${copies[0].bookTitle}"` : '';

  return (
    <>
      <style>{'@page { size: A4; margin: 10mm 7mm; }'}</style>
      <PrintToolbar
        backHref={request.kind === 'book' ? `/master/buku/${request.bookId}` : '/master/buku'}
        backLabel={request.kind === 'book' ? 'Kembali ke buku' : 'Kembali ke Master Data'}
        autoFocus={copies.length > 0}
      />

      <div className="max-w-3xl px-4 py-5 print:hidden">
        <h1 className="page-title text-2xl font-semibold">Cetak Label Barcode</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-500)]">
          Pilih rentang barcode, atau buka Master Data → Buku → pilih judul → Cetak Label untuk seluruh eksemplar satu judul.
          Lembar label A4 berisi {LABELS_PER_SHEET} label (3 × 7, 63,5 × 38,1 mm).
        </p>
        <form className="mt-4 flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="mb-1 block text-[var(--color-ink-700)]">Dari barcode</span>
            <input name="dari" defaultValue={dari} autoFocus={copies.length === 0} autoComplete="off" className={CONTROL} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-[var(--color-ink-700)]">Sampai barcode</span>
            <input name="sampai" defaultValue={sampai} autoComplete="off" className={CONTROL} />
          </label>
          <button type="submit" className={buttonClass('secondary')}>Tampilkan</button>
        </form>
        {problem && <p role="alert" className={ALERT}>{problem}</p>}
        {truncated && <p role="alert" className={WARN}>{truncated}</p>}
        {unprintable.length > 0 && (
          <p role="alert" className={WARN}>
            {unprintable.length} barcode tidak dapat dicetak sebagai Code128: {unprintable.join(', ')}. Labelnya hanya
            berisi teks; ubah barcode tersebut di halaman buku agar dapat dipindai.
          </p>
        )}
        {copies.length > 0 && (
          <p role="status" className="mt-3 text-sm">
            {copies.length} label{subject} · {sheetsOf(copies.length)} lembar A4
          </p>
        )}
      </div>

      {copies.length > 0 && (
        <div className="mx-auto grid w-fit grid-cols-[repeat(3,63.5mm)] auto-rows-[38.1mm] print:mx-0">
          {copies.map((copy) => (
            <div
              key={copy.id}
              className="flex flex-col items-center justify-center overflow-hidden border border-dashed border-[var(--color-ink-100)] px-[3mm] text-center print:border-transparent [break-inside:avoid]"
            >
              <p className="w-full truncate text-[7pt]">{schoolName}</p>
              <p className="w-full truncate text-[8pt] font-semibold">{copy.bookTitle}</p>
              <Barcode value={copy.barcode} className="my-[1mm] h-[13mm] w-full" />
              <p className="font-mono text-[9pt] font-semibold">{copy.barcode}</p>
              {copy.rackCode && <p className="text-[7pt]">Rak {copy.rackCode}</p>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
```

Kotak putus-putus membantu melihat batas label di layar; `print:border-transparent` menyembunyikannya saat dicetak.

- [x] **Step 12: Jalankan uji dan pastikan lulus**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test -- "src/app/(cetak)/cetak/label-barcode"
```

Harapan: PASS, 7 uji. React me-render tanda kutip di teks sebagai `&quot;`; uji per judul sudah memperhitungkannya.

- [x] **Step 13: Tulis uji tombol Cetak Label dan menu yang gagal**

Tambahkan di akhir `describe('BookDetailPage')` di `src/app/(app)/master/buku/[id]/page.test.tsx`:

```tsx
  it('menawarkan cetak label untuk seluruh eksemplar judul ini', async () => {
    mockGetBook.mockResolvedValueOnce(book);
    mockRequireProfile.mockResolvedValueOnce({ role: 'petugas' });

    expect(await render()).toContain('href="/cetak/label-barcode?buku=b1"');
  });
```

Di `src/components/layout/sidebar.test.tsx`, tambahkan `'/cetak/label-barcode',` ke larik `COMMON` tepat setelah `'/master/rak',`.

- [x] **Step 14: Jalankan uji dan pastikan gagal**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test -- "src/app/(app)/master/buku/\[id\]" src/components/layout/sidebar.test.tsx
```

Harapan: FAIL pada kedua uji baru.

- [x] **Step 15: Tambahkan tombol dan menu**

Di `src/app/(app)/master/buku/[id]/page.tsx`, ganti prop `actions` pada `<PageHeader>` dengan:

```tsx
        actions={(
          <>
            <Link href={`/cetak/label-barcode?buku=${book.id}`} className={buttonClass('secondary')}>Cetak Label</Link>
            <Link href="/master/buku" className={buttonClass('secondary')}>Kembali ke daftar</Link>
          </>
        )}
```

Di `src/components/layout/sidebar.tsx`, tambahkan item terakhir di grup `'Master Data'`:

```ts
      { href: '/cetak/label-barcode', label: 'Label Barcode' },
```

- [x] **Step 16: Jalankan uji dan pastikan lulus, lalu commit**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test && npm run test:integration -- tests/integration/labels.test.ts && npm run lint && npx tsc --noEmit && npm run build
```

Harapan: seluruhnya lulus; `npm run build` mencantumkan `/cetak/label-barcode`.

```bash
git add src/lib/label-request.ts src/lib/label-request.test.ts src/server/queries/labels.ts tests/integration/labels.test.ts \
  "src/app/(cetak)/cetak/label-barcode" "src/app/(app)/master/buku/[id]/page.tsx" "src/app/(app)/master/buku/[id]/page.test.tsx" \
  src/components/layout/sidebar.tsx src/components/layout/sidebar.test.tsx
git commit -F - <<'EOF'
feat(cetak): label barcode Code128 A4 per judul atau per rentang

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

## Task 7: Tampilan Audit Log

Setiap perubahan data sudah menulis `audit_logs` sejak Rencana 02 (spec §3.1 aturan 4). Task ini membuatnya dapat dibaca admin (spec §7: "Lihat audit log — Admin ya, Petugas tidak"). Catatan audit tidak dapat diubah atau dihapus dari aplikasi. Halaman ini hanya membaca.

**Files:**
- Create: `src/lib/audit-labels.ts`, `src/lib/audit-labels.test.ts`
- Create: `src/server/queries/audit-logs.ts`
- Create: `tests/integration/audit-logs.test.ts`
- Create: `src/app/(app)/pengaturan/audit-log/page.tsx`, `page.test.tsx`
- Modify: `src/components/layout/sidebar.tsx`, `sidebar.test.tsx` (menu "Audit Log" di grup Pengaturan)

**Interfaces:**
- Consumes: `formatRupiah`, `formatDate` (`src/lib/format.ts`); `formatSchoolDateTime`, `SCHOOL_TIME_ZONE`; `containsPattern` (`src/server/queries/like.ts`); `PAGE_SIZE`, `offsetOf`, `parsePage`; `Option`; `AccessDenied`, `FilterBar`, `FilterSelect`, `PageHeader`, `Pagination`, `ScrollTable`, `TD`, `TH`; `testActor`, `withRollback`
- Produces:
  - `auditActionLabel(action: string): string` — label Indonesia, atau kode aksinya bila tidak dikenal
  - `type AuditKind = 'all' | 'transaksi' | 'koleksi' | 'siswa' | 'pengaturan'`, `AUDIT_KIND_OPTIONS: Option[]`, `AUDIT_KIND_ENTITIES: Record<Exclude<AuditKind, 'all'>, string[]>`, `parseAuditKind(value: string): AuditKind`
  - `parseDateFilter(value: string): IsoDate | null`
  - `auditEntityHref(entity: string, entityId: string | null): string | null`
  - `interface AuditSummary { subject: string | null; details: string[] }`, `summarizeAudit(action: string, metadata: unknown): AuditSummary`
  - `redactSecrets(metadata: unknown): unknown`
  - `interface AuditRow { id: string; createdAt: Date; action: string; entity: string; entityId: string | null; metadata: unknown; username: string | null; fullName: string | null }`
  - `listAuditLogs(filter: { q: string; kind: AuditKind; date: IsoDate | null; page: number }, executor?): Promise<{ rows: AuditRow[]; total: number }>`
  - Rute `/pengaturan/audit-log` (admin)

Aksi yang saat ini ditulis ke `audit_logs` (dari `src/server/services/*.ts`): `academic_year.{create,update,activate}`, `book.{create,update,activate,deactivate}`, `copy.{create,restore,deactivate,reactivate}`, `category.{create,update,activate,deactivate}`, `rack.{create,update,activate,deactivate}`, `student.{create,update,activate,deactivate}`, `loan.create`, `return.process`, `fine.pay`, `settings.update`, `user.{create,update,reset_password,activate,deactivate}`.

- [x] **Step 1: Tulis uji label dan ringkasan audit yang gagal**

Buat `src/lib/audit-labels.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  AUDIT_KIND_ENTITIES, auditActionLabel, auditEntityHref, parseAuditKind, parseDateFilter, redactSecrets, summarizeAudit,
} from './audit-labels';

describe('auditActionLabel', () => {
  it('menerjemahkan aksi yang dikenal dan menampilkan kode untuk yang tidak dikenal', () => {
    expect(auditActionLabel('loan.create')).toBe('Peminjaman dicatat');
    expect(auditActionLabel('return.process')).toBe('Pengembalian diproses');
    expect(auditActionLabel('fine.pay')).toBe('Pembayaran denda');
    expect(auditActionLabel('copy.restore')).toBe('Eksemplar dipulihkan');
    expect(auditActionLabel('user.reset_password')).toBe('Password pengguna direset');
    expect(auditActionLabel('report.export')).toBe('report.export');
    expect(auditActionLabel('constructor')).toBe('constructor');
  });
});

describe('parseAuditKind dan parseDateFilter', () => {
  it('menerima jenis yang dikenal saja', () => {
    expect(parseAuditKind('transaksi')).toBe('transaksi');
    expect(parseAuditKind('pengaturan')).toBe('pengaturan');
    expect(parseAuditKind('toString')).toBe('all');
    expect(parseAuditKind('')).toBe('all');
    expect(AUDIT_KIND_ENTITIES.koleksi).toEqual(['books', 'book_copies', 'categories', 'racks']);
  });

  it('menerima tanggal kalender yang sah saja', () => {
    expect(parseDateFilter('2026-09-25')).toBe('2026-09-25');
    expect(parseDateFilter('2026-02-30')).toBeNull();
    expect(parseDateFilter('25/09/2026')).toBeNull();
    expect(parseDateFilter('')).toBeNull();
  });
});

describe('auditEntityHref', () => {
  it('menautkan entitas yang punya halaman', () => {
    expect(auditEntityHref('loans', 'l1')).toBe('/transaksi/riwayat/l1');
    expect(auditEntityHref('books', 'b1')).toBe('/master/buku/b1');
    expect(auditEntityHref('students', 's1')).toBe('/master/siswa/s1');
    expect(auditEntityHref('profiles', 'u1')).toBe('/pengaturan/pengguna/u1');
    expect(auditEntityHref('library_settings', null)).toBe('/pengaturan/konfigurasi');
  });

  it('tidak menautkan eksemplar, entitas tak dikenal, atau id kosong', () => {
    expect(auditEntityHref('book_copies', 'c1')).toBeNull();
    expect(auditEntityHref('constructor', 'x')).toBeNull();
    expect(auditEntityHref('loans', null)).toBeNull();
  });
});

describe('summarizeAudit', () => {
  it('peminjaman: nomor transaksi, jumlah buku, NIS, dan jatuh tempo', () => {
    expect(summarizeAudit('loan.create', {
      transactionNumber: 'PJM-20260925-0001', studentNis: '202600123', barcodes: ['BK-000001', 'BK-000004'], dueDate: '2026-09-28',
    })).toEqual({
      subject: 'PJM-20260925-0001',
      details: ['2 buku: BK-000001, BK-000004', 'NIS 202600123', 'Jatuh tempo 28/09/2026'],
    });
  });

  it('pengembalian: kondisi yang tidak baik dan total denda', () => {
    expect(summarizeAudit('return.process', {
      transactionNumber: 'PJM-20260925-0001',
      items: [
        { barcode: 'BK-000001', condition: 'RUSAK', daysLate: 0, lateFine: 0, replacementFee: 60000 },
        { barcode: 'BK-000004', condition: 'BAIK', daysLate: 0, lateFine: 0, replacementFee: 0 },
      ],
      totalFine: 60000,
      status: 'SEBAGIAN_KEMBALI',
    })).toEqual({
      subject: 'PJM-20260925-0001',
      details: ['2 buku kembali', 'BK-000001 rusak', 'Total denda transaksi Rp60.000'],
    });
  });

  it('pembayaran denda: nominal dan sisa atau lunas', () => {
    expect(summarizeAudit('fine.pay', { transactionNumber: 'PJM-1', amount: 20000, remaining: 40000 }))
      .toEqual({ subject: 'PJM-1', details: ['Dibayar Rp20.000', 'Sisa tagihan Rp40.000'] });
    expect(summarizeAudit('fine.pay', { transactionNumber: 'PJM-1', amount: 40000, remaining: 0 }))
      .toEqual({ subject: 'PJM-1', details: ['Dibayar Rp40.000', 'Lunas'] });
  });

  it('perubahan data: subjek dari nilai baru dan daftar kolom yang berubah', () => {
    expect(summarizeAudit('book.update', {
      before: { title: 'Pemrograman Web', price: 85000, author: 'Budi' },
      after: { title: 'Pemrograman Web Lanjut', price: 90000, author: 'Budi' },
    })).toEqual({ subject: 'Pemrograman Web Lanjut', details: ['Diubah: judul, harga'] });

    expect(summarizeAudit('settings.update', {
      before: { finePerDay: 1000, schoolName: 'SMK' },
      after: { finePerDay: 1000, schoolName: 'SMK' },
    })).toEqual({ subject: null, details: ['Tidak ada kolom yang berubah'] });
  });

  it('perubahan status eksemplar dan eksemplar baru', () => {
    expect(summarizeAudit('copy.restore', { barcode: 'BK-000001', from: 'RUSAK', to: 'TERSEDIA' }))
      .toEqual({ subject: 'BK-000001', details: ['RUSAK → TERSEDIA'] });
    expect(summarizeAudit('copy.create', { barcodes: ['BK-000010', 'BK-000011', 'BK-000012'] }))
      .toEqual({ subject: 'BK-000010 s.d. BK-000012', details: ['3 eksemplar'] });
  });

  it('siswa, rak, dan pengguna: subjek dari nama, NIS, kode, atau username', () => {
    expect(summarizeAudit('student.create', { nis: '202600123', name: 'Ahmad Fauzi', className: 'XI RPL 1' }))
      .toEqual({ subject: 'Ahmad Fauzi (NIS 202600123)', details: [] });
    expect(summarizeAudit('rack.deactivate', { code: 'A-3' })).toEqual({ subject: 'Rak A-3', details: [] });
    expect(summarizeAudit('user.create', { username: 'qa_petugas', fullName: 'QA', role: 'petugas' }))
      .toEqual({ subject: 'qa_petugas', details: [] });
  });

  it('tidak pernah mengarang isi dari kolom rahasia dan tahan terhadap catatan kosong', () => {
    expect(summarizeAudit('user.reset_password', { username: 'budi', password: 'rahasia123' }))
      .toEqual({ subject: 'budi', details: [] });
    expect(summarizeAudit('loan.create', null)).toEqual({ subject: null, details: [] });
    expect(summarizeAudit('loan.create', 'teks')).toEqual({ subject: null, details: [] });
  });
});

describe('redactSecrets', () => {
  it('menyamarkan kolom rahasia di tingkat mana pun', () => {
    expect(redactSecrets({ username: 'budi', password: 'x', nested: { newPassword: 'y', token: 'z' }, list: [{ secret: 1 }] }))
      .toEqual({ username: 'budi', password: '••••', nested: { newPassword: '••••', token: '••••' }, list: [{ secret: '••••' }] });
    expect(redactSecrets(null)).toBeNull();
  });
});
```

- [x] **Step 2: Jalankan uji dan pastikan gagal**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test -- src/lib/audit-labels.test.ts
```

Harapan: FAIL dengan "Failed to resolve import './audit-labels'".

- [x] **Step 3: Tulis label dan ringkasan audit**

Buat `src/lib/audit-labels.ts`:

```ts
import type { IsoDate } from '@/domain/shared/date';
import { formatDate, formatRupiah } from './format';
import type { Option } from './options';

/** Map, bukan objek literal: kunci dari database seperti "constructor" tidak boleh cocok dengan properti prototipe. */
const ACTION_LABELS = new Map<string, string>([
  ['loan.create', 'Peminjaman dicatat'],
  ['return.process', 'Pengembalian diproses'],
  ['fine.pay', 'Pembayaran denda'],
  ['book.create', 'Buku ditambahkan'],
  ['book.update', 'Buku diubah'],
  ['book.activate', 'Buku diaktifkan'],
  ['book.deactivate', 'Buku dinonaktifkan'],
  ['copy.create', 'Eksemplar ditambahkan'],
  ['copy.restore', 'Eksemplar dipulihkan'],
  ['copy.deactivate', 'Eksemplar dinonaktifkan'],
  ['copy.reactivate', 'Eksemplar diaktifkan kembali'],
  ['category.create', 'Kategori ditambahkan'],
  ['category.update', 'Kategori diubah'],
  ['category.activate', 'Kategori diaktifkan'],
  ['category.deactivate', 'Kategori dinonaktifkan'],
  ['rack.create', 'Rak ditambahkan'],
  ['rack.update', 'Rak diubah'],
  ['rack.activate', 'Rak diaktifkan'],
  ['rack.deactivate', 'Rak dinonaktifkan'],
  ['student.create', 'Siswa ditambahkan'],
  ['student.update', 'Siswa diubah'],
  ['student.activate', 'Siswa diaktifkan'],
  ['student.deactivate', 'Siswa dinonaktifkan'],
  ['academic_year.create', 'Tahun ajaran ditambahkan'],
  ['academic_year.update', 'Tahun ajaran diubah'],
  ['academic_year.activate', 'Tahun ajaran diaktifkan'],
  ['settings.update', 'Konfigurasi diubah'],
  ['user.create', 'Pengguna ditambahkan'],
  ['user.update', 'Pengguna diubah'],
  ['user.reset_password', 'Password pengguna direset'],
  ['user.activate', 'Pengguna diaktifkan'],
  ['user.deactivate', 'Pengguna dinonaktifkan'],
]);

export function auditActionLabel(action: string): string {
  return ACTION_LABELS.get(action) ?? action;
}

export type AuditKind = 'all' | 'transaksi' | 'koleksi' | 'siswa' | 'pengaturan';

export const AUDIT_KIND_ENTITIES: Record<Exclude<AuditKind, 'all'>, string[]> = {
  transaksi: ['loans'],
  koleksi: ['books', 'book_copies', 'categories', 'racks'],
  siswa: ['students'],
  pengaturan: ['academic_years', 'library_settings', 'profiles'],
};

export const AUDIT_KIND_OPTIONS: Option[] = [
  { value: 'all', label: 'Semua jenis data' },
  { value: 'transaksi', label: 'Transaksi' },
  { value: 'koleksi', label: 'Buku, eksemplar, kategori, rak' },
  { value: 'siswa', label: 'Siswa' },
  { value: 'pengaturan', label: 'Pengaturan dan pengguna' },
];

export function parseAuditKind(value: string): AuditKind {
  const match = AUDIT_KIND_OPTIONS.find((option) => option.value === value);
  return match ? (match.value as AuditKind) : 'all';
}

/** `'2026-02-30'` ditolak: tanggal harus ada di kalender, bukan hanya berpola benar. */
export function parseDateFilter(value: string): IsoDate | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}

const ENTITY_PATHS = new Map<string, string>([
  ['loans', '/transaksi/riwayat/'],
  ['books', '/master/buku/'],
  ['students', '/master/siswa/'],
  ['categories', '/master/kategori/'],
  ['racks', '/master/rak/'],
  ['academic_years', '/pengaturan/tahun-ajaran/'],
  ['profiles', '/pengaturan/pengguna/'],
]);

/** `book_copies` tidak punya halaman sendiri; barcode-nya tampil di ringkasan. */
export function auditEntityHref(entity: string, entityId: string | null): string | null {
  if (entity === 'library_settings') return '/pengaturan/konfigurasi';
  const base = ENTITY_PATHS.get(entity);
  return base && entityId ? `${base}${entityId}` : null;
}

const FIELD_LABELS = new Map<string, string>([
  ['name', 'nama'],
  ['title', 'judul'],
  ['author', 'penulis'],
  ['publisher', 'penerbit'],
  ['publishYear', 'tahun terbit'],
  ['isbn', 'ISBN'],
  ['price', 'harga'],
  ['description', 'deskripsi'],
  ['categoryId', 'kategori'],
  ['rackId', 'rak'],
  ['code', 'kode'],
  ['location', 'lokasi'],
  ['nis', 'NIS'],
  ['className', 'kelas'],
  ['gender', 'jenis kelamin'],
  ['phone', 'telepon'],
  ['fullName', 'nama lengkap'],
  ['role', 'peran'],
  ['status', 'status'],
  ['startDate', 'tanggal mulai'],
  ['endDate', 'tanggal selesai'],
  ['maxActiveLoans', 'batas pinjam'],
  ['loanDurationDays', 'durasi pinjam'],
  ['finePerDay', 'denda per hari'],
  ['blockWhenOverdue', 'blokir keterlambatan'],
  ['blockWhenUnpaidFine', 'blokir tunggakan'],
  ['schoolName', 'nama sekolah'],
  ['receiptFooter', 'catatan kaki struk'],
]);

const SECRET_KEY = /password|secret|token/i;
const REDACTED = '••••';

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function amount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/** Subjek catatan: hal yang paling mungkin dicari admin. Hanya dari kolom yang dikenal. */
function subjectOf(record: Json): string | null {
  const barcodes = strings(record.barcodes);
  const name = text(record.name);
  const nis = text(record.nis);
  return text(record.transactionNumber)
    ?? text(record.barcode)
    ?? (barcodes.length > 1 && !text(record.dueDate) ? `${barcodes[0]} s.d. ${barcodes.at(-1)}` : null)
    ?? (barcodes.length === 1 && !text(record.dueDate) ? barcodes[0] : null)
    ?? text(record.username)
    ?? text(record.title)
    ?? (name && nis ? `${name} (NIS ${nis})` : name)
    ?? (nis ? `NIS ${nis}` : null)
    ?? (text(record.code) ? `Rak ${text(record.code)}` : null);
}

function changedFields(before: Json, after: Json): string[] {
  return Object.keys(after)
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map((key) => FIELD_LABELS.get(key) ?? key);
}

export interface AuditSummary {
  subject: string | null;
  details: string[];
}

/**
 * Ringkasan satu baris audit untuk tabel. Hanya kolom yang dikenal yang
 * dibaca, sehingga kolom rahasia tidak pernah muncul di ringkasan (password
 * memang tidak pernah diaudit; lihat `secretFields` di run-action.ts).
 */
export function summarizeAudit(action: string, metadata: unknown): AuditSummary {
  if (!isRecord(metadata)) return { subject: null, details: [] };

  const details: string[] = [];
  const before = metadata.before;
  const after = metadata.after;
  let subject = subjectOf(metadata);

  if (isRecord(after)) {
    subject = subject ?? subjectOf(after);
    if (isRecord(before)) {
      const changed = changedFields(before, after);
      details.push(changed.length > 0 ? `Diubah: ${changed.join(', ')}` : 'Tidak ada kolom yang berubah');
    }
  }

  const barcodes = strings(metadata.barcodes);
  if (action === 'loan.create' && barcodes.length > 0) details.push(`${barcodes.length} buku: ${barcodes.join(', ')}`);
  if (action === 'copy.create' && barcodes.length > 0) details.push(`${barcodes.length} eksemplar`);
  if (text(metadata.studentNis)) details.push(`NIS ${text(metadata.studentNis)}`);
  if (text(metadata.dueDate)) details.push(`Jatuh tempo ${formatDate(text(metadata.dueDate))}`);

  if (text(metadata.from) && text(metadata.to)) details.push(`${text(metadata.from)} → ${text(metadata.to)}`);

  if (Array.isArray(metadata.items)) {
    const items = metadata.items.filter(isRecord);
    details.push(`${items.length} buku kembali`);
    for (const item of items) {
      const condition = text(item.condition);
      if (condition && condition !== 'BAIK') details.push(`${text(item.barcode) ?? 'Eksemplar'} ${condition.toLowerCase()}`);
    }
  }
  const totalFine = amount(metadata.totalFine);
  if (totalFine !== null && totalFine > 0) details.push(`Total denda transaksi ${formatRupiah(totalFine)}`);

  const paid = amount(metadata.amount);
  if (paid !== null) details.push(`Dibayar ${formatRupiah(paid)}`);
  const remaining = amount(metadata.remaining);
  if (remaining !== null) details.push(remaining > 0 ? `Sisa tagihan ${formatRupiah(remaining)}` : 'Lunas');

  return { subject, details };
}

/** Untuk tampilan "isi lengkap": kolom yang namanya tampak rahasia disamarkan di tingkat mana pun. */
export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, inner]) => [key, SECRET_KEY.test(key) ? REDACTED : redactSecrets(inner)]),
  );
}
```

Catatan untuk pelaksana: `subjectOf` membedakan `barcodes` milik `loan.create` (yang juga berisi `dueDate`) dari `copy.create`. Untuk peminjaman, subjeknya nomor transaksi dan barcode masuk ke rincian.

- [x] **Step 4: Jalankan uji dan pastikan lulus**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test -- src/lib/audit-labels.test.ts
```

Harapan: PASS. Bila urutan `details` berbeda dari uji, sesuaikan **urutan penambahan di kode**, bukan ujinya. Urutannya disengaja: apa yang terjadi, lalu siapa atau kapan, lalu uangnya.

- [x] **Step 5: Tulis uji integrasi query audit yang gagal**

Buat `tests/integration/audit-logs.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { Transaction } from '@/server/db/executor';
import { auditLogs, profiles } from '@/server/db/schema';
import { listAuditLogs } from '@/server/queries/audit-logs';
import { testActor, withRollback } from './helpers';

/** Catatan uji bertanggal 2090 dan bertanda UJI-AUD: tidak ada data sungguhan yang cocok. */
async function seedAudit(tx: Transaction) {
  const actor = await testActor(tx);
  const [profile] = await tx.select({ username: profiles.username }).from(profiles).where(eq(profiles.id, actor.id));
  await tx.insert(auditLogs).values([
    {
      userId: actor.id, action: 'loan.create', entity: 'loans', entityId: crypto.randomUUID(),
      metadata: { transactionNumber: 'UJI-AUD-0001' }, createdAt: new Date('2090-03-01T17:30:00Z'),
    },
    {
      userId: actor.id, action: 'book.update', entity: 'books', entityId: crypto.randomUUID(),
      metadata: { before: { title: 'UJI-AUD Buku' }, after: { title: 'UJI-AUD Buku Baru' } },
      createdAt: new Date('2090-03-02T02:00:00Z'),
    },
    {
      userId: actor.id, action: 'student.create', entity: 'students', entityId: crypto.randomUUID(),
      metadata: { nis: 'UJI-AUD-S1', name: 'UJI Siswa Audit' }, createdAt: new Date('2090-03-01T16:59:00Z'),
    },
  ]);
  return { actor, username: profile?.username ?? '' };
}

const base = { q: '', kind: 'all' as const, date: null, page: 1 };

describe('listAuditLogs', () => {
  it('mencari di isi catatan, terbaru lebih dulu, beserta pelakunya', async () => {
    await withRollback(async (tx) => {
      const { username } = await seedAudit(tx);

      const { rows, total } = await listAuditLogs({ ...base, q: 'uji-aud' }, tx);

      expect(total).toBe(3);
      expect(rows.map((row) => row.action)).toEqual(['book.update', 'loan.create', 'student.create']);
      expect(rows[0]).toMatchObject({ entity: 'books', username });
      expect(rows[0].createdAt).toBeInstanceOf(Date);
      expect(rows[1].metadata).toEqual({ transactionNumber: 'UJI-AUD-0001' });
    });
  });

  it('menyaring menurut jenis data', async () => {
    await withRollback(async (tx) => {
      await seedAudit(tx);

      const { rows } = await listAuditLogs({ ...base, q: 'UJI-AUD', kind: 'transaksi' }, tx);

      expect(rows.map((row) => row.action)).toEqual(['loan.create']);
    });
  });

  it('menyaring menurut tanggal WIB, bukan tanggal UTC', async () => {
    await withRollback(async (tx) => {
      await seedAudit(tx);

      // 2090-03-01T17:30Z = 02/03 00.30 WIB (masuk); 2090-03-02T02:00Z = 02/03 09.00 WIB (masuk);
      // 2090-03-01T16:59Z = 01/03 23.59 WIB (tidak).
      const { rows, total } = await listAuditLogs({ ...base, date: '2090-03-02' }, tx);

      expect(total).toBe(2);
      expect(rows.map((row) => row.action)).toEqual(['book.update', 'loan.create']);
    });
  });

  it('mencari menurut username pelaku', async () => {
    await withRollback(async (tx) => {
      const { username } = await seedAudit(tx);

      const { total } = await listAuditLogs({ ...base, q: username, date: '2090-03-02' }, tx);

      expect(total).toBe(2);
    });
  });
});
```

- [x] **Step 6: Jalankan uji dan pastikan gagal**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm run test:integration -- tests/integration/audit-logs.test.ts
```

Harapan: FAIL dengan "Failed to resolve import '@/server/queries/audit-logs'".

- [x] **Step 7: Tulis query audit log**

Buat `src/server/queries/audit-logs.ts`:

```ts
import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import type { IsoDate } from '@/domain/shared/date';
import { AUDIT_KIND_ENTITIES, type AuditKind } from '@/lib/audit-labels';
import { offsetOf, PAGE_SIZE } from '@/lib/pagination';
import { SCHOOL_TIME_ZONE } from '@/lib/school-date';
import { db } from '@/server/db/client';
import type { Executor } from '@/server/db/executor';
import { auditLogs, profiles } from '@/server/db/schema';
import { containsPattern } from './like';

export interface AuditRow {
  id: string;
  createdAt: Date;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: unknown;
  /** null bila pelakunya sudah tidak ada atau catatan dibuat sistem. */
  username: string | null;
  fullName: string | null;
}

export interface AuditFilter {
  q: string;
  kind: AuditKind;
  /** Tanggal sekolah (WIB) saat catatan dibuat. */
  date: IsoDate | null;
  page: number;
}

/**
 * Kata kunci dicari di isi catatan (`metadata::text`: nomor transaksi,
 * barcode, NIS, judul) dan di username pelaku.
 */
export async function listAuditLogs(
  filter: AuditFilter,
  executor: Executor = db,
): Promise<{ rows: AuditRow[]; total: number }> {
  const keyword = filter.q.trim();
  const where = and(
    filter.kind === 'all' ? undefined : inArray(auditLogs.entity, AUDIT_KIND_ENTITIES[filter.kind]),
    filter.date
      ? sql`(${auditLogs.createdAt} at time zone ${SCHOOL_TIME_ZONE})::date = ${filter.date}::date`
      : undefined,
    keyword
      ? or(
          ilike(sql`${auditLogs.metadata}::text`, containsPattern(keyword)),
          ilike(profiles.username, containsPattern(keyword)),
        )
      : undefined,
  );

  const rows = await executor
    .select({
      id: auditLogs.id,
      createdAt: auditLogs.createdAt,
      action: auditLogs.action,
      entity: auditLogs.entity,
      entityId: auditLogs.entityId,
      metadata: auditLogs.metadata,
      username: profiles.username,
      fullName: profiles.fullName,
    })
    .from(auditLogs)
    .leftJoin(profiles, eq(profiles.id, auditLogs.userId))
    .where(where)
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(PAGE_SIZE)
    .offset(offsetOf(filter.page));

  const [{ total }] = await executor
    .select({ total: sql<number>`count(*)::int` })
    .from(auditLogs)
    .leftJoin(profiles, eq(profiles.id, auditLogs.userId))
    .where(where);

  return { rows, total: Number(total) };
}
```

- [x] **Step 8: Jalankan uji dan pastikan lulus**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm run test:integration -- tests/integration/audit-logs.test.ts
```

Harapan: PASS, 4 uji.

- [x] **Step 9: Tulis uji halaman audit log yang gagal**

Buat `src/app/(app)/pengaturan/audit-log/page.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockList, mockRequireProfile } = vi.hoisted(() => ({ mockList: vi.fn(), mockRequireProfile: vi.fn() }));

vi.mock('@/server/queries/audit-logs', () => ({ listAuditLogs: mockList }));
vi.mock('@/server/auth/guard', () => ({ requireProfile: mockRequireProfile }));
vi.mock('@/lib/school-date', () => ({ formatSchoolDateTime: () => '25/09/2026 14.03' }));

import AuditLogPage from './page';

const row = {
  id: 'a1',
  createdAt: new Date('2026-09-25T07:03:00Z'),
  action: 'fine.pay',
  entity: 'loans',
  entityId: 'l1',
  metadata: { transactionNumber: 'PJM-20260925-0001', amount: 20000, remaining: 40000 },
  username: 'petugas',
  fullName: 'Siti Petugas',
};

async function render(params: Record<string, string> = {}) {
  return renderToStaticMarkup(await AuditLogPage({ searchParams: Promise.resolve(params) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireProfile.mockResolvedValue({ id: 'u1', role: 'admin', fullName: 'Admin', status: 'active' });
  mockList.mockResolvedValue({ rows: [row], total: 1 });
});

describe('AuditLogPage', () => {
  it('menolak petugas tanpa membaca audit log', async () => {
    mockRequireProfile.mockResolvedValueOnce({ id: 'u2', role: 'petugas', fullName: 'Petugas', status: 'active' });

    const html = await render();

    expect(html).toContain('Akses ditolak');
    expect(mockList).not.toHaveBeenCalled();
  });

  it('menampilkan waktu, pelaku, aksi, tautan data, dan ringkasan', async () => {
    const html = await render({ q: 'PJM-20260925-0001', jenis: 'transaksi', tanggal: '2026-09-25', hal: '2' });

    expect(mockList).toHaveBeenCalledWith({ q: 'PJM-20260925-0001', kind: 'transaksi', date: '2026-09-25', page: 2 });
    expect(html).toContain('25/09/2026 14.03');
    expect(html).toContain('Siti Petugas');
    expect(html).toContain('petugas');
    expect(html).toContain('Pembayaran denda');
    expect(html).toContain('fine.pay');
    expect(html).toContain('href="/transaksi/riwayat/l1"');
    expect(html).toContain('Dibayar Rp20.000');
    expect(html).toContain('Sisa tagihan Rp40.000');
    expect(html).toContain('Lihat isi lengkap');
  });

  it('mengabaikan tanggal yang tidak sah dengan pemberitahuan', async () => {
    const html = await render({ tanggal: '2026-02-30' });

    expect(mockList).toHaveBeenCalledWith({ q: '', kind: 'all', date: null, page: 1 });
    expect(html).toContain('Tanggal 2026-02-30 tidak valid; filter tanggal diabaikan.');
  });

  it('menampilkan pesan kosong dan pelaku sistem', async () => {
    mockList.mockResolvedValueOnce({ rows: [{ ...row, username: null, fullName: null, entityId: null }], total: 1 });
    const html = await render();
    expect(html).toContain('Sistem');

    mockList.mockResolvedValueOnce({ rows: [], total: 0 });
    expect(await render()).toContain('Belum ada catatan yang cocok.');
  });

  it('menyamarkan kolom rahasia di isi lengkap', async () => {
    mockList.mockResolvedValueOnce({
      rows: [{ ...row, action: 'user.reset_password', entity: 'profiles', metadata: { username: 'budi', password: 'rahasia123' } }],
      total: 1,
    });

    const html = await render();

    expect(html).not.toContain('rahasia123');
    expect(html).toContain('••••');
  });
});
```

- [x] **Step 10: Jalankan uji dan pastikan gagal**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test -- "src/app/(app)/pengaturan/audit-log"
```

Harapan: FAIL dengan "Failed to resolve import './page'".

- [x] **Step 11: Tulis halaman audit log**

Buat `src/app/(app)/pengaturan/audit-log/page.tsx`:

```tsx
import Link from 'next/link';
import { AccessDenied } from '@/components/ui/access-denied';
import { FilterBar, FilterSelect } from '@/components/ui/filter-bar';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { ScrollTable } from '@/components/ui/scroll-table';
import { TD, TH } from '@/components/ui/table-styles';
import {
  AUDIT_KIND_OPTIONS, auditActionLabel, auditEntityHref, parseAuditKind, parseDateFilter, redactSecrets, summarizeAudit,
} from '@/lib/audit-labels';
import { parsePage } from '@/lib/pagination';
import { formatSchoolDateTime } from '@/lib/school-date';
import { firstValue, type SearchParams } from '@/lib/search-params';
import { requireProfile } from '@/server/auth/guard';
import { listAuditLogs, type AuditRow } from '@/server/queries/audit-logs';

const CONTROL = 'rounded-md border border-[var(--color-ink-300)] bg-white px-3 py-2 text-sm';

function Subject({ row }: { row: AuditRow }) {
  const { subject } = summarizeAudit(row.action, row.metadata);
  const href = auditEntityHref(row.entity, row.entityId);
  const label = subject ?? (href ? 'Buka data' : '—');
  return href ? (
    <Link href={href} className="text-[var(--color-accent-600)] hover:underline">{label}</Link>
  ) : (
    <span>{label}</span>
  );
}

export default async function AuditLogPage({ searchParams }: { searchParams: SearchParams }) {
  const profile = await requireProfile();
  if (profile.role !== 'admin') return <AccessDenied />;

  const params = await searchParams;
  const q = firstValue(params.q);
  const kind = parseAuditKind(firstValue(params.jenis));
  const dateText = firstValue(params.tanggal);
  const date = parseDateFilter(dateText);
  const page = parsePage(firstValue(params.hal));
  const { rows, total } = await listAuditLogs({ q, kind, date, page });

  return (
    <>
      <PageHeader
        title="Audit Log"
        description="Jejak setiap perubahan data: siapa, kapan, dan apa. Catatan ini tidak dapat diubah atau dihapus."
      />
      <FilterBar q={q} placeholder="Cari no. transaksi, barcode, NIS, judul, atau username">
        <FilterSelect name="jenis" label="Jenis data" value={kind} options={AUDIT_KIND_OPTIONS} />
        <input type="date" name="tanggal" defaultValue={date ?? ''} aria-label="Tanggal" className={CONTROL} />
      </FilterBar>
      {dateText && !date && (
        <p role="alert" className="mb-4 text-sm text-[var(--color-status-terlambat)]">
          Tanggal {dateText} tidak valid; filter tanggal diabaikan.
        </p>
      )}

      <ScrollTable>
        <thead>
          <tr>
            <th className={TH}>Waktu</th>
            <th className={TH}>Pengguna</th>
            <th className={TH}>Aksi</th>
            <th className={TH}>Data</th>
            <th className={TH}>Keterangan</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className={`${TD} text-center text-[var(--color-ink-500)]`}>Belum ada catatan yang cocok.</td>
            </tr>
          )}
          {rows.map((row) => {
            const { details } = summarizeAudit(row.action, row.metadata);
            return (
              <tr key={row.id} className="align-top">
                <td className={`${TD} whitespace-nowrap`}>{formatSchoolDateTime(row.createdAt)}</td>
                <td className={TD}>
                  {row.fullName ?? 'Sistem'}
                  {row.username && <span className="block font-mono text-xs text-[var(--color-ink-500)]">{row.username}</span>}
                </td>
                <td className={TD}>
                  {auditActionLabel(row.action)}
                  <span className="block font-mono text-xs text-[var(--color-ink-500)]">{row.action}</span>
                </td>
                <td className={TD}><Subject row={row} /></td>
                <td className={TD}>
                  {details.length > 0 && (
                    <ul className="space-y-0.5">
                      {details.map((detail) => <li key={detail}>{detail}</li>)}
                    </ul>
                  )}
                  {row.metadata !== null && (
                    <details className="mt-1 text-xs">
                      <summary className="cursor-pointer text-[var(--color-ink-500)]">Lihat isi lengkap</summary>
                      <pre className="mt-1 max-w-md overflow-x-auto whitespace-pre-wrap rounded bg-[var(--color-ink-50)] p-2">
                        {JSON.stringify(redactSecrets(row.metadata), null, 2)}
                      </pre>
                    </details>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </ScrollTable>

      <Pagination path="/pengaturan/audit-log" page={page} total={total} query={{ q, jenis: kind, tanggal: date ?? '' }} />
    </>
  );
}
```

- [x] **Step 12: Jalankan uji dan pastikan lulus**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test -- "src/app/(app)/pengaturan/audit-log" src/lib/audit-labels.test.ts
```

Harapan: PASS.

- [x] **Step 13: Tambahkan menu Audit Log**

Di `src/components/layout/sidebar.test.tsx`, tambahkan `'/pengaturan/audit-log'` di akhir larik `ADMIN_ONLY`. Jalankan `npm test -- src/components/layout/sidebar.test.tsx`; harapan FAIL. Lalu di `src/components/layout/sidebar.tsx`, tambahkan item terakhir di grup `'Pengaturan'`:

```ts
      { href: '/pengaturan/audit-log', label: 'Audit Log' },
```

Jalankan ulang; harapan PASS.

- [x] **Step 14: Jalankan seluruh pemeriksaan lalu commit**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test && npm run test:integration -- tests/integration/audit-logs.test.ts && npm run lint && npx tsc --noEmit && npm run build
```

Harapan: seluruhnya lulus; `npm run build` mencantumkan `/pengaturan/audit-log`.

```bash
git add src/lib/audit-labels.ts src/lib/audit-labels.test.ts src/server/queries/audit-logs.ts tests/integration/audit-logs.test.ts \
  "src/app/(app)/pengaturan/audit-log" src/components/layout/sidebar.tsx src/components/layout/sidebar.test.tsx
git commit -F - <<'EOF'
feat(audit): tampilan audit log untuk admin dengan filter jenis, tanggal, dan kata kunci

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

## Task 8: Verifikasi Akhir

Tidak ada kode baru. Task ini membuktikan dashboard, cetak, dan audit log bekerja bersama, di mesin dan di peramban. Pemeriksaan peramban menulis satu peminjaman dan pengembaliannya ke database cloud (Step 3 bagian D), lalu merapikannya kembali.

**Files:**
- Tidak ada berkas yang dibuat, selain pencentangan rencana di Step 6.

**Interfaces:**
- Consumes: seluruh keluaran Task 1–7
- Produces: bukti bahwa Rencana 05 selesai

- [x] **Step 1: Jalankan seluruh pemeriksaan otomatis**

```bash
export PATH="/d/nvm/nodejs:$PATH"
npm test
npm run test:integration
npm run lint
npx tsc --noEmit
npm run build
```

Harapan: seluruhnya lulus. `npm run build` mencantumkan `/dashboard`, `/cetak/struk/[id]`, `/cetak/label-barcode`, dan `/pengaturan/audit-log`.

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
    + (select count(*) from students where nis like 'UJI-%')
    + (select count(*) from book_copies where barcode like 'UJI-%')
    + (select count(*) from academic_years where name like 'UJI-%')
    + (select count(*) from audit_logs where created_at >= '2090-01-01' or metadata::text like '%UJI-AUD%') as sisa
  `);
  console.log('Sisa data uji:', row?.sisa);
  process.exit(0);
}
main();
EOF
export PATH="/d/nvm/nodejs:$PATH"; npx tsx --env-file=.env.local tmp-sisa.ts
rm tmp-sisa.ts
```

Harapan: `Sisa data uji: 0`. Angka lain berarti ada uji yang ditulis di luar `withRollback()`. Temukan ujinya dan perbaiki; jangan menghapus datanya tanpa memahami asalnya.

- [x] **Step 3: Uji di peramban**

Jalankan `npm run dev`. Bila memakai agen, gunakan skill `/browse` dari gstack. **Jangan** memakai `mcp__claude-in-chrome__*`.

**A. Dashboard** (masuk sebagai **petugas** / `perpus123`):
1. `/` mengarah ke `/dashboard`. Enam kartu tampil, dengan tanggal hari ini (WIB) di deskripsi.
2. Cocokkan angkanya dengan database lewat berkas `tmp-angka.ts` sekali pakai. Kueri harus **hanya membaca** dan mengikuti definisi di tabel "Keputusan desain", lalu berkasnya dihapus. Angka yang cocok: Total Buku, Buku Tersedia, Sedang Dipinjam, Terlambat.
3. Klik "Terlambat" → `/transaksi/riwayat?status=overdue`. Klik "Sedang Dipinjam" → filter "Masih dipinjam".
4. "Transaksi Terbaru" menampilkan paling banyak 8 baris, terbaru di atas. "Jatuh Tempo Hari Ini" berisi daftar atau pesan "Tidak ada pinjaman yang jatuh tempo hari ini."

**B. Struk** (masih petugas):
5. Buka `/transaksi/riwayat`, pilih transaksi `PJM-20260925-0001` (riwayat QA Rencana 04) → tombol "Cetak Struk" → `/cetak/struk/<id>`. Halaman tanpa sidebar. Tombol "Cetak" terfokus. Struk memuat nama sekolah, nomor transaksi, siswa, NIS, kelas, tanggal pinjam dan jatuh tempo, kedua buku beserta barcode, petugas, barcode nomor transaksi, dan catatan kaki.
6. Klik "80 mm" → struk melebar, URL `?lebar=80`. Klik "58 mm" → kembali.
7. Periksa gaya cetak: `$B js "[...document.querySelectorAll('style')].map(s => s.textContent).find(t => t.includes('@page'))"` mengembalikan `@page { size: 58mm …mm; margin: 0; }`. Ambil tangkapan layar struk.

**C. Label** (masih petugas):
8. Sidebar Master Data → "Label Barcode" → `/cetak/label-barcode`. Petunjuk dan form tampil; kolom "Dari barcode" terfokus.
9. Isi `BK-000006` sampai `BK-000001` → pesan "Rentang terbalik: BK-000006 berada setelah BK-000001. …".
10. Isi `bk-000001` sampai `BK-000006` → "6 label · 1 lembar A4" (sesuaikan bila jumlah eksemplar aktif berbeda), kisi 3 kolom, setiap label memuat nama sekolah, judul, barcode, teks barcode, dan rak.
11. Master Data → Buku → "Pemrograman Web" → "Cetak Label" → label untuk judul itu saja; tombol kembali mengarah ke halaman buku.
12. Tangkapan layar lembar label.

**D. Konfirmasi peminjaman** (masih petugas):
13. Master Data → Siswa: aktifkan kembali `QA-001` (dinonaktifkan di akhir Rencana 04).
14. `/transaksi/peminjaman`: pilih `QA-001`, pindai `BK-000003`, `Ctrl+Enter`. Panel "Peminjaman tersimpan" memuat tombol "Cetak Struk" yang membuka struk transaksi ini di tab baru.
15. `/transaksi/pengembalian`: pindai `BK-000003`, simpan dengan kondisi Baik. Pesannya "Pengembalian tersimpan. Tidak ada denda baru."
16. Dashboard: "Peminjaman Hari Ini" dan "Pengembalian Hari Ini" masing-masing bertambah 1 dibanding sebelum langkah 14.

**E. Audit log:**
17. Sebagai **petugas**, buka `/pengaturan/audit-log` lewat URL → panel "Akses ditolak". Menu "Audit Log" tidak tampil di sidebar petugas.
18. Masuk sebagai **admin** / `perpus123` → Pengaturan → "Audit Log". Baris terbaru adalah pengembalian (langkah 15), peminjaman (langkah 14), dan pengaktifan QA-001 (langkah 13), dengan pelaku "petugas".
19. Cari `PJM-20260925-0001` → catatan `loan.create`, `return.process`, dan `fine.pay` dari QA Rencana 04, dengan ringkasan (misalnya "BK-000001 rusak", "Dibayar Rp20.000", "Sisa tagihan Rp40.000"). Tautan data membuka detail transaksinya.
20. Jenis "Transaksi" + tanggal hari ini → hanya catatan transaksi hari ini. Buka "Lihat isi lengkap" pada satu baris → JSON catatannya.
21. Cari `BK-000001` → termasuk `copy.restore` dari pembersihan Rencana 04 ("RUSAK → TERSEDIA").

**F. Tablet** (`$B viewport 768x1024`):
22. Kartu dashboard dua kolom; "Jatuh Tempo Hari Ini" di atas "Transaksi Terbaru"; tabel audit log digulir di dalam kotaknya; halaman tidak melebar.

Keseluruhan alur (A–E) dapat diselesaikan dengan papan ketik: Tab, Enter, dan `Ctrl+Enter`.

- [x] **Step 4: Bereskan data pemeriksaan**

Transaksi dari langkah 14–15 tetap tersimpan sebagai riwayat (BR-08). Rapikan keadaannya:
1. Pastikan `BK-000003` berstatus "Tersedia".
2. Nonaktifkan kembali siswa `QA-001`.
3. Periksa dengan kueri baca-saja: `BK-000001` s.d. `BK-000006` seluruhnya `TERSEDIA`, dan `QA-001`/`QA-002` berstatus `inactive`.

- [x] **Step 5: Catat hasilnya**

Laporkan setiap langkah Step 3 dengan LULUS/GAGAL beserta buktinya, jalur tangkapan layar struk dan label, serta angka dashboard yang dicocokkan. Pengujian dengan printer thermal dan pemindai USB sungguhan dilakukan pemilik produk. Catat di laporan bahwa langkah itu belum dilakukan.

- [x] **Step 6: Tandai rencana selesai**

Ubah seluruh `- [ ]` di berkas rencana ini menjadi `- [x]`, lalu commit:

```bash
git add docs/superpowers/plans/2026-09-25-perpustakaan-05-dashboard-cetak-audit.md
git commit -F - <<'EOF'
docs: tandai Rencana 05 (Dashboard, Cetak, Audit Log) selesai

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

## Hasil Akhir Rencana 05

- Dashboard menampilkan keadaan hari ini dalam enam angka yang masing-masing tertaut ke rinciannya, ditambah daftar jatuh tempo hari ini dan transaksi terbaru. Seluruh "hari ini" mengikuti tanggal WIB.
- Struk peminjaman thermal 58/80 mm dapat dicetak dari konfirmasi peminjaman dan dari detail transaksi. Barcode nomor transaksinya dapat dipindai di layar pengembalian.
- Label barcode Code128 dicetak di lembar A4 3 × 7, per judul atau per rentang, tanpa dependensi baru.
- Admin dapat menelusuri audit log menurut jenis data, tanggal, dan kata kunci. Petugas tidak dapat membukanya.
- Galat database tak terduga saat menyimpan peminjaman atau pengembalian menghasilkan pesan yang dapat ditindaklanjuti, dan meja peminjaman tidak kehilangan daftar bukunya.

## Yang Sengaja Belum Ada

| Hal | Ditangani di / Alasan |
|---|---|
| Laporan peminjaman, pengembalian, keterlambatan, koleksi | Rencana 06 |
| Cari eksemplar menurut judul di meja peminjaman (spec 8.2 "cari judul") | Rencana 06 atau sesudahnya; kini tersedia label barcode untuk buku yang labelnya rusak |
| Pesan `COPY_NOT_FOUND`/`COPY_RACE` yang menyebut barcode | Jarang terjadi (eksemplar terhapus di antara pindai dan simpan); butuh peta id→barcode dari klien |
| Tanggal pinjam/jatuh tempo di meja peminjaman yang tertinggal bila tab dibiarkan terbuka semalam | Server tetap menyimpan tanggal yang benar dan konfirmasi menampilkan jatuh tempo sebenarnya |
| Cetak otomatis saat struk dibuka | Tombol Cetak terfokus sudah cukup satu Enter; cetak otomatis mengganggu bila struk hanya ingin dilihat |
| Melewati label pertama pada lembar yang sudah terpakai sebagian | Belum diminta; dapat ditambah sebagai parameter `?lewati=` |

## Verifikasi Sebelum Melanjutkan ke Rencana 06

```bash
npm test                   # seluruh uji unit lulus
npm run test:integration   # seluruh uji integrasi lulus
npm run lint               # bersih
npm run build              # sukses
```

Dan secara manual oleh pemilik produk: cetak satu struk di printer thermal sekolah dan satu lembar label di printer laser, lalu pindai barcode keduanya dengan pemindai USB ke layar pengembalian dan meja peminjaman.
