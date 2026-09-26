# Perpustakaan — Rencana 06: Laporan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Empat laporan di menu Laporan — Peminjaman, Pengembalian, Keterlambatan, dan Koleksi Buku — dapat dilihat di layar, disaring, dan dicetak rapi lewat peramban.

**Architecture:**
- Setiap laporan adalah satu halaman di `src/app/(app)/laporan/<nama>/page.tsx`. Halamannya memanggil `requireProfile()` sendiri, membaca filter dari URL, lalu memanggil satu fungsi query di `src/server/queries/reports.ts`.
- Setiap query mengembalikan baris (maks. 1.000) beserta ringkasan. Ringkasan dihitung di database atas seluruh data yang cocok, bukan hanya baris yang tampil.
- Cetak memakai `window.print()` langsung dari halaman yang sama. Kerangka aplikasi (sidebar, topbar, form filter) disembunyikan saat mencetak lewat varian Tailwind `print:`, dan laporan mendapat kop cetak (nama sekolah, judul, periode, waktu cetak) serta `@page` A4 mendatar.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS 4 · Drizzle ORM 0.45 · Supabase Postgres · Vitest 5

**Spec:** `docs/superpowers/specs/2026-09-21-sistem-peminjaman-perpustakaan-design.md` — §2.2 (revisi 25 September 2026: Laporan masuk lingkup, "tampilan web dan cetak melalui peramban", ekspor PDF/Excel tetap di luar lingkup), §4.2 (`loans.student_class` adalah snapshot kelas; keterlambatan dihitung saat dibaca), §7 (satu peran), §8.1, §13
**Rencana sebelumnya:** `docs/superpowers/plans/2026-09-26-perpustakaan-05b-satu-peran.md` (selesai, `master` di `a5d53c5`)

**Keputusan desain rencana ini** (dapat dikoreksi pemilik produk sebelum eksekusi):

| Topik | Keputusan | Alasan |
|---|---|---|
| Laporan yang dibuat | Empat, sesuai menu Laporan yang sudah ada di sidebar: Peminjaman, Pengembalian, Keterlambatan, Koleksi Buku | PRD bab 12.2 tidak ada di repo; sidebar (Rencana 01) sudah menetapkan keempatnya |
| Periode | Peminjaman dan Pengembalian disaring per rentang tanggal (bawaan: tanggal 1 bulan ini sampai hari ini, WIB), maksimal 366 hari. Keterlambatan selalu "per hari ini". Koleksi tanpa tanggal | Laporan bulanan adalah kebutuhan paling umum perpustakaan sekolah |
| Filter kelas | Peminjaman, Pengembalian, Keterlambatan dapat disaring per kelas, memakai kelas **saat meminjam** (`loans.student_class`) | Spec §13: snapshot kelas membuat laporan per kelas akurat secara historis walau siswa naik kelas |
| Batas baris | 1.000 baris per laporan; bila lebih, tampil pemberitahuan agar periode dipersempit. Ringkasan tetap menghitung seluruh data | Halaman tetap ringan dan dapat dicetak; kasus 1.000+ transaksi per bulan jarang untuk satu perpustakaan sekolah |
| Cetak | Tombol "Cetak Laporan" di halaman laporan, A4 mendatar, tanpa sidebar/topbar/filter; kop berisi nama sekolah, judul, periode, dan waktu cetak | Spec §2.2: cetak melalui peramban, tanpa ekspor PDF/Excel |
| Keterlambatan | Per eksemplar yang belum kembali dan lewat jatuh tempo, dengan perkiraan denda = hari telat × tarif denda saat ini | Petugas perlu tahu buku mana yang harus ditagih; denda sesungguhnya baru dihitung saat pengembalian (spec §5.3) |
| Koleksi | Per judul aktif: jumlah eksemplar per status. Total tidak menghitung eksemplar `NONAKTIF` (sama dengan kartu "Total Buku" di dashboard). Disaring per kata kunci judul/penulis dan kategori | Konsisten dengan definisi dashboard Rencana 05 |

## Global Constraints

- **Versi terpasang:** `next@16.3.5`, `react@19.2.8`, `drizzle-orm@0.45.3`, `vitest@5.0.1`, `zod@4.6.5`. **Tidak ada dependensi baru** (tidak ada pustaka PDF/Excel/grafik, testing-library, atau jsdom).
- **Lingkungan Windows:** Node berada di `D:\nvm\nodejs` dan tidak ada di PATH. Awali perintah `npm`/`npx` dengan `export PATH="/d/nvm/nodejs:$PATH";`.
- **TypeScript mode `strict`.** `any` dilarang.
- **Satu peran (spec §7, revisi 26 September 2026):** setiap akun yang masuk dapat membuka seluruh laporan. Setiap halaman tetap memanggil `requireProfile()` sendiri.
- **Laporan hanya membaca.** Tidak ada service, Server Action, atau penulisan database di rencana ini.
- **Tanggal kalender adalah untai `'YYYY-MM-DD'` (`IsoDate`).** "Hari ini" selalu `schoolToday()` di halaman. Kolom `timestamptz` (`loan_items.returned_at`) dibandingkan dengan tanggal sekolah lewat `(kolom at time zone 'Asia/Jakarta')::date`.
- **Keterlambatan dihitung saat dibaca** (spec §4.2): `due_date < hari ini AND status <> 'SELESAI'`, per eksemplar yang `returned_at IS NULL`.
- **Nominal rupiah** di kolom `numeric(12,2)` dibaca `Number(...)` dan ditampilkan lewat `formatRupiah()`.
- **Drizzle 0.45:** jangan pakai subquery berkorelasi; kolom di template `sql` pada select satu tabel ditulis tanpa nama tabel. Pakai tabel turunan yang di-JOIN (`loan-aggregates.ts`).
- **DATABASE_URL menunjuk ke database Supabase cloud berisi data sungguhan.** Uji integrasi hanya di dalam `withRollback()`. Karena tabel berisi data sungguhan, uji laporan membatasi diri dengan tanggal uji 2090, kelas uji `XI UJI 1`/`XI UJI 2`, atau judul berawalan `UJI-`, dan tidak menegaskan angka atas seluruh tabel.
- **Seluruh teks antarmuka berbahasa Indonesia.** Font Plus Jakarta Sans (`--font-sans`); angka di tabel dan ringkasan tabular.
- **Desktop dan tablet:** tabel dibungkus `<ScrollTable>`; kisi ringkasan dua/empat kolom mulai `sm`/`lg`.
- **Repo ini memasang hook tdd-guard.** Urutan uji gagal → implementasi → uji lulus wajib diikuti.
- **Setiap commit diakhiri baris** `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, ditulis lewat heredoc bash (`git commit -F - <<'EOF'`). Berkas catatan pemilik `HOW TO RUN` di akar repo tidak pernah di-commit.

## Review Focus

1. **Pengembalian pukul 00.00–07.00 WIB.** Buku yang kembali pukul 00.30 WIB tanggal 2 masuk laporan tanggal 2, bukan tanggal 1 (UTC). (Task 3: uji `returnReport` dengan batas tengah malam WIB.)
2. **Periode yang tidak valid, terbalik, atau terlalu panjang** dari URL yang diketik tangan. Laporan tetap tampil dengan periode bawaan dan pesan yang menyebut apa yang salah, bukan galat. (Task 1: uji `parseReportPeriod`.)
3. **Siswa yang naik kelas setelah meminjam.** Laporan per kelas memakai kelas saat meminjam, sehingga pinjaman XI tahun lalu tidak pindah ke XII. (Task 2: uji `loanReport` setelah `students.class_name` diubah.)
4. **Periode dengan lebih dari 1.000 baris.** Laporan menampilkan 1.000 baris pertama, pemberitahuan agar periode dipersempit, dan ringkasan yang tetap menghitung seluruh data. (Task 2–5: uji dengan parameter `limit`.)
5. **Hasil cetak.** Sidebar, topbar, tombol Menu, form filter, dan tombol Cetak tidak ikut tercetak; tabel tidak terpotong oleh wadah gulir; kop cetak tampil. (Task 1: uji `AppShell`, `Topbar`, `ScrollTable`, dan komponen laporan.)

---

## Struktur Berkas

| Berkas | Tanggung jawab |
|---|---|
| `src/lib/iso-date.ts` | `parseIsoDate()` bersama (dipindah dari `audit-labels.ts`) |
| `src/lib/report-period.ts` | Periode laporan dari URL, batas baris, pesan pemotongan |
| `src/components/layout/{app-shell,topbar}.tsx`, `src/components/ui/scroll-table.tsx` | Varian `print:` |
| `src/components/reports/print-button.tsx` | Tombol "Cetak Laporan" (klien) |
| `src/components/reports/report-parts.tsx` | Kop, form filter, kisi ringkasan, pemberitahuan |
| `src/server/queries/loan-aggregates.ts` | + `loanItemCounts()` (jumlah buku dan yang belum kembali per pinjaman) |
| `src/server/queries/reports.ts` | `listReportClassOptions`, `loanReport`, `returnReport`, `overdueReport`, `collectionReport` |
| `src/app/(app)/laporan/{peminjaman,pengembalian,keterlambatan,koleksi}/page.tsx` | Halaman laporan |
| `tests/integration/reports.test.ts` | Uji integrasi seluruh query laporan |

---

## Task 1: Kerangka Laporan dan Cetak

Menyiapkan bagian yang dipakai keempat laporan: pembacaan periode dari URL, kerangka aplikasi yang tidak ikut tercetak, komponen laporan (kop cetak, form filter, kisi ringkasan, pemberitahuan, tombol cetak), dan daftar kelas untuk filter.

**Files:**
- Create: `src/lib/iso-date.ts`, `src/lib/iso-date.test.ts`
- Modify: `src/lib/audit-labels.ts` (`parseDateFilter` memakai `parseIsoDate`)
- Create: `src/lib/report-period.ts`, `src/lib/report-period.test.ts`
- Modify: `src/components/layout/app-shell.tsx`, `app-shell.test.tsx`
- Modify: `src/components/layout/topbar.tsx`, `topbar.test.tsx`
- Modify: `src/components/ui/scroll-table.tsx`, `src/components/ui/list-parts.test.tsx`
- Create: `src/components/reports/print-button.tsx`
- Create: `src/components/reports/report-parts.tsx`, `report-parts.test.tsx`
- Create: `src/server/queries/reports.ts` (awal: `listReportClassOptions`)
- Create: `tests/integration/reports.test.ts`
- Modify: `src/components/layout/sidebar.tsx` (hapus komentar "sampai saat itu tautan ini 404")

**Interfaces:**
- Consumes: `addDays`, `diffDays`, `IsoDate` (`src/domain/shared/date.ts`); `formatDate` (`src/lib/format.ts`); `formatSchoolDateTime` (`src/lib/school-date.ts`); `buttonClass`; `Option`; fixture `circulationFixture`, `seedLoan` (`tests/integration/circulation-fixture.ts`)
- Produces:
  - `parseIsoDate(value: string): IsoDate | null`
  - `REPORT_ROW_LIMIT = 1000`, `MAX_REPORT_DAYS = 366`, `TRUNCATED_MESSAGE: string`
  - `interface ReportPeriod { from: IsoDate; to: IsoDate }`
  - `parseReportPeriod(params: { dari: string; sampai: string }, today: IsoDate): { ok: true; period: ReportPeriod } | { ok: false; period: ReportPeriod; message: string }`
  - `formatPeriod(period: ReportPeriod): string` — `'01/09/2026 – 26/09/2026'`
  - `<PrintButton />`
  - `<ReportHeader schoolName title description period />`, `<ReportFilters from? to? className? classOptions? />`, `<SummaryGrid items />`, `<ReportNotice message />`
  - `listReportClassOptions(executor?): Promise<Option[]>`

- [ ] **Step 1: Tulis uji tanggal dan periode yang gagal**

Buat `src/lib/iso-date.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseIsoDate } from './iso-date';

describe('parseIsoDate', () => {
  it('menerima tanggal kalender yang sah saja', () => {
    expect(parseIsoDate('2026-09-25')).toBe('2026-09-25');
    expect(parseIsoDate('2028-02-29')).toBe('2028-02-29');
    expect(parseIsoDate('2026-02-30')).toBeNull();
    expect(parseIsoDate('25/09/2026')).toBeNull();
    expect(parseIsoDate('')).toBeNull();
  });
});
```

Buat `src/lib/report-period.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatPeriod, MAX_REPORT_DAYS, parseReportPeriod, REPORT_ROW_LIMIT, TRUNCATED_MESSAGE } from './report-period';

const today = '2026-09-26';
const monthSoFar = { from: '2026-09-01', to: '2026-09-26' };

describe('parseReportPeriod', () => {
  it('memakai tanggal 1 bulan ini sampai hari ini bila tidak diisi', () => {
    expect(parseReportPeriod({ dari: '', sampai: '' }, today)).toEqual({ ok: true, period: monthSoFar });
  });

  it('memakai rentang yang diisi', () => {
    expect(parseReportPeriod({ dari: '2026-08-01', sampai: '2026-08-31' }, today))
      .toEqual({ ok: true, period: { from: '2026-08-01', to: '2026-08-31' } });
  });

  it('melengkapi ujung yang kosong: sampai hari ini, atau dari tanggal 1 bulan yang sama', () => {
    expect(parseReportPeriod({ dari: '2026-09-10', sampai: '' }, today))
      .toEqual({ ok: true, period: { from: '2026-09-10', to: today } });
    expect(parseReportPeriod({ dari: '', sampai: '2026-08-15' }, today))
      .toEqual({ ok: true, period: { from: '2026-08-01', to: '2026-08-15' } });
  });

  it('kembali ke periode bawaan dengan pesan bila tanggal tidak sah', () => {
    expect(parseReportPeriod({ dari: '2026-02-30', sampai: '' }, today)).toEqual({
      ok: false,
      period: monthSoFar,
      message: 'Tanggal tidak valid. Pilih tanggal dari kalender, misalnya 01/09/2026 sampai 30/09/2026.',
    });
  });

  it('kembali ke periode bawaan dengan pesan bila periode terbalik', () => {
    expect(parseReportPeriod({ dari: '2026-09-20', sampai: '2026-09-10' }, today)).toEqual({
      ok: false,
      period: monthSoFar,
      message: 'Periode terbalik: 20/09/2026 berada setelah 10/09/2026. Tukar tanggal awal dan akhirnya.',
    });
  });

  it('menolak periode lebih dari 366 hari', () => {
    expect(MAX_REPORT_DAYS).toBe(366);
    expect(parseReportPeriod({ dari: '2025-01-01', sampai: '2026-01-01' }, today).ok).toBe(true);
    expect(parseReportPeriod({ dari: '2025-01-01', sampai: '2026-01-02' }, today)).toEqual({
      ok: false,
      period: monthSoFar,
      message: 'Periode maksimal 366 hari. Persempit rentang tanggalnya.',
    });
  });
});

describe('formatPeriod dan batas baris', () => {
  it('menulis periode dengan tanggal Indonesia', () => {
    expect(formatPeriod(monthSoFar)).toBe('01/09/2026 – 26/09/2026');
  });

  it('membatasi 1.000 baris dengan pesan yang meminta periode dipersempit', () => {
    expect(REPORT_ROW_LIMIT).toBe(1000);
    expect(TRUNCATED_MESSAGE).toBe(
      'Laporan ini memuat lebih dari 1.000 baris; yang tampil 1.000 baris pertama. Persempit periode atau pilih satu kelas agar lengkap.',
    );
  });
});
```

- [ ] **Step 2: Jalankan uji dan pastikan gagal**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test -- src/lib/iso-date.test.ts src/lib/report-period.test.ts
```

Harapan: FAIL dengan "Failed to resolve import".

- [ ] **Step 3: Tulis modul tanggal dan periode**

Buat `src/lib/iso-date.ts`:

```ts
import type { IsoDate } from '@/domain/shared/date';

/** '2026-02-30' ditolak: tanggal harus ada di kalender, bukan hanya berpola benar. */
export function parseIsoDate(value: string): IsoDate | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}
```

Di `src/lib/audit-labels.ts`, ganti isi `parseDateFilter` agar memakai fungsi bersama (API-nya tidak berubah):

```ts
import { parseIsoDate } from './iso-date';
```

```ts
/** '2026-02-30' ditolak: tanggal harus ada di kalender, bukan hanya berpola benar. */
export function parseDateFilter(value: string): IsoDate | null {
  return parseIsoDate(value);
}
```

Buat `src/lib/report-period.ts`:

```ts
import { diffDays, type IsoDate } from '@/domain/shared/date';
import { formatDate } from './format';
import { parseIsoDate } from './iso-date';

/** Batas baris per laporan agar halaman tetap ringan dan dapat dicetak. Ringkasan tetap menghitung seluruhnya. */
export const REPORT_ROW_LIMIT = 1000;

export const MAX_REPORT_DAYS = 366;

export const TRUNCATED_MESSAGE =
  'Laporan ini memuat lebih dari 1.000 baris; yang tampil 1.000 baris pertama. Persempit periode atau pilih satu kelas agar lengkap.';

export interface ReportPeriod {
  from: IsoDate;
  to: IsoDate;
}

export type PeriodResult =
  | { ok: true; period: ReportPeriod }
  | { ok: false; period: ReportPeriod; message: string };

function monthStart(date: IsoDate): IsoDate {
  return `${date.slice(0, 8)}01`;
}

/**
 * Periode laporan dari `?dari=&sampai=`. Masukan yang salah tidak pernah
 * menggagalkan halaman: laporan tampil dengan periode bawaan (tanggal 1
 * bulan ini sampai hari ini) beserta pesan yang menyebut kesalahannya.
 */
export function parseReportPeriod(params: { dari: string; sampai: string }, today: IsoDate): PeriodResult {
  const fallback = { from: monthStart(today), to: today };
  const dari = params.dari.trim();
  const sampai = params.sampai.trim();
  if (!dari && !sampai) return { ok: true, period: fallback };

  const to = sampai ? parseIsoDate(sampai) : today;
  const from = dari ? parseIsoDate(dari) : to ? monthStart(to) : null;
  if (!from || !to) {
    return {
      ok: false,
      period: fallback,
      message: 'Tanggal tidak valid. Pilih tanggal dari kalender, misalnya 01/09/2026 sampai 30/09/2026.',
    };
  }
  if (from > to) {
    return {
      ok: false,
      period: fallback,
      message: `Periode terbalik: ${formatDate(from)} berada setelah ${formatDate(to)}. Tukar tanggal awal dan akhirnya.`,
    };
  }
  if (diffDays(from, to) + 1 > MAX_REPORT_DAYS) {
    return { ok: false, period: fallback, message: `Periode maksimal ${MAX_REPORT_DAYS} hari. Persempit rentang tanggalnya.` };
  }
  return { ok: true, period: { from, to } };
}

export function formatPeriod(period: ReportPeriod): string {
  return `${formatDate(period.from)} – ${formatDate(period.to)}`;
}
```

Catatan: `2025-01-01` sampai `2026-01-01` adalah 366 hari termasuk kedua ujungnya (`diffDays` = 365), jadi masih diterima.

- [ ] **Step 4: Jalankan uji dan pastikan lulus**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test -- src/lib/iso-date.test.ts src/lib/report-period.test.ts src/lib/audit-labels.test.ts
```

Harapan: PASS, termasuk uji `parseDateFilter` yang sudah ada.

- [ ] **Step 5: Tulis uji kerangka cetak yang gagal**

Di `src/components/layout/app-shell.test.tsx`, ganti harapan `'id="navigasi-utama" class="hidden lg:flex"'` dengan `'id="navigasi-utama" class="hidden lg:flex print:hidden"'`. Tambahkan uji:

```tsx
  it('tidak ikut tercetak: tombol Menu, sidebar, dan bantalan halaman', () => {
    const html = render();
    expect(html).toMatch(/<div class="[^"]*lg:hidden[^"]*print:hidden[^"]*"><button/);
    expect(html).toContain('<main class="flex-1 p-4 lg:p-6 print:p-0">');
  });
```

Di `src/components/layout/topbar.test.tsx`, tambahkan:

```tsx
  it('tidak ikut tercetak', () => {
    const html = renderToStaticMarkup(<Topbar academicYear="2026/2027" userName="Admin" />);
    expect(html).toMatch(/^<header class="[^"]*print:hidden/);
  });
```

Di `src/components/ui/list-parts.test.tsx`, di dalam `describe('ScrollTable')`, tambahkan:

```tsx
  it('tidak memotong tabel saat dicetak', () => {
    const html = renderToStaticMarkup(
      <ScrollTable>
        <tbody><tr><td>isi</td></tr></tbody>
      </ScrollTable>,
    );
    expect(html).toContain('print:overflow-visible');
    expect(html).toContain('print:min-w-0');
  });
```

- [ ] **Step 6: Jalankan uji dan pastikan gagal**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test -- src/components/layout src/components/ui/list-parts.test.tsx
```

Harapan: FAIL pada ketiga uji baru dan harapan `navigasi-utama` yang diubah.

- [ ] **Step 7: Tambahkan varian cetak**

Di `src/components/layout/app-shell.tsx`:
- div tombol Menu: tambahkan ` print:hidden` di akhir kelasnya → `"flex items-center border-b border-[var(--color-ink-100)] bg-white px-4 py-2 lg:hidden print:hidden"`
- div `#navigasi-utama`: `className={open ? 'fixed inset-0 z-30 flex lg:static lg:z-auto print:hidden' : 'hidden lg:flex print:hidden'}`
- `<main className="flex-1 p-4 lg:p-6 print:p-0">`

Di `src/components/layout/topbar.tsx`, tambahkan ` print:hidden` di akhir kelas `<header>`.

Di `src/components/ui/scroll-table.tsx`:

```tsx
    <div className="overflow-x-auto rounded-lg border border-[var(--color-ink-100)] bg-white print:overflow-visible print:rounded-none">
      <table className="w-full min-w-[40rem] text-sm print:min-w-0 print:text-xs">{children}</table>
    </div>
```

Di `src/components/layout/sidebar.tsx`, ganti komentar di atas grup Laporan menjadi `// PRD bab 11: laporan terlihat oleh setiap akun.`.

- [ ] **Step 8: Jalankan uji dan pastikan lulus**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test -- src/components/layout src/components/ui/list-parts.test.tsx
```

Harapan: PASS.

- [ ] **Step 9: Tulis uji komponen laporan yang gagal**

Buat `src/components/reports/report-parts.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@/lib/school-date', () => ({ formatSchoolDateTime: () => '26/09/2026 10.15' }));

import { ReportFilters, ReportHeader, ReportNotice, SummaryGrid } from './report-parts';

describe('ReportHeader', () => {
  it('menampilkan judul dan tombol cetak di layar, dan kop lengkap hanya saat dicetak', () => {
    const html = renderToStaticMarkup(
      <ReportHeader schoolName="SMK Negeri 1 Contoh" title="Laporan Peminjaman" description="Menurut tanggal pinjam." period="Periode 01/09/2026 – 26/09/2026" />,
    );

    expect(html).toContain('@page { size: A4 landscape; margin: 12mm; }');
    expect(html).toContain('Laporan Peminjaman');
    expect(html).toContain('Cetak Laporan');
    expect(html).toMatch(/<div class="[^"]*hidden[^"]*print:block[^"]*"><p[^>]*>SMK Negeri 1 Contoh<\/p>/);
    expect(html).toContain('Periode 01/09/2026 – 26/09/2026');
    expect(html).toContain('Dicetak 26/09/2026 10.15');
  });
});

describe('ReportFilters', () => {
  it('menyediakan rentang tanggal dan kelas lewat GET, tidak ikut tercetak', () => {
    const html = renderToStaticMarkup(
      <ReportFilters
        from="2026-09-01"
        to="2026-09-26"
        className="XI RPL 1"
        classOptions={[{ value: 'XI RPL 1', label: 'XI RPL 1' }, { value: 'XI TKJ 1', label: 'XI TKJ 1' }]}
      />,
    );

    expect(html).toMatch(/^<form class="[^"]*print:hidden/);
    expect(html).toContain('name="dari"');
    expect(html).toContain('value="2026-09-01"');
    expect(html).toContain('name="sampai"');
    expect(html).toContain('name="kelas"');
    expect(html).toContain('Semua kelas');
    expect(html).toContain('<option value="XI RPL 1" selected="">XI RPL 1</option>');
    expect(html).toContain('Tampilkan');
  });

  it('tanpa rentang tanggal bila laporan tidak memakainya', () => {
    const html = renderToStaticMarkup(<ReportFilters classOptions={[]} />);
    expect(html).not.toContain('name="dari"');
    expect(html).toContain('name="kelas"');
  });
});

describe('SummaryGrid dan ReportNotice', () => {
  it('menampilkan angka ringkasan', () => {
    const html = renderToStaticMarkup(<SummaryGrid items={[{ label: 'Transaksi', value: '1.250' }]} />);
    expect(html).toContain('Transaksi');
    expect(html).toContain('1.250');
  });

  it('menampilkan pemberitahuan hanya bila ada pesan, dan tidak ikut tercetak', () => {
    expect(renderToStaticMarkup(<ReportNotice message={null} />)).toBe('');
    const html = renderToStaticMarkup(<ReportNotice message="Periode maksimal 366 hari." />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('print:hidden');
  });
});
```

- [ ] **Step 10: Jalankan uji dan pastikan gagal**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test -- src/components/reports
```

Harapan: FAIL dengan "Failed to resolve import './report-parts'".

- [ ] **Step 11: Tulis komponen laporan**

Buat `src/components/reports/print-button.tsx`:

```tsx
'use client';

import { buttonClass } from '@/components/ui/button-styles';

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass('secondary')}>
      Cetak Laporan
    </button>
  );
}
```

Buat `src/components/reports/report-parts.tsx`:

```tsx
import type { ReactNode } from 'react';
import { buttonClass } from '@/components/ui/button-styles';
import type { Option } from '@/lib/options';
import { formatSchoolDateTime } from '@/lib/school-date';
import { PrintButton } from './print-button';

const CONTROL = 'rounded-md border border-[var(--color-ink-300)] bg-white px-3 py-2 text-sm';
const LABEL = 'mb-1 block text-[var(--color-ink-700)]';

/**
 * Judul laporan di layar, dan kop di kertas: nama sekolah, judul, periode,
 * waktu cetak. Laporan dicetak A4 mendatar agar tabel lebar tetap terbaca.
 */
export function ReportHeader({
  schoolName, title, description, period,
}: { schoolName: string; title: string; description: string; period: string | null }) {
  return (
    <>
      <style>{'@page { size: A4 landscape; margin: 12mm; }'}</style>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <h1 className="page-title text-2xl font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-500)]">{description}</p>
        </div>
        <PrintButton />
      </div>
      <div className="mb-4 hidden text-center print:block"><p className="text-base font-bold">{schoolName}</p>
        <p className="text-lg font-semibold">{title}</p>
        {period && <p className="text-sm">{period}</p>}
        <p className="text-xs">Dicetak {formatSchoolDateTime(new Date())}</p>
      </div>
    </>
  );
}

/** Form GET: filter laporan dapat dibagikan dan di-bookmark lewat URL. */
export function ReportFilters({
  from, to, className, classOptions, children,
}: { from?: string; to?: string; className?: string; classOptions?: Option[]; children?: ReactNode }) {
  return (
    <form className="mb-4 flex flex-wrap items-end gap-2 print:hidden">
      {from !== undefined && (
        <label className="text-sm">
          <span className={LABEL}>Dari tanggal</span>
          <input type="date" name="dari" defaultValue={from} className={CONTROL} />
        </label>
      )}
      {to !== undefined && (
        <label className="text-sm">
          <span className={LABEL}>Sampai tanggal</span>
          <input type="date" name="sampai" defaultValue={to} className={CONTROL} />
        </label>
      )}
      {classOptions && (
        <label className="text-sm">
          <span className={LABEL}>Kelas</span>
          <select name="kelas" defaultValue={className ?? ''} className={CONTROL}>
            <option value="">Semua kelas</option>
            {classOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      )}
      {children}
      <button type="submit" className={buttonClass('secondary')}>Tampilkan</button>
    </form>
  );
}

export function SummaryGrid({ items }: { items: { label: string; value: string }[] }) {
  return (
    <dl className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4 print:gap-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-[var(--color-ink-100)] bg-white p-3 print:p-2">
          <dt className="text-xs text-[var(--color-ink-500)]">{item.label}</dt>
          <dd className="tabular text-xl font-semibold">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ReportNotice({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mb-4 rounded-md bg-[var(--color-status-rusak)]/10 px-3 py-2 text-sm text-[var(--color-status-rusak)] print:hidden">
      {message}
    </p>
  );
}
```

Pastikan `<div className="mb-4 hidden text-center print:block">` langsung diikuti `<p>` nama sekolah tanpa spasi di antaranya, seperti di atas, agar regex uji cocok. Kalau Prettier/ESLint memindahkannya ke baris baru, React tetap tidak menyisipkan teks spasi di antara elemen JSX yang dipisah baris baru.

- [ ] **Step 12: Jalankan uji dan pastikan lulus**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test -- src/components/reports
```

Harapan: PASS.

- [ ] **Step 13: Tulis uji integrasi daftar kelas yang gagal**

Buat `tests/integration/reports.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { listReportClassOptions } from '@/server/queries/reports';
import { circulationFixture, seedLoan } from './circulation-fixture';
import { withRollback } from './helpers';

describe('listReportClassOptions', () => {
  it('mendaftar kelas saat meminjam, tanpa duplikat, urut abjad', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx, { copies: 3 });
      await seedLoan(tx, fx, { student: 1, copies: [0], loanDate: '2090-03-01', dueDate: '2090-03-04' });
      await seedLoan(tx, fx, { student: 0, copies: [1], loanDate: '2090-03-01', dueDate: '2090-03-04' });
      await seedLoan(tx, fx, { student: 0, copies: [2], loanDate: '2090-03-02', dueDate: '2090-03-05' });

      const options = await listReportClassOptions(tx);
      const uji = options.filter((option) => option.value.startsWith('XI UJI'));

      expect(uji).toEqual([
        { value: 'XI UJI 1', label: 'XI UJI 1' },
        { value: 'XI UJI 2', label: 'XI UJI 2' },
      ]);
    });
  });
});
```

- [ ] **Step 14: Jalankan uji dan pastikan gagal**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm run test:integration -- tests/integration/reports.test.ts
```

Harapan: FAIL dengan "Failed to resolve import '@/server/queries/reports'".

- [ ] **Step 15: Tulis query daftar kelas**

Buat `src/server/queries/reports.ts`:

```ts
import { asc } from 'drizzle-orm';
import type { Option } from '@/lib/options';
import { db } from '@/server/db/client';
import type { Executor } from '@/server/db/executor';
import { loans } from '@/server/db/schema';

/**
 * Kelas untuk filter laporan, dari kelas SAAT MEMINJAM (`loans.student_class`),
 * bukan kelas siswa sekarang: laporan per kelas tetap akurat setelah siswa
 * naik kelas (spec §13).
 */
export async function listReportClassOptions(executor: Executor = db): Promise<Option[]> {
  const rows = await executor
    .selectDistinct({ className: loans.studentClass })
    .from(loans)
    .orderBy(asc(loans.studentClass));
  return rows.map((row) => ({ value: row.className, label: row.className }));
}
```

- [ ] **Step 16: Jalankan uji dan pastikan lulus, lalu commit**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm run test:integration -- tests/integration/reports.test.ts && npm test && npm run lint && npx tsc --noEmit
```

Harapan: seluruhnya lulus.

```bash
git add src/lib/iso-date.ts src/lib/iso-date.test.ts src/lib/audit-labels.ts src/lib/report-period.ts src/lib/report-period.test.ts \
  src/components/layout src/components/ui/scroll-table.tsx src/components/ui/list-parts.test.tsx src/components/reports \
  src/server/queries/reports.ts tests/integration/reports.test.ts
git commit -F - <<'EOF'
feat(laporan): kerangka laporan — periode, kop cetak, filter, dan halaman tanpa sidebar saat dicetak

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

## Task 2: Laporan Peminjaman

**Files:**
- Modify: `src/server/queries/loan-aggregates.ts` (+ `loanItemCounts`)
- Modify: `src/server/queries/loans.ts` (`listLoans` memakai `loanItemCounts`, perilaku tidak berubah)
- Modify: `src/server/queries/reports.ts` (+ `loanReport`)
- Modify: `tests/integration/reports.test.ts`
- Create: `src/app/(app)/laporan/peminjaman/page.tsx`, `page.test.tsx`

**Interfaces:**
- Consumes: `REPORT_ROW_LIMIT`, `TRUNCATED_MESSAGE`, `parseReportPeriod`, `formatPeriod` (Task 1); `ReportHeader`, `ReportFilters`, `SummaryGrid`, `ReportNotice` (Task 1); `listReportClassOptions` (Task 1); `getLibrarySettings`; `LoanStatusBadge`; `ScrollTable`, `TD`, `TH`; `schoolToday`; `formatDate`; `firstValue`, `SearchParams`
- Produces:
  - `loanItemCounts(executor)` — tabel turunan beralias `item_counts` dengan kolom `loanId`, `itemCount`, `openCount`
  - `interface ReportFilter { from: IsoDate; to: IsoDate; className: string }` (kelas kosong = semua kelas)
  - `interface LoanReportRow { id: string; transactionNumber: string; loanDate: string; dueDate: string; status: LoanStatus; studentName: string; studentNis: string; studentClass: string; itemCount: number; openCount: number; daysOverdue: number }`
  - `interface LoanReportSummary { loans: number; copies: number; students: number }`
  - `loanReport(filter: ReportFilter, today: IsoDate, executor?, limit?): Promise<{ rows: LoanReportRow[]; summary: LoanReportSummary; truncated: boolean }>`
  - Rute `/laporan/peminjaman`

- [ ] **Step 1: Tulis uji integrasi yang gagal**

Tambahkan di `tests/integration/reports.test.ts` (sesuaikan impor: `eq` dari `drizzle-orm`, `students` dari `@/server/db/schema`, `loanReport` dari `@/server/queries/reports`):

```ts
describe('loanReport', () => {
  const march = { from: '2090-03-01', to: '2090-03-02', className: '' };

  it('mendaftar pinjaman dalam periode, urut tanggal, dengan jumlah buku dan keterlambatan', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx, { copies: 4 });
      const first = await seedLoan(tx, fx, { student: 0, copies: [0, 1], loanDate: '2090-03-01', dueDate: '2090-03-04', returned: [0] });
      const second = await seedLoan(tx, fx, { student: 1, copies: [2], loanDate: '2090-03-02', dueDate: '2090-03-05' });
      await seedLoan(tx, fx, { student: 0, copies: [3], loanDate: '2090-02-27', dueDate: '2090-03-02' });

      const report = await loanReport(march, '2090-03-06', tx);

      expect(report.truncated).toBe(false);
      expect(report.summary).toEqual({ loans: 2, copies: 3, students: 2 });
      expect(report.rows).toEqual([
        {
          id: first.id, transactionNumber: first.transactionNumber, loanDate: '2090-03-01', dueDate: '2090-03-04',
          status: 'SEBAGIAN_KEMBALI', studentName: 'UJI Siswa Satu', studentNis: 'UJI-S1', studentClass: 'XI UJI 1',
          itemCount: 2, openCount: 1, daysOverdue: 2,
        },
        {
          id: second.id, transactionNumber: second.transactionNumber, loanDate: '2090-03-02', dueDate: '2090-03-05',
          status: 'AKTIF', studentName: 'UJI Siswa Dua', studentNis: 'UJI-S2', studentClass: 'XI UJI 2',
          itemCount: 1, openCount: 1, daysOverdue: 1,
        },
      ]);
    });
  });

  it('menyaring per kelas saat meminjam, walau siswa sudah pindah kelas', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx, { copies: 2 });
      const loan = await seedLoan(tx, fx, { student: 0, copies: [0], loanDate: '2090-03-01', dueDate: '2090-03-04' });
      await seedLoan(tx, fx, { student: 1, copies: [1], loanDate: '2090-03-01', dueDate: '2090-03-04' });
      await tx.update(students).set({ className: 'XII UJI 1' }).where(eq(students.id, fx.students[0].id));

      const report = await loanReport({ ...march, className: 'XI UJI 1' }, '2090-03-02', tx);

      expect(report.rows.map((row) => row.id)).toEqual([loan.id]);
      expect(report.rows[0].studentClass).toBe('XI UJI 1');
      expect(report.summary).toEqual({ loans: 1, copies: 1, students: 1 });
    });
  });

  it('memotong baris di batas tetapi ringkasan tetap menghitung seluruhnya', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx, { copies: 2 });
      await seedLoan(tx, fx, { student: 0, copies: [0], loanDate: '2090-03-01', dueDate: '2090-03-04' });
      await seedLoan(tx, fx, { student: 1, copies: [1], loanDate: '2090-03-02', dueDate: '2090-03-05' });

      const report = await loanReport(march, '2090-03-02', tx, 1);

      expect(report.truncated).toBe(true);
      expect(report.rows).toHaveLength(1);
      expect(report.summary.loans).toBe(2);
    });
  });
});
```

- [ ] **Step 2: Jalankan uji dan pastikan gagal**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm run test:integration -- tests/integration/reports.test.ts
```

Harapan: FAIL, `loanReport` belum diekspor.

- [ ] **Step 3: Tabel turunan jumlah buku, dipakai bersama**

Tambahkan di akhir `src/server/queries/loan-aggregates.ts`:

```ts
/** Jumlah seluruh buku dan yang belum kembali per peminjaman. */
export function loanItemCounts(executor: Executor) {
  return executor
    .select({
      loanId: loanItems.loanId,
      itemCount: sql<number>`count(*)::int`.as('item_count'),
      openCount: sql<number>`(count(*) filter (where ${loanItems.returnedAt} is null))::int`.as('open_count'),
    })
    .from(loanItems)
    .groupBy(loanItems.loanId)
    .as('item_counts');
}
```

Di `src/server/queries/loans.ts`, fungsi `listLoans`: ganti definisi lokal `const itemCounts = executor.select({...}).from(loanItems).groupBy(loanItems.loanId).as('item_counts');` dengan `const itemCounts = loanItemCounts(executor);`, dan tambahkan `loanItemCounts` ke impor dari `./loan-aggregates`. Hapus impor yang tidak terpakai lagi, bila ada. Ini refaktor; jalankan `npm run test:integration -- tests/integration/loan-queries.test.ts` sebelum dan sesudahnya. Harapan: PASS keduanya.

- [ ] **Step 4: Tulis `loanReport`**

Tambahkan ke `src/server/queries/reports.ts` (gabungkan impornya):

```ts
import { and, asc, between, eq, sql } from 'drizzle-orm';
import { diffDays, type IsoDate } from '@/domain/shared/date';
import type { LoanStatus } from '@/domain/shared/types';
import { REPORT_ROW_LIMIT } from '@/lib/report-period';
import { loanItems, loans, students } from '@/server/db/schema';
import { loanItemCounts } from './loan-aggregates';

/** Periode dan kelas. `className` kosong berarti semua kelas. */
export interface ReportFilter {
  from: IsoDate;
  to: IsoDate;
  className: string;
}

export interface LoanReportRow {
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
  daysOverdue: number;
}

export interface LoanReportSummary {
  loans: number;
  copies: number;
  students: number;
}

/** Peminjaman menurut tanggal pinjam. Ringkasan menghitung seluruh data yang cocok, bukan hanya baris yang tampil. */
export async function loanReport(
  filter: ReportFilter,
  today: IsoDate,
  executor: Executor = db,
  limit: number = REPORT_ROW_LIMIT,
): Promise<{ rows: LoanReportRow[]; summary: LoanReportSummary; truncated: boolean }> {
  const counts = loanItemCounts(executor);
  const where = and(
    between(loans.loanDate, filter.from, filter.to),
    filter.className ? eq(loans.studentClass, filter.className) : undefined,
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
      itemCount: counts.itemCount,
      openCount: counts.openCount,
    })
    .from(loans)
    .innerJoin(students, eq(students.id, loans.studentId))
    .innerJoin(counts, eq(counts.loanId, loans.id))
    .where(where)
    .orderBy(asc(loans.loanDate), asc(loans.transactionNumber))
    .limit(limit + 1);

  const [summary] = await executor
    .select({
      loans: sql<number>`count(distinct ${loans.id})::int`,
      copies: sql<number>`count(${loanItems.id})::int`,
      students: sql<number>`count(distinct ${loans.studentId})::int`,
    })
    .from(loans)
    .innerJoin(loanItems, eq(loanItems.loanId, loans.id))
    .where(where);

  return {
    rows: rows.slice(0, limit).map((row) => ({
      ...row,
      itemCount: Number(row.itemCount),
      openCount: Number(row.openCount),
      daysOverdue: row.status === 'SELESAI' ? 0 : Math.max(0, diffDays(row.dueDate, today)),
    })),
    summary: {
      loans: Number(summary?.loans ?? 0),
      copies: Number(summary?.copies ?? 0),
      students: Number(summary?.students ?? 0),
    },
    truncated: rows.length > limit,
  };
}
```

- [ ] **Step 5: Jalankan uji dan pastikan lulus**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm run test:integration -- tests/integration/reports.test.ts tests/integration/loan-queries.test.ts
```

Harapan: PASS.

- [ ] **Step 6: Tulis uji halaman yang gagal**

Buat `src/app/(app)/laporan/peminjaman/page.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockLoanReport, mockClassOptions, mockSettings, mockRequireProfile } = vi.hoisted(() => ({
  mockLoanReport: vi.fn(),
  mockClassOptions: vi.fn(),
  mockSettings: vi.fn(),
  mockRequireProfile: vi.fn(),
}));

vi.mock('@/server/queries/reports', () => ({ loanReport: mockLoanReport, listReportClassOptions: mockClassOptions }));
vi.mock('@/server/queries/settings', () => ({ getLibrarySettings: mockSettings }));
vi.mock('@/server/auth/guard', () => ({ requireProfile: mockRequireProfile }));
vi.mock('@/lib/school-date', () => ({ schoolToday: () => '2090-03-06', formatSchoolDateTime: () => '06/03/2090 10.00' }));

import LoanReportPage from './page';

const row = {
  id: 'l1', transactionNumber: 'PJM-20900301-0001', loanDate: '2090-03-01', dueDate: '2090-03-04',
  status: 'AKTIF' as const, studentName: 'Ahmad Fauzi', studentNis: '202600123', studentClass: 'XI RPL 1',
  itemCount: 2, openCount: 2, daysOverdue: 2,
};

async function render(params: Record<string, string> = {}) {
  return renderToStaticMarkup(await LoanReportPage({ searchParams: Promise.resolve(params) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireProfile.mockResolvedValue({ id: 'u1', role: 'admin', fullName: 'Admin', status: 'active' });
  mockClassOptions.mockResolvedValue([{ value: 'XI RPL 1', label: 'XI RPL 1' }]);
  mockSettings.mockResolvedValue({ schoolName: 'SMK Negeri 1 Contoh', receiptFooter: null });
  mockLoanReport.mockResolvedValue({ rows: [row], summary: { loans: 1, copies: 2, students: 1 }, truncated: false });
});

describe('LoanReportPage', () => {
  it('memakai tanggal 1 bulan ini sampai hari ini dan menampilkan baris serta ringkasan', async () => {
    const html = await render();

    expect(mockLoanReport).toHaveBeenCalledWith({ from: '2090-03-01', to: '2090-03-06', className: '' }, '2090-03-06');
    expect(html).toContain('Laporan Peminjaman');
    expect(html).toContain('SMK Negeri 1 Contoh');
    expect(html).toContain('Periode 01/03/2090 – 06/03/2090');
    expect(html).toContain('href="/transaksi/riwayat/l1"');
    expect(html).toContain('PJM-20900301-0001');
    expect(html).toContain('Ahmad Fauzi');
    expect(html).toContain('XI RPL 1');
    expect(html).toContain('Terlambat 2 hari');
    expect(html).toContain('Transaksi');
    expect(html).toContain('Buku dipinjam');
  });

  it('meneruskan periode dan kelas dari URL, dan menyebut kelasnya di kop', async () => {
    const html = await render({ dari: '2090-02-01', sampai: '2090-02-28', kelas: 'XI RPL 1' });

    expect(mockLoanReport).toHaveBeenCalledWith({ from: '2090-02-01', to: '2090-02-28', className: 'XI RPL 1' }, '2090-03-06');
    expect(html).toContain('Periode 01/02/2090 – 28/02/2090 · Kelas XI RPL 1');
  });

  it('memberi tahu periode yang salah dan memakai periode bawaan', async () => {
    const html = await render({ dari: '2090-03-05', sampai: '2090-03-01' });

    expect(html).toContain('Periode terbalik: 05/03/2090 berada setelah 01/03/2090.');
    expect(mockLoanReport).toHaveBeenCalledWith({ from: '2090-03-01', to: '2090-03-06', className: '' }, '2090-03-06');
  });

  it('memberi tahu bila baris dipotong, dan menampilkan pesan kosong', async () => {
    mockLoanReport.mockResolvedValueOnce({ rows: [], summary: { loans: 0, copies: 0, students: 0 }, truncated: true });

    const html = await render();

    expect(html).toContain('Laporan ini memuat lebih dari 1.000 baris');
    expect(html).toContain('Tidak ada peminjaman pada periode ini.');
  });

  it('tidak membaca laporan tanpa sesi', async () => {
    mockRequireProfile.mockRejectedValueOnce(new Error('NEXT_REDIRECT'));

    await expect(render()).rejects.toThrow('NEXT_REDIRECT');
    expect(mockLoanReport).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 7: Jalankan uji dan pastikan gagal**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test -- laporan/peminjaman
```

Harapan: FAIL dengan "Failed to resolve import './page'".

- [ ] **Step 8: Tulis halaman laporan peminjaman**

Buat `src/app/(app)/laporan/peminjaman/page.tsx`:

```tsx
import Link from 'next/link';
import { ReportFilters, ReportHeader, ReportNotice, SummaryGrid } from '@/components/reports/report-parts';
import { LoanStatusBadge } from '@/components/ui/loan-status-badge';
import { ScrollTable } from '@/components/ui/scroll-table';
import { TD, TH } from '@/components/ui/table-styles';
import { formatDate } from '@/lib/format';
import { formatPeriod, parseReportPeriod, TRUNCATED_MESSAGE } from '@/lib/report-period';
import { schoolToday } from '@/lib/school-date';
import { firstValue, type SearchParams } from '@/lib/search-params';
import { requireProfile } from '@/server/auth/guard';
import { listReportClassOptions, loanReport } from '@/server/queries/reports';
import { getLibrarySettings } from '@/server/queries/settings';

function count(value: number): string {
  return value.toLocaleString('id-ID');
}

export default async function LoanReportPage({ searchParams }: { searchParams: SearchParams }) {
  await requireProfile();
  const params = await searchParams;
  const today = schoolToday();
  const periodResult = parseReportPeriod({ dari: firstValue(params.dari), sampai: firstValue(params.sampai) }, today);
  const { period } = periodResult;
  const className = firstValue(params.kelas).trim();

  const [report, classOptions, settings] = await Promise.all([
    loanReport({ from: period.from, to: period.to, className }, today),
    listReportClassOptions(),
    getLibrarySettings(),
  ]);

  return (
    <>
      <ReportHeader
        schoolName={settings.schoolName?.trim() || 'Perpustakaan Sekolah'}
        title="Laporan Peminjaman"
        description="Transaksi peminjaman menurut tanggal pinjam, dengan kelas saat meminjam."
        period={`Periode ${formatPeriod(period)}${className ? ` · Kelas ${className}` : ''}`}
      />
      <ReportFilters from={period.from} to={period.to} className={className} classOptions={classOptions} />
      <ReportNotice message={periodResult.ok ? null : periodResult.message} />
      <ReportNotice message={report.truncated ? TRUNCATED_MESSAGE : null} />
      <SummaryGrid
        items={[
          { label: 'Transaksi', value: count(report.summary.loans) },
          { label: 'Buku dipinjam', value: count(report.summary.copies) },
          { label: 'Siswa', value: count(report.summary.students) },
        ]}
      />

      <ScrollTable>
        <thead>
          <tr>
            <th className={TH}>Tanggal Pinjam</th>
            <th className={TH}>No. Transaksi</th>
            <th className={TH}>Siswa</th>
            <th className={TH}>Kelas</th>
            <th className={TH}>Buku</th>
            <th className={TH}>Jatuh Tempo</th>
            <th className={TH}>Status</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.length === 0 && (
            <tr>
              <td colSpan={7} className={`${TD} text-center text-[var(--color-ink-500)]`}>Tidak ada peminjaman pada periode ini.</td>
            </tr>
          )}
          {report.rows.map((row) => (
            <tr key={row.id}>
              <td className={TD}>{formatDate(row.loanDate)}</td>
              <td className={TD}>
                <Link href={`/transaksi/riwayat/${row.id}`} className="font-mono text-[var(--color-accent-600)] hover:underline">
                  {row.transactionNumber}
                </Link>
              </td>
              <td className={TD}>
                {row.studentName}
                <span className="block font-mono text-xs text-[var(--color-ink-500)]">{row.studentNis}</span>
              </td>
              <td className={TD}>{row.studentClass}</td>
              <td className={`${TD} tabular`}>
                {row.itemCount}
                {row.openCount > 0 && row.status !== 'SELESAI' && (
                  <span className="block text-xs text-[var(--color-ink-500)]">{row.openCount} belum kembali</span>
                )}
              </td>
              <td className={TD}>{formatDate(row.dueDate)}</td>
              <td className={TD}><LoanStatusBadge status={row.status} daysOverdue={row.daysOverdue} /></td>
            </tr>
          ))}
        </tbody>
      </ScrollTable>
    </>
  );
}
```

- [ ] **Step 9: Jalankan uji dan pastikan lulus, lalu commit**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test -- laporan/peminjaman && npm test && npm run test:integration -- tests/integration/reports.test.ts tests/integration/loan-queries.test.ts && npm run lint && npx tsc --noEmit
```

Harapan: seluruhnya lulus. Bila teks `'Terlambat 2 hari'` gagal, periksa label yang dipakai `LoanStatusBadge` di `src/components/ui/loan-status-badge.tsx` dan pakai teks persisnya.

```bash
git add src/server/queries/loan-aggregates.ts src/server/queries/loans.ts src/server/queries/reports.ts \
  tests/integration/reports.test.ts "src/app/(app)/laporan/peminjaman"
git commit -F - <<'EOF'
feat(laporan): laporan peminjaman per periode dan kelas saat meminjam

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

## Task 3: Laporan Pengembalian

**Files:**
- Modify: `src/server/queries/reports.ts` (+ `returnReport`)
- Modify: `tests/integration/reports.test.ts`
- Create: `src/app/(app)/laporan/pengembalian/page.tsx`, `page.test.tsx`

**Interfaces:**
- Consumes: `ReportFilter` (Task 2); `REPORT_ROW_LIMIT`, `TRUNCATED_MESSAGE`, `parseReportPeriod`, `formatPeriod`, komponen laporan, `listReportClassOptions` (Task 1); `SCHOOL_TIME_ZONE`, `formatSchoolDateTime`; `RETURN_CONDITION_LABELS` (`src/lib/circulation-labels.ts`); `formatRupiah`
- Produces:
  - `interface ReturnReportRow { id: string; returnedAt: Date; loanId: string; transactionNumber: string; studentName: string; studentNis: string; studentClass: string; barcode: string; bookTitle: string; condition: ReturnCondition | null; daysLate: number; lateFine: number; replacementFee: number }`
  - `interface ReturnReportSummary { copies: number; good: number; damaged: number; lost: number; lateFines: number; replacementFees: number }`
  - `returnReport(filter: ReportFilter, executor?, limit?): Promise<{ rows: ReturnReportRow[]; summary: ReturnReportSummary; truncated: boolean }>`
  - Rute `/laporan/pengembalian`

- [ ] **Step 1: Tulis uji integrasi yang gagal**

Tambahkan di `tests/integration/reports.test.ts` (impor `and` dari `drizzle-orm`, `loanItems` dari skema, `returnReport` dari query):

```ts
describe('returnReport', () => {
  /** Mengatur waktu kembali dan hasil pengembalian satu eksemplar yang sudah ditandai kembali oleh seedLoan. */
  async function setReturn(
    tx: Transaction,
    loanId: string,
    copyId: string,
    values: { at: string; condition: 'BAIK' | 'RUSAK' | 'HILANG'; daysLate?: number; lateFine?: number; replacementFee?: number },
  ) {
    await tx.update(loanItems).set({
      returnedAt: new Date(values.at),
      returnCondition: values.condition,
      daysLate: values.daysLate ?? 0,
      lateFine: String(values.lateFine ?? 0),
      replacementFee: String(values.replacementFee ?? 0),
    }).where(and(eq(loanItems.loanId, loanId), eq(loanItems.bookCopyId, copyId)));
  }

  it('mendaftar eksemplar yang kembali pada periode menurut tanggal WIB, dengan denda dan ringkasan kondisi', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx, { copies: 3 });
      const loan = await seedLoan(tx, fx, {
        student: 0, copies: [0, 1, 2], loanDate: '2090-02-25', dueDate: '2090-02-28', returned: [0, 1, 2],
      });
      // 02/03 00.30 WIB — masuk
      await setReturn(tx, loan.id, fx.copies[0].id, { at: '2090-03-01T17:30:00Z', condition: 'RUSAK', daysLate: 2, lateFine: 2000, replacementFee: 50000 });
      // 02/03 09.00 WIB — masuk
      await setReturn(tx, loan.id, fx.copies[1].id, { at: '2090-03-02T02:00:00Z', condition: 'BAIK', daysLate: 2, lateFine: 2000 });
      // 01/03 23.59 WIB — tidak masuk
      await setReturn(tx, loan.id, fx.copies[2].id, { at: '2090-03-01T16:59:00Z', condition: 'HILANG', replacementFee: 50000 });

      const report = await returnReport({ from: '2090-03-02', to: '2090-03-02', className: '' }, tx);

      expect(report.truncated).toBe(false);
      expect(report.rows.map((row) => [row.barcode, row.condition, row.lateFine, row.replacementFee])).toEqual([
        ['UJI-SRK-01', 'RUSAK', 2000, 50000],
        ['UJI-SRK-02', 'BAIK', 2000, 0],
      ]);
      expect(report.rows[0]).toMatchObject({
        loanId: loan.id, transactionNumber: loan.transactionNumber, studentName: 'UJI Siswa Satu',
        studentNis: 'UJI-S1', studentClass: 'XI UJI 1', bookTitle: 'UJI-Buku Sirkulasi', daysLate: 2,
      });
      expect(report.rows[0].returnedAt).toBeInstanceOf(Date);
      expect(report.summary).toEqual({ copies: 2, good: 1, damaged: 1, lost: 0, lateFines: 4000, replacementFees: 50000 });
    });
  });

  it('menyaring per kelas saat meminjam dan memotong baris di batas', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx, { copies: 3 });
      const mine = await seedLoan(tx, fx, { student: 0, copies: [0, 1], loanDate: '2090-02-25', dueDate: '2090-02-28', returned: [0, 1] });
      const other = await seedLoan(tx, fx, { student: 1, copies: [2], loanDate: '2090-02-25', dueDate: '2090-02-28', returned: [2] });
      await setReturn(tx, mine.id, fx.copies[0].id, { at: '2090-03-02T02:00:00Z', condition: 'BAIK' });
      await setReturn(tx, mine.id, fx.copies[1].id, { at: '2090-03-02T03:00:00Z', condition: 'BAIK' });
      await setReturn(tx, other.id, fx.copies[2].id, { at: '2090-03-02T04:00:00Z', condition: 'BAIK' });

      const report = await returnReport({ from: '2090-03-02', to: '2090-03-02', className: 'XI UJI 1' }, tx, 1);

      expect(report.truncated).toBe(true);
      expect(report.rows).toHaveLength(1);
      expect(report.summary.copies).toBe(2);
    });
  });
});
```

Tambahkan juga impor `import type { Transaction } from '@/server/db/executor';`.

- [ ] **Step 2: Jalankan uji dan pastikan gagal**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm run test:integration -- tests/integration/reports.test.ts
```

Harapan: FAIL, `returnReport` belum diekspor.

- [ ] **Step 3: Tulis `returnReport`**

Tambahkan ke `src/server/queries/reports.ts` (gabungkan impor: `isNotNull` dari `drizzle-orm`; `ReturnCondition` dari tipe domain; `SCHOOL_TIME_ZONE` dari `@/lib/school-date`; `bookCopies`, `books` dari skema):

```ts
export interface ReturnReportRow {
  id: string;
  returnedAt: Date;
  loanId: string;
  transactionNumber: string;
  studentName: string;
  studentNis: string;
  studentClass: string;
  barcode: string;
  bookTitle: string;
  condition: ReturnCondition | null;
  daysLate: number;
  lateFine: number;
  replacementFee: number;
}

export interface ReturnReportSummary {
  copies: number;
  good: number;
  damaged: number;
  lost: number;
  lateFines: number;
  replacementFees: number;
}

/**
 * Eksemplar yang kembali pada periode, menurut tanggal WIB dari `returned_at`
 * (timestamptz), bukan tanggal UTC-nya: buku yang kembali pukul 00.30 WIB
 * masuk hari itu, bukan kemarin.
 */
export async function returnReport(
  filter: ReportFilter,
  executor: Executor = db,
  limit: number = REPORT_ROW_LIMIT,
): Promise<{ rows: ReturnReportRow[]; summary: ReturnReportSummary; truncated: boolean }> {
  const where = and(
    isNotNull(loanItems.returnedAt),
    sql`(${loanItems.returnedAt} at time zone ${SCHOOL_TIME_ZONE})::date between ${filter.from}::date and ${filter.to}::date`,
    filter.className ? eq(loans.studentClass, filter.className) : undefined,
  );

  const rows = await executor
    .select({
      id: loanItems.id,
      returnedAt: loanItems.returnedAt,
      loanId: loans.id,
      transactionNumber: loans.transactionNumber,
      studentName: students.name,
      studentNis: students.nis,
      studentClass: loans.studentClass,
      barcode: bookCopies.barcode,
      bookTitle: books.title,
      condition: loanItems.returnCondition,
      daysLate: loanItems.daysLate,
      lateFine: loanItems.lateFine,
      replacementFee: loanItems.replacementFee,
    })
    .from(loanItems)
    .innerJoin(loans, eq(loans.id, loanItems.loanId))
    .innerJoin(students, eq(students.id, loans.studentId))
    .innerJoin(bookCopies, eq(bookCopies.id, loanItems.bookCopyId))
    .innerJoin(books, eq(books.id, bookCopies.bookId))
    .where(where)
    .orderBy(asc(loanItems.returnedAt), asc(bookCopies.barcode))
    .limit(limit + 1);

  const [summary] = await executor
    .select({
      copies: sql<number>`count(*)::int`,
      good: sql<number>`(count(*) filter (where ${loanItems.returnCondition} = 'BAIK'))::int`,
      damaged: sql<number>`(count(*) filter (where ${loanItems.returnCondition} = 'RUSAK'))::int`,
      lost: sql<number>`(count(*) filter (where ${loanItems.returnCondition} = 'HILANG'))::int`,
      lateFines: sql<string>`coalesce(sum(${loanItems.lateFine}), 0)`,
      replacementFees: sql<string>`coalesce(sum(${loanItems.replacementFee}), 0)`,
    })
    .from(loanItems)
    .innerJoin(loans, eq(loans.id, loanItems.loanId))
    .where(where);

  return {
    rows: rows.slice(0, limit).map((row) => ({
      ...row,
      // Filter `isNotNull` menjamin nilainya ada.
      returnedAt: row.returnedAt as Date,
      lateFine: Number(row.lateFine),
      replacementFee: Number(row.replacementFee),
    })),
    summary: {
      copies: Number(summary?.copies ?? 0),
      good: Number(summary?.good ?? 0),
      damaged: Number(summary?.damaged ?? 0),
      lost: Number(summary?.lost ?? 0),
      lateFines: Number(summary?.lateFines ?? 0),
      replacementFees: Number(summary?.replacementFees ?? 0),
    },
    truncated: rows.length > limit,
  };
}
```

- [ ] **Step 4: Jalankan uji dan pastikan lulus**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm run test:integration -- tests/integration/reports.test.ts
```

Harapan: PASS.

- [ ] **Step 5: Tulis uji halaman yang gagal**

Buat `src/app/(app)/laporan/pengembalian/page.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockReturnReport, mockClassOptions, mockSettings, mockRequireProfile } = vi.hoisted(() => ({
  mockReturnReport: vi.fn(),
  mockClassOptions: vi.fn(),
  mockSettings: vi.fn(),
  mockRequireProfile: vi.fn(),
}));

vi.mock('@/server/queries/reports', () => ({ returnReport: mockReturnReport, listReportClassOptions: mockClassOptions }));
vi.mock('@/server/queries/settings', () => ({ getLibrarySettings: mockSettings }));
vi.mock('@/server/auth/guard', () => ({ requireProfile: mockRequireProfile }));
vi.mock('@/lib/school-date', () => ({ schoolToday: () => '2090-03-06', formatSchoolDateTime: () => '02/03/2090 09.00' }));

import ReturnReportPage from './page';

const row = {
  id: 'i1', returnedAt: new Date('2090-03-02T02:00:00Z'), loanId: 'l1', transactionNumber: 'PJM-20900225-0001',
  studentName: 'Ahmad Fauzi', studentNis: '202600123', studentClass: 'XI RPL 1', barcode: 'BK-000001',
  bookTitle: 'Pemrograman Web', condition: 'RUSAK' as const, daysLate: 2, lateFine: 2000, replacementFee: 50000,
};

async function render(params: Record<string, string> = {}) {
  return renderToStaticMarkup(await ReturnReportPage({ searchParams: Promise.resolve(params) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireProfile.mockResolvedValue({ id: 'u1', role: 'admin', fullName: 'Admin', status: 'active' });
  mockClassOptions.mockResolvedValue([]);
  mockSettings.mockResolvedValue({ schoolName: 'SMK Negeri 1 Contoh', receiptFooter: null });
  mockReturnReport.mockResolvedValue({
    rows: [row],
    summary: { copies: 1, good: 0, damaged: 1, lost: 0, lateFines: 2000, replacementFees: 50000 },
    truncated: false,
  });
});

describe('ReturnReportPage', () => {
  it('menampilkan eksemplar yang kembali beserta kondisi, denda, dan ringkasan', async () => {
    const html = await render({ dari: '2090-03-02', sampai: '2090-03-02' });

    expect(mockReturnReport).toHaveBeenCalledWith({ from: '2090-03-02', to: '2090-03-02', className: '' });
    expect(html).toContain('Laporan Pengembalian');
    expect(html).toContain('02/03/2090 09.00');
    expect(html).toContain('href="/transaksi/riwayat/l1"');
    expect(html).toContain('BK-000001');
    expect(html).toContain('Pemrograman Web');
    expect(html).toContain('Rusak');
    expect(html).toContain('Rp2.000');
    expect(html).toContain('Rp50.000');
    expect(html).toContain('Buku kembali');
    expect(html).toContain('Rusak / hilang');
    expect(html).toContain('1 / 0');
  });

  it('menampilkan pesan kosong dan pemberitahuan pemotongan', async () => {
    mockReturnReport.mockResolvedValueOnce({
      rows: [], summary: { copies: 0, good: 0, damaged: 0, lost: 0, lateFines: 0, replacementFees: 0 }, truncated: true,
    });

    const html = await render();

    expect(html).toContain('Tidak ada pengembalian pada periode ini.');
    expect(html).toContain('Laporan ini memuat lebih dari 1.000 baris');
  });

  it('tidak membaca laporan tanpa sesi', async () => {
    mockRequireProfile.mockRejectedValueOnce(new Error('NEXT_REDIRECT'));
    await expect(render()).rejects.toThrow('NEXT_REDIRECT');
    expect(mockReturnReport).not.toHaveBeenCalled();
  });
});
```

Kartu "Rusak / hilang" menampilkan `rusak / hilang`: ringkasan `damaged: 1, lost: 0` menjadi `1 / 0`.

- [ ] **Step 6: Jalankan uji dan pastikan gagal**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test -- laporan/pengembalian
```

Harapan: FAIL dengan "Failed to resolve import './page'".

- [ ] **Step 7: Tulis halaman laporan pengembalian**

Buat `src/app/(app)/laporan/pengembalian/page.tsx`:

```tsx
import Link from 'next/link';
import { ReportFilters, ReportHeader, ReportNotice, SummaryGrid } from '@/components/reports/report-parts';
import { ScrollTable } from '@/components/ui/scroll-table';
import { TD, TH } from '@/components/ui/table-styles';
import { RETURN_CONDITION_LABELS } from '@/lib/circulation-labels';
import { formatRupiah } from '@/lib/format';
import { formatPeriod, parseReportPeriod, TRUNCATED_MESSAGE } from '@/lib/report-period';
import { formatSchoolDateTime, schoolToday } from '@/lib/school-date';
import { firstValue, type SearchParams } from '@/lib/search-params';
import { requireProfile } from '@/server/auth/guard';
import { listReportClassOptions, returnReport } from '@/server/queries/reports';
import { getLibrarySettings } from '@/server/queries/settings';

function money(amount: number): string {
  return amount > 0 ? formatRupiah(amount) : '—';
}

export default async function ReturnReportPage({ searchParams }: { searchParams: SearchParams }) {
  await requireProfile();
  const params = await searchParams;
  const periodResult = parseReportPeriod({ dari: firstValue(params.dari), sampai: firstValue(params.sampai) }, schoolToday());
  const { period } = periodResult;
  const className = firstValue(params.kelas).trim();

  const [report, classOptions, settings] = await Promise.all([
    returnReport({ from: period.from, to: period.to, className }),
    listReportClassOptions(),
    getLibrarySettings(),
  ]);
  const { summary } = report;

  return (
    <>
      <ReportHeader
        schoolName={settings.schoolName?.trim() || 'Perpustakaan Sekolah'}
        title="Laporan Pengembalian"
        description="Eksemplar yang kembali menurut tanggal kembali (WIB), dengan kondisi, denda telat, dan biaya ganti."
        period={`Periode ${formatPeriod(period)}${className ? ` · Kelas ${className}` : ''}`}
      />
      <ReportFilters from={period.from} to={period.to} className={className} classOptions={classOptions} />
      <ReportNotice message={periodResult.ok ? null : periodResult.message} />
      <ReportNotice message={report.truncated ? TRUNCATED_MESSAGE : null} />
      <SummaryGrid
        items={[
          { label: 'Buku kembali', value: summary.copies.toLocaleString('id-ID') },
          { label: 'Rusak / hilang', value: `${summary.damaged} / ${summary.lost}` },
          { label: 'Denda telat', value: formatRupiah(summary.lateFines) },
          { label: 'Biaya ganti', value: formatRupiah(summary.replacementFees) },
        ]}
      />

      <ScrollTable>
        <thead>
          <tr>
            <th className={TH}>Waktu Kembali</th>
            <th className={TH}>No. Transaksi</th>
            <th className={TH}>Siswa</th>
            <th className={TH}>Kelas</th>
            <th className={TH}>Buku</th>
            <th className={TH}>Kondisi</th>
            <th className={TH}>Telat</th>
            <th className={TH}>Denda Telat</th>
            <th className={TH}>Biaya Ganti</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.length === 0 && (
            <tr>
              <td colSpan={9} className={`${TD} text-center text-[var(--color-ink-500)]`}>Tidak ada pengembalian pada periode ini.</td>
            </tr>
          )}
          {report.rows.map((row) => (
            <tr key={row.id}>
              <td className={`${TD} whitespace-nowrap`}>{formatSchoolDateTime(row.returnedAt)}</td>
              <td className={TD}>
                <Link href={`/transaksi/riwayat/${row.loanId}`} className="font-mono text-[var(--color-accent-600)] hover:underline">
                  {row.transactionNumber}
                </Link>
              </td>
              <td className={TD}>
                {row.studentName}
                <span className="block font-mono text-xs text-[var(--color-ink-500)]">{row.studentNis}</span>
              </td>
              <td className={TD}>{row.studentClass}</td>
              <td className={TD}>
                {row.bookTitle}
                <span className="block font-mono text-xs text-[var(--color-ink-500)]">{row.barcode}</span>
              </td>
              <td className={TD}>{row.condition ? RETURN_CONDITION_LABELS[row.condition] : '—'}</td>
              <td className={`${TD} tabular`}>{row.daysLate > 0 ? `${row.daysLate} hari` : '—'}</td>
              <td className={`${TD} tabular`}>{money(row.lateFine)}</td>
              <td className={`${TD} tabular`}>{money(row.replacementFee)}</td>
            </tr>
          ))}
        </tbody>
      </ScrollTable>
    </>
  );
}
```

- [ ] **Step 8: Jalankan uji dan pastikan lulus, lalu commit**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test -- laporan/pengembalian && npm test && npm run test:integration -- tests/integration/reports.test.ts && npm run lint && npx tsc --noEmit
```

Harapan: seluruhnya lulus.

```bash
git add src/server/queries/reports.ts tests/integration/reports.test.ts "src/app/(app)/laporan/pengembalian"
git commit -F - <<'EOF'
feat(laporan): laporan pengembalian menurut tanggal WIB dengan kondisi dan denda

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

## Task 4: Laporan Keterlambatan

Keterlambatan selalu "per hari ini": eksemplar yang belum kembali dari pinjaman yang lewat jatuh tempo. Perkiraan denda memakai tarif denda saat ini; denda sesungguhnya baru dihitung dan dicatat saat pengembalian (spec §5.3).

**Files:**
- Modify: `src/server/queries/reports.ts` (+ `overdueReport`)
- Modify: `tests/integration/reports.test.ts`
- Create: `src/app/(app)/laporan/keterlambatan/page.tsx`, `page.test.tsx`

**Interfaces:**
- Consumes: `REPORT_ROW_LIMIT`, `TRUNCATED_MESSAGE`, komponen laporan, `listReportClassOptions` (Task 1); `getLibrarySettings` (`finePerDay`, `schoolName`); `schoolToday`; `formatDate`, `formatRupiah`; `diffDays`
- Produces:
  - `interface OverdueReportRow { id: string; loanId: string; transactionNumber: string; studentName: string; studentNis: string; studentClass: string; barcode: string; bookTitle: string; dueDate: string; daysLate: number; estimatedFine: number }`
  - `interface OverdueReportSummary { students: number; copies: number; estimatedFines: number }`
  - `overdueReport(filter: { className: string }, today: IsoDate, finePerDay: number, executor?, limit?): Promise<{ rows: OverdueReportRow[]; summary: OverdueReportSummary; truncated: boolean }>`
  - Rute `/laporan/keterlambatan`

Seluruh pinjaman terbuka sungguhan di database cloud jatuh tempo sebelum 2090, jadi relatif terhadap hari uji 2090 semuanya terlambat. Uji integrasi karenanya **selalu** menyaring kelas uji (`XI UJI 1`/`XI UJI 2`).

- [ ] **Step 1: Tulis uji integrasi yang gagal**

Tambahkan di `tests/integration/reports.test.ts` (impor `overdueReport`):

```ts
describe('overdueReport', () => {
  it('mendaftar eksemplar belum kembali yang lewat jatuh tempo, paling lama di atas, dengan perkiraan denda', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx, { copies: 5 });
      const old = await seedLoan(tx, fx, { student: 0, copies: [0, 1], loanDate: '2090-02-20', dueDate: '2090-02-23', returned: [1] });
      const recent = await seedLoan(tx, fx, { student: 0, copies: [2], loanDate: '2090-02-27', dueDate: '2090-03-02' });
      // Jatuh tempo hari ini: belum terlambat.
      await seedLoan(tx, fx, { student: 0, copies: [3], loanDate: '2090-03-03', dueDate: '2090-03-06' });
      // Kelas lain: tersaring.
      await seedLoan(tx, fx, { student: 1, copies: [4], loanDate: '2090-02-20', dueDate: '2090-02-23' });

      const report = await overdueReport({ className: 'XI UJI 1' }, '2090-03-06', 1000, tx);

      expect(report.truncated).toBe(false);
      expect(report.rows).toEqual([
        {
          id: expect.any(String), loanId: old.id, transactionNumber: old.transactionNumber, studentName: 'UJI Siswa Satu',
          studentNis: 'UJI-S1', studentClass: 'XI UJI 1', barcode: 'UJI-SRK-01', bookTitle: 'UJI-Buku Sirkulasi',
          dueDate: '2090-02-23', daysLate: 11, estimatedFine: 11000,
        },
        {
          id: expect.any(String), loanId: recent.id, transactionNumber: recent.transactionNumber, studentName: 'UJI Siswa Satu',
          studentNis: 'UJI-S1', studentClass: 'XI UJI 1', barcode: 'UJI-SRK-03', bookTitle: 'UJI-Buku Sirkulasi',
          dueDate: '2090-03-02', daysLate: 4, estimatedFine: 4000,
        },
      ]);
      expect(report.summary).toEqual({ students: 1, copies: 2, estimatedFines: 15000 });
    });
  });

  it('memotong baris di batas tetapi ringkasan tetap menghitung seluruhnya', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx, { copies: 2 });
      await seedLoan(tx, fx, { student: 0, copies: [0, 1], loanDate: '2090-02-20', dueDate: '2090-02-23' });

      const report = await overdueReport({ className: 'XI UJI 1' }, '2090-03-06', 500, tx, 1);

      expect(report.truncated).toBe(true);
      expect(report.rows).toHaveLength(1);
      expect(report.summary).toEqual({ students: 1, copies: 2, estimatedFines: 11000 });
    });
  });
});
```

Perhitungan: 23/02 → 06/03/2090 = 11 hari (2090 bukan tahun kabisat); 02/03 → 06/03 = 4 hari. Uji kedua: dua eksemplar × 11 hari × Rp500 = Rp11.000.

- [ ] **Step 2: Jalankan uji dan pastikan gagal**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm run test:integration -- tests/integration/reports.test.ts
```

Harapan: FAIL, `overdueReport` belum diekspor.

- [ ] **Step 3: Tulis `overdueReport`**

Tambahkan ke `src/server/queries/reports.ts` (gabungkan impor: `isNull`, `lt`, `ne` dari `drizzle-orm`):

```ts
export interface OverdueReportRow {
  id: string;
  loanId: string;
  transactionNumber: string;
  studentName: string;
  studentNis: string;
  studentClass: string;
  barcode: string;
  bookTitle: string;
  dueDate: string;
  daysLate: number;
  estimatedFine: number;
}

export interface OverdueReportSummary {
  students: number;
  copies: number;
  estimatedFines: number;
}

/**
 * Eksemplar yang belum kembali dari pinjaman lewat jatuh tempo, per hari ini
 * (spec §4.2: keterlambatan dihitung saat dibaca). Perkiraan denda memakai
 * tarif saat ini; denda sesungguhnya dicatat saat pengembalian.
 */
export async function overdueReport(
  filter: { className: string },
  today: IsoDate,
  finePerDay: number,
  executor: Executor = db,
  limit: number = REPORT_ROW_LIMIT,
): Promise<{ rows: OverdueReportRow[]; summary: OverdueReportSummary; truncated: boolean }> {
  const where = and(
    isNull(loanItems.returnedAt),
    ne(loans.status, 'SELESAI'),
    lt(loans.dueDate, today),
    filter.className ? eq(loans.studentClass, filter.className) : undefined,
  );

  const rows = await executor
    .select({
      id: loanItems.id,
      loanId: loans.id,
      transactionNumber: loans.transactionNumber,
      studentName: students.name,
      studentNis: students.nis,
      studentClass: loans.studentClass,
      barcode: bookCopies.barcode,
      bookTitle: books.title,
      dueDate: loans.dueDate,
    })
    .from(loanItems)
    .innerJoin(loans, eq(loans.id, loanItems.loanId))
    .innerJoin(students, eq(students.id, loans.studentId))
    .innerJoin(bookCopies, eq(bookCopies.id, loanItems.bookCopyId))
    .innerJoin(books, eq(books.id, bookCopies.bookId))
    .where(where)
    .orderBy(asc(loans.dueDate), asc(students.name), asc(bookCopies.barcode))
    .limit(limit + 1);

  const [summary] = await executor
    .select({
      students: sql<number>`count(distinct ${loans.studentId})::int`,
      copies: sql<number>`count(*)::int`,
      totalDays: sql<number>`coalesce(sum(${today}::date - ${loans.dueDate}), 0)::int`,
    })
    .from(loanItems)
    .innerJoin(loans, eq(loans.id, loanItems.loanId))
    .where(where);

  return {
    rows: rows.slice(0, limit).map((row) => {
      const daysLate = diffDays(row.dueDate, today);
      return { ...row, daysLate, estimatedFine: daysLate * finePerDay };
    }),
    summary: {
      students: Number(summary?.students ?? 0),
      copies: Number(summary?.copies ?? 0),
      estimatedFines: Number(summary?.totalDays ?? 0) * finePerDay,
    },
    truncated: rows.length > limit,
  };
}
```

- [ ] **Step 4: Jalankan uji dan pastikan lulus**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm run test:integration -- tests/integration/reports.test.ts
```

Harapan: PASS.

- [ ] **Step 5: Tulis uji halaman yang gagal**

Buat `src/app/(app)/laporan/keterlambatan/page.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockOverdueReport, mockClassOptions, mockSettings, mockRequireProfile } = vi.hoisted(() => ({
  mockOverdueReport: vi.fn(),
  mockClassOptions: vi.fn(),
  mockSettings: vi.fn(),
  mockRequireProfile: vi.fn(),
}));

vi.mock('@/server/queries/reports', () => ({ overdueReport: mockOverdueReport, listReportClassOptions: mockClassOptions }));
vi.mock('@/server/queries/settings', () => ({ getLibrarySettings: mockSettings }));
vi.mock('@/server/auth/guard', () => ({ requireProfile: mockRequireProfile }));
vi.mock('@/lib/school-date', () => ({ schoolToday: () => '2090-03-06', formatSchoolDateTime: () => '06/03/2090 10.00' }));

import OverdueReportPage from './page';

const row = {
  id: 'i1', loanId: 'l1', transactionNumber: 'PJM-20900220-0001', studentName: 'Ahmad Fauzi', studentNis: '202600123',
  studentClass: 'XI RPL 1', barcode: 'BK-000001', bookTitle: 'Pemrograman Web', dueDate: '2090-02-23', daysLate: 11,
  estimatedFine: 11000,
};

async function render(params: Record<string, string> = {}) {
  return renderToStaticMarkup(await OverdueReportPage({ searchParams: Promise.resolve(params) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireProfile.mockResolvedValue({ id: 'u1', role: 'admin', fullName: 'Admin', status: 'active' });
  mockClassOptions.mockResolvedValue([{ value: 'XI RPL 1', label: 'XI RPL 1' }]);
  mockSettings.mockResolvedValue({ schoolName: 'SMK Negeri 1 Contoh', receiptFooter: null, finePerDay: 1000 });
  mockOverdueReport.mockResolvedValue({ rows: [row], summary: { students: 1, copies: 1, estimatedFines: 11000 }, truncated: false });
});

describe('OverdueReportPage', () => {
  it('menampilkan keterlambatan per hari ini dengan tarif denda saat ini', async () => {
    const html = await render({ kelas: 'XI RPL 1' });

    expect(mockOverdueReport).toHaveBeenCalledWith({ className: 'XI RPL 1' }, '2090-03-06', 1000);
    expect(html).toContain('Laporan Keterlambatan');
    expect(html).toContain('Per 06/03/2090 · Kelas XI RPL 1');
    expect(html).not.toContain('name="dari"');
    expect(html).toContain('href="/transaksi/riwayat/l1"');
    expect(html).toContain('Ahmad Fauzi');
    expect(html).toContain('23/02/2090');
    expect(html).toContain('11 hari');
    expect(html).toContain('Rp11.000');
    expect(html).toContain('tarif Rp1.000 per hari');
  });

  it('menampilkan pesan bila tidak ada yang terlambat', async () => {
    mockOverdueReport.mockResolvedValueOnce({ rows: [], summary: { students: 0, copies: 0, estimatedFines: 0 }, truncated: false });
    expect(await render()).toContain('Tidak ada buku yang terlambat dikembalikan.');
  });

  it('tidak membaca laporan tanpa sesi', async () => {
    mockRequireProfile.mockRejectedValueOnce(new Error('NEXT_REDIRECT'));
    await expect(render()).rejects.toThrow('NEXT_REDIRECT');
    expect(mockOverdueReport).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Jalankan uji dan pastikan gagal**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test -- laporan/keterlambatan
```

Harapan: FAIL dengan "Failed to resolve import './page'".

- [ ] **Step 7: Tulis halaman keterlambatan**

Buat `src/app/(app)/laporan/keterlambatan/page.tsx`:

```tsx
import Link from 'next/link';
import { ReportFilters, ReportHeader, ReportNotice, SummaryGrid } from '@/components/reports/report-parts';
import { ScrollTable } from '@/components/ui/scroll-table';
import { TD, TH } from '@/components/ui/table-styles';
import { formatDate, formatRupiah } from '@/lib/format';
import { TRUNCATED_MESSAGE } from '@/lib/report-period';
import { schoolToday } from '@/lib/school-date';
import { firstValue, type SearchParams } from '@/lib/search-params';
import { requireProfile } from '@/server/auth/guard';
import { listReportClassOptions, overdueReport } from '@/server/queries/reports';
import { getLibrarySettings } from '@/server/queries/settings';

export default async function OverdueReportPage({ searchParams }: { searchParams: SearchParams }) {
  await requireProfile();
  const params = await searchParams;
  const today = schoolToday();
  const className = firstValue(params.kelas).trim();

  const [settings, classOptions] = await Promise.all([getLibrarySettings(), listReportClassOptions()]);
  const report = await overdueReport({ className }, today, settings.finePerDay);
  const { summary } = report;

  return (
    <>
      <ReportHeader
        schoolName={settings.schoolName?.trim() || 'Perpustakaan Sekolah'}
        title="Laporan Keterlambatan"
        description={`Buku yang belum kembali dan sudah lewat jatuh tempo per hari ini. Perkiraan denda memakai tarif ${formatRupiah(settings.finePerDay)} per hari; denda sesungguhnya dihitung saat pengembalian.`}
        period={`Per ${formatDate(today)}${className ? ` · Kelas ${className}` : ''}`}
      />
      <ReportFilters className={className} classOptions={classOptions} />
      <ReportNotice message={report.truncated ? TRUNCATED_MESSAGE : null} />
      <SummaryGrid
        items={[
          { label: 'Siswa terlambat', value: summary.students.toLocaleString('id-ID') },
          { label: 'Buku terlambat', value: summary.copies.toLocaleString('id-ID') },
          { label: 'Perkiraan denda', value: formatRupiah(summary.estimatedFines) },
        ]}
      />
      <p className="mb-4 text-sm text-[var(--color-ink-500)] print:hidden">
        Per {formatDate(today)}, tarif {formatRupiah(settings.finePerDay)} per hari.
      </p>

      <ScrollTable>
        <thead>
          <tr>
            <th className={TH}>Siswa</th>
            <th className={TH}>Kelas</th>
            <th className={TH}>No. Transaksi</th>
            <th className={TH}>Buku</th>
            <th className={TH}>Jatuh Tempo</th>
            <th className={TH}>Telat</th>
            <th className={TH}>Perkiraan Denda</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.length === 0 && (
            <tr>
              <td colSpan={7} className={`${TD} text-center text-[var(--color-ink-500)]`}>Tidak ada buku yang terlambat dikembalikan.</td>
            </tr>
          )}
          {report.rows.map((row) => (
            <tr key={row.id}>
              <td className={TD}>
                {row.studentName}
                <span className="block font-mono text-xs text-[var(--color-ink-500)]">{row.studentNis}</span>
              </td>
              <td className={TD}>{row.studentClass}</td>
              <td className={TD}>
                <Link href={`/transaksi/riwayat/${row.loanId}`} className="font-mono text-[var(--color-accent-600)] hover:underline">
                  {row.transactionNumber}
                </Link>
              </td>
              <td className={TD}>
                {row.bookTitle}
                <span className="block font-mono text-xs text-[var(--color-ink-500)]">{row.barcode}</span>
              </td>
              <td className={TD}>{formatDate(row.dueDate)}</td>
              <td className={`${TD} tabular text-[var(--color-status-terlambat)]`}>{row.daysLate} hari</td>
              <td className={`${TD} tabular`}>{formatRupiah(row.estimatedFine)}</td>
            </tr>
          ))}
        </tbody>
      </ScrollTable>
    </>
  );
}
```

Uji halaman mengharapkan `'tarif Rp1.000 per hari'`: teks itu muncul di paragraf "Per …, tarif Rp1.000 per hari." dan di deskripsi.

- [ ] **Step 8: Jalankan uji dan pastikan lulus, lalu commit**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test -- laporan && npm test && npm run test:integration -- tests/integration/reports.test.ts && npm run lint && npx tsc --noEmit
```

Harapan: seluruhnya lulus.

```bash
git add src/server/queries/reports.ts tests/integration/reports.test.ts "src/app/(app)/laporan/keterlambatan"
git commit -F - <<'EOF'
feat(laporan): laporan keterlambatan per hari ini dengan perkiraan denda

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

## Task 5: Laporan Koleksi Buku

Per judul aktif: jumlah eksemplar per status. Total tidak menghitung eksemplar `NONAKTIF` (sama dengan kartu "Total Buku" di dashboard Rencana 05), tetapi kolom Nonaktif tetap ditampilkan.

**Files:**
- Modify: `src/server/queries/reports.ts` (+ `collectionReport`)
- Modify: `tests/integration/reports.test.ts`
- Create: `src/app/(app)/laporan/koleksi/page.tsx`, `page.test.tsx`

**Interfaces:**
- Consumes: `REPORT_ROW_LIMIT`, `TRUNCATED_MESSAGE`, komponen laporan (Task 1); `listCategoryOptions` (`src/server/queries/categories.ts`); `containsPattern` (`src/server/queries/like.ts`); `isUuid`; `FilterSelect`; `getLibrarySettings`; `schoolToday`; `formatDate`
- Produces:
  - `interface CollectionReportRow { id: string; title: string; author: string; categoryName: string | null; rackCode: string | null; available: number; borrowed: number; damaged: number; lost: number; inactive: number; total: number }`
  - `interface CollectionReportSummary { titles: number; total: number; available: number; borrowed: number; damaged: number; lost: number }`
  - `collectionReport(filter: { q: string; categoryId: string }, executor?, limit?): Promise<{ rows: CollectionReportRow[]; summary: CollectionReportSummary; truncated: boolean }>`
  - Rute `/laporan/koleksi`

- [ ] **Step 1: Tulis uji integrasi yang gagal**

Tambahkan di `tests/integration/reports.test.ts` (impor `bookCopies`, `books` dari skema dan `collectionReport` dari query):

```ts
describe('collectionReport', () => {
  it('menghitung eksemplar per status untuk tiap judul aktif; total tanpa yang nonaktif', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx, { copies: 5 });
      const statuses = ['TERSEDIA', 'DIPINJAM', 'RUSAK', 'HILANG', 'NONAKTIF'] as const;
      for (const [index, status] of statuses.entries()) {
        await tx.update(bookCopies).set({ status }).where(eq(bookCopies.id, fx.copies[index].id));
      }

      const report = await collectionReport({ q: 'UJI-Buku', categoryId: '' }, tx);

      expect(report.truncated).toBe(false);
      expect(report.rows).toEqual([{
        id: fx.bookId, title: 'UJI-Buku Sirkulasi', author: 'UJI-Penulis', categoryName: null, rackCode: 'UJI-R1',
        available: 1, borrowed: 1, damaged: 1, lost: 1, inactive: 1, total: 4,
      }]);
      expect(report.summary).toEqual({ titles: 1, total: 4, available: 1, borrowed: 1, damaged: 1, lost: 1 });
    });
  });

  it('melewatkan judul nonaktif, mencari penulis juga, dan memotong baris di batas', async () => {
    await withRollback(async (tx) => {
      await circulationFixture(tx, { copies: 1 });
      await tx.insert(books).values([
        { title: 'UJI-Buku Kedua', author: 'UJI-Penulis', price: '0' },
        { title: 'UJI-Buku Nonaktif', author: 'UJI-Penulis', price: '0', status: 'inactive' },
      ]);

      const report = await collectionReport({ q: 'UJI-Penulis', categoryId: '' }, tx, 1);

      expect(report.truncated).toBe(true);
      expect(report.rows.map((row) => row.title)).toEqual(['UJI-Buku Kedua']);
      expect(report.summary.titles).toBe(2);
      expect(report.summary.total).toBe(1);
    });
  });
});
```

Judul baru tanpa eksemplar tetap terdaftar dengan angka 0. Urutannya abjad: "UJI-Buku Kedua" sebelum "UJI-Buku Sirkulasi".

- [ ] **Step 2: Jalankan uji dan pastikan gagal**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm run test:integration -- tests/integration/reports.test.ts
```

Harapan: FAIL, `collectionReport` belum diekspor.

- [ ] **Step 3: Tulis `collectionReport`**

Tambahkan ke `src/server/queries/reports.ts` (gabungkan impor: `ilike`, `or` dari `drizzle-orm`; `categories`, `racks` dari skema; `containsPattern` dari `./like`; `isUuid` dari `@/server/validation/common`):

```ts
export interface CollectionReportRow {
  id: string;
  title: string;
  author: string;
  categoryName: string | null;
  rackCode: string | null;
  available: number;
  borrowed: number;
  damaged: number;
  lost: number;
  inactive: number;
  /** Eksemplar yang tidak NONAKTIF, sama dengan "Total Buku" di dashboard. */
  total: number;
}

export interface CollectionReportSummary {
  titles: number;
  total: number;
  available: number;
  borrowed: number;
  damaged: number;
  lost: number;
}

function countStatus(status: string) {
  return sql<number>`(count(${bookCopies.id}) filter (where ${bookCopies.status} = ${status}))::int`;
}

/** Judul aktif beserta jumlah eksemplarnya per status. */
export async function collectionReport(
  filter: { q: string; categoryId: string },
  executor: Executor = db,
  limit: number = REPORT_ROW_LIMIT,
): Promise<{ rows: CollectionReportRow[]; summary: CollectionReportSummary; truncated: boolean }> {
  const keyword = filter.q.trim();
  const where = and(
    eq(books.status, 'active'),
    keyword ? or(ilike(books.title, containsPattern(keyword)), ilike(books.author, containsPattern(keyword))) : undefined,
    filter.categoryId && isUuid(filter.categoryId) ? eq(books.categoryId, filter.categoryId) : undefined,
  );

  const rows = await executor
    .select({
      id: books.id,
      title: books.title,
      author: books.author,
      categoryName: categories.name,
      rackCode: racks.code,
      available: countStatus('TERSEDIA'),
      borrowed: countStatus('DIPINJAM'),
      damaged: countStatus('RUSAK'),
      lost: countStatus('HILANG'),
      inactive: countStatus('NONAKTIF'),
      total: sql<number>`(count(${bookCopies.id}) filter (where ${bookCopies.status} <> 'NONAKTIF'))::int`,
    })
    .from(books)
    .leftJoin(categories, eq(categories.id, books.categoryId))
    .leftJoin(racks, eq(racks.id, books.rackId))
    .leftJoin(bookCopies, eq(bookCopies.bookId, books.id))
    .where(where)
    .groupBy(books.id, categories.name, racks.code)
    .orderBy(asc(books.title), asc(books.id))
    .limit(limit + 1);

  const [summary] = await executor
    .select({
      titles: sql<number>`count(distinct ${books.id})::int`,
      total: sql<number>`(count(${bookCopies.id}) filter (where ${bookCopies.status} <> 'NONAKTIF'))::int`,
      available: countStatus('TERSEDIA'),
      borrowed: countStatus('DIPINJAM'),
      damaged: countStatus('RUSAK'),
      lost: countStatus('HILANG'),
    })
    .from(books)
    .leftJoin(bookCopies, eq(bookCopies.bookId, books.id))
    .where(where);

  return {
    rows: rows.slice(0, limit).map((row) => ({
      ...row,
      available: Number(row.available),
      borrowed: Number(row.borrowed),
      damaged: Number(row.damaged),
      lost: Number(row.lost),
      inactive: Number(row.inactive),
      total: Number(row.total),
    })),
    summary: {
      titles: Number(summary?.titles ?? 0),
      total: Number(summary?.total ?? 0),
      available: Number(summary?.available ?? 0),
      borrowed: Number(summary?.borrowed ?? 0),
      damaged: Number(summary?.damaged ?? 0),
      lost: Number(summary?.lost ?? 0),
    },
    truncated: rows.length > limit,
  };
}
```

Catatan untuk pelaksana:
- `countStatus` membangun `sql` yang merujuk dua tabel dalam kueri JOIN, sehingga kolomnya ditulis lengkap dengan nama tabel. Tidak ada subquery berkorelasi.

- [ ] **Step 4: Jalankan uji dan pastikan lulus**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm run test:integration -- tests/integration/reports.test.ts
```

Harapan: PASS.

- [ ] **Step 5: Tulis uji halaman yang gagal**

Buat `src/app/(app)/laporan/koleksi/page.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockCollection, mockCategories, mockSettings, mockRequireProfile } = vi.hoisted(() => ({
  mockCollection: vi.fn(),
  mockCategories: vi.fn(),
  mockSettings: vi.fn(),
  mockRequireProfile: vi.fn(),
}));

vi.mock('@/server/queries/reports', () => ({ collectionReport: mockCollection }));
vi.mock('@/server/queries/categories', () => ({ listCategoryOptions: mockCategories }));
vi.mock('@/server/queries/settings', () => ({ getLibrarySettings: mockSettings }));
vi.mock('@/server/auth/guard', () => ({ requireProfile: mockRequireProfile }));
vi.mock('@/lib/school-date', () => ({ schoolToday: () => '2090-03-06', formatSchoolDateTime: () => '06/03/2090 10.00' }));

import CollectionReportPage from './page';

const row = {
  id: 'b1', title: 'Pemrograman Web', author: 'Budi Raharjo', categoryName: 'Teknologi', rackCode: 'A-3',
  available: 3, borrowed: 2, damaged: 1, lost: 0, inactive: 1, total: 6,
};

async function render(params: Record<string, string> = {}) {
  return renderToStaticMarkup(await CollectionReportPage({ searchParams: Promise.resolve(params) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireProfile.mockResolvedValue({ id: 'u1', role: 'admin', fullName: 'Admin', status: 'active' });
  mockCategories.mockResolvedValue([{ value: 'c1', label: 'Teknologi' }]);
  mockSettings.mockResolvedValue({ schoolName: 'SMK Negeri 1 Contoh', receiptFooter: null });
  mockCollection.mockResolvedValue({
    rows: [row], summary: { titles: 1, total: 6, available: 3, borrowed: 2, damaged: 1, lost: 0 }, truncated: false,
  });
});

describe('CollectionReportPage', () => {
  it('menampilkan eksemplar per status tiap judul, dengan filter kata kunci dan kategori', async () => {
    const html = await render({ q: 'web', kategori: 'c1' });

    expect(mockCollection).toHaveBeenCalledWith({ q: 'web', categoryId: 'c1' });
    expect(html).toContain('Laporan Koleksi Buku');
    expect(html).toContain('Per 06/03/2090 · Kategori Teknologi');
    expect(html).toContain('name="q"');
    expect(html).toContain('name="kategori"');
    expect(html).toContain('Semua kategori');
    expect(html).toContain('href="/master/buku/b1"');
    expect(html).toContain('Pemrograman Web');
    expect(html).toContain('Budi Raharjo');
    expect(html).toContain('A-3');
    expect(html).toContain('Judul');
    expect(html).toContain('Rusak / hilang');
  });

  it('menampilkan pesan kosong', async () => {
    mockCollection.mockResolvedValueOnce({
      rows: [], summary: { titles: 0, total: 0, available: 0, borrowed: 0, damaged: 0, lost: 0 }, truncated: false,
    });
    expect(await render()).toContain('Tidak ada judul yang cocok.');
  });

  it('tidak membaca laporan tanpa sesi', async () => {
    mockRequireProfile.mockRejectedValueOnce(new Error('NEXT_REDIRECT'));
    await expect(render()).rejects.toThrow('NEXT_REDIRECT');
    expect(mockCollection).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Jalankan uji dan pastikan gagal**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test -- laporan/koleksi
```

Harapan: FAIL dengan "Failed to resolve import './page'".

- [ ] **Step 7: Tulis halaman laporan koleksi**

Buat `src/app/(app)/laporan/koleksi/page.tsx`:

```tsx
import Link from 'next/link';
import { ReportHeader, ReportNotice, SummaryGrid } from '@/components/reports/report-parts';
import { buttonClass } from '@/components/ui/button-styles';
import { ScrollTable } from '@/components/ui/scroll-table';
import { TD, TH } from '@/components/ui/table-styles';
import { formatDate } from '@/lib/format';
import { TRUNCATED_MESSAGE } from '@/lib/report-period';
import { schoolToday } from '@/lib/school-date';
import { firstValue, type SearchParams } from '@/lib/search-params';
import { requireProfile } from '@/server/auth/guard';
import { listCategoryOptions } from '@/server/queries/categories';
import { collectionReport } from '@/server/queries/reports';
import { getLibrarySettings } from '@/server/queries/settings';

const CONTROL = 'rounded-md border border-[var(--color-ink-300)] bg-white px-3 py-2 text-sm';
const NUMBER = `${TD} tabular text-right`;

function count(value: number): string {
  return value.toLocaleString('id-ID');
}

export default async function CollectionReportPage({ searchParams }: { searchParams: SearchParams }) {
  await requireProfile();
  const params = await searchParams;
  const q = firstValue(params.q).trim();
  const categoryId = firstValue(params.kategori).trim();

  const [report, categoryOptions, settings] = await Promise.all([
    collectionReport({ q, categoryId }),
    listCategoryOptions(),
    getLibrarySettings(),
  ]);
  const { summary } = report;
  const categoryLabel = categoryOptions.find((option) => option.value === categoryId)?.label;
  const scope = [`Per ${formatDate(schoolToday())}`, categoryLabel && `Kategori ${categoryLabel}`, q && `Kata kunci "${q}"`]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <ReportHeader
        schoolName={settings.schoolName?.trim() || 'Perpustakaan Sekolah'}
        title="Laporan Koleksi Buku"
        description="Judul aktif dan jumlah eksemplarnya per status. Total tidak menghitung eksemplar nonaktif."
        period={scope}
      />
      <form className="mb-4 flex flex-wrap items-end gap-2 print:hidden">
        <label className="text-sm">
          <span className="mb-1 block text-[var(--color-ink-700)]">Judul atau penulis</span>
          <input type="search" name="q" defaultValue={q} className={`${CONTROL} min-w-64`} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-[var(--color-ink-700)]">Kategori</span>
          <select name="kategori" defaultValue={categoryId} className={CONTROL}>
            <option value="">Semua kategori</option>
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <button type="submit" className={buttonClass('secondary')}>Tampilkan</button>
      </form>
      <ReportNotice message={report.truncated ? TRUNCATED_MESSAGE : null} />
      <SummaryGrid
        items={[
          { label: 'Judul', value: count(summary.titles) },
          { label: 'Eksemplar', value: count(summary.total) },
          { label: 'Tersedia / dipinjam', value: `${count(summary.available)} / ${count(summary.borrowed)}` },
          { label: 'Rusak / hilang', value: `${count(summary.damaged)} / ${count(summary.lost)}` },
        ]}
      />

      <ScrollTable>
        <thead>
          <tr>
            <th className={TH}>Judul</th>
            <th className={TH}>Kategori</th>
            <th className={TH}>Rak</th>
            <th className={`${TH} text-right`}>Tersedia</th>
            <th className={`${TH} text-right`}>Dipinjam</th>
            <th className={`${TH} text-right`}>Rusak</th>
            <th className={`${TH} text-right`}>Hilang</th>
            <th className={`${TH} text-right`}>Nonaktif</th>
            <th className={`${TH} text-right`}>Total</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.length === 0 && (
            <tr>
              <td colSpan={9} className={`${TD} text-center text-[var(--color-ink-500)]`}>Tidak ada judul yang cocok.</td>
            </tr>
          )}
          {report.rows.map((row) => (
            <tr key={row.id}>
              <td className={TD}>
                <Link href={`/master/buku/${row.id}`} className="text-[var(--color-accent-600)] hover:underline">{row.title}</Link>
                <span className="block text-xs text-[var(--color-ink-500)]">{row.author}</span>
              </td>
              <td className={TD}>{row.categoryName ?? '—'}</td>
              <td className={TD}>{row.rackCode ?? '—'}</td>
              <td className={NUMBER}>{row.available}</td>
              <td className={NUMBER}>{row.borrowed}</td>
              <td className={NUMBER}>{row.damaged}</td>
              <td className={NUMBER}>{row.lost}</td>
              <td className={NUMBER}>{row.inactive}</td>
              <td className={`${NUMBER} font-semibold`}>{row.total}</td>
            </tr>
          ))}
        </tbody>
      </ScrollTable>
    </>
  );
}
```

`TRUNCATED_MESSAGE` menyebut "pilih satu kelas". Laporan koleksi tidak punya filter kelas, tetapi punya kata kunci dan kategori. Kalimat itu tetap dipakai apa adanya agar satu sumber pesan terjaga. Pemotongan di laporan koleksi baru terjadi bila ada lebih dari 1.000 judul aktif.

- [ ] **Step 8: Jalankan uji dan pastikan lulus, lalu commit**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test -- laporan/koleksi && npm test && npm run test:integration -- tests/integration/reports.test.ts && npm run lint && npx tsc --noEmit && npm run build
```

Harapan: seluruhnya lulus. `npm run build` mencantumkan keempat rute `/laporan/*`.

```bash
git add src/server/queries/reports.ts tests/integration/reports.test.ts "src/app/(app)/laporan/koleksi"
git commit -F - <<'EOF'
feat(laporan): laporan koleksi buku per judul dan status eksemplar

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

## Task 6: Verifikasi Akhir

Tidak ada kode baru. Laporan hanya membaca, jadi pemeriksaan ini **tidak menulis apa pun** ke database.

**Files:** tidak ada, selain pencentangan rencana di Step 5.

- [ ] **Step 1: Pemeriksaan otomatis**

```bash
export PATH="/d/nvm/nodejs:$PATH"
npm test
npm run test:integration
npm run lint
npx tsc --noEmit
npm run build
```

Harapan: seluruhnya lulus. `npm run build` mencantumkan `/laporan/peminjaman`, `/laporan/pengembalian`, `/laporan/keterlambatan`, `/laporan/koleksi`.

- [ ] **Step 2: Pastikan uji tidak meninggalkan jejak**

Pakai berkas sementara berimpor statis (`tmp-sisa.ts`), jalankan dengan `npx tsx --env-file=.env.local`, lalu hapus. Hitung baris uji yang tertinggal:
- `loans` dengan `transaction_number like 'UJI-%'`;
- `students` dengan `nis like 'UJI-%'`;
- `book_copies` dengan `barcode like 'UJI-%'`;
- `books` dengan `title like 'UJI-%'`;
- `academic_years` dengan `name like 'UJI-%'`.

Harapan: 0.

- [ ] **Step 3: Uji di peramban (hanya membaca)**

Pakai server dev yang sudah berjalan, atau jalankan `npm run dev`. Gunakan skill `/browse` dari gstack, bukan `mcp__claude-in-chrome__*`. Masuk sebagai `admin`/`perpus123`.

1. Menu Laporan → **Peminjaman**. Periode bawaan adalah tanggal 1 bulan ini sampai hari ini. Ubah "Dari tanggal" ke 01/09/2026, lalu Tampilkan: transaksi QA September (`PJM-20260925-…`, `PJM-20260926-…`) tampil. Ringkasan cocok dengan jumlah baris. Tautan nomor transaksi membuka detailnya.
2. Isi periode terbalik lewat URL (`?dari=2026-09-30&sampai=2026-09-01`): pesan "Periode terbalik…" tampil dan laporan memakai periode bawaan.
3. Filter kelas **XI QA**: hanya transaksi siswa QA.
4. **Pengembalian**, periode September 2026: pengembalian QA tampil dengan waktu kembali WIB, kondisi (termasuk BK-000001 "Rusak" Rp60.000 dari QA Rencana 04), dan ringkasan denda.
5. **Keterlambatan**: keterangan "Per <hari ini>" dan tarif denda tampil. Cocokkan jumlah bukunya dengan kueri baca-saja: eksemplar dengan `returned_at is null` dari pinjaman `status <> 'SELESAI'` dan `due_date < hari ini`.
6. **Koleksi Buku**: "Pemrograman Web" dan "Basis Data Lanjut" tampil dengan jumlah per status. Cocokkan total eksemplar dengan kartu "Total Buku" di dashboard.
7. Pratinjau cetak: jalankan `$B js "document.querySelector('style') && [...document.querySelectorAll('style')].map(s => s.textContent).find(t => t.includes('@page'))"` dan pastikan hasilnya `@page { size: A4 landscape; margin: 12mm; }`. Emulasikan media cetak bila `$B` mendukungnya, lalu ambil tangkapan layar. Sidebar, topbar, form filter, dan tombol "Cetak Laporan" tidak tampil; kop (nama sekolah, judul, periode, waktu cetak) tampil.
8. Lebar tablet (`$B viewport 768x1024`): kisi ringkasan dua kolom, tabel digulir di dalam kotaknya, dan halaman tidak melebar.

- [ ] **Step 4: Catat hasilnya**

Laporkan setiap langkah dengan LULUS/GAGAL beserta buktinya, jalur tangkapan layar, dan angka yang dicocokkan. Cetak ke printer sungguhan dilakukan pemilik produk; catat bahwa itu belum dilakukan.

- [ ] **Step 5: Tandai rencana selesai**

Ubah seluruh `- [ ]` di berkas rencana ini menjadi `- [x]`, lalu commit:

```bash
git add docs/superpowers/plans/2026-09-26-perpustakaan-06-laporan.md
git commit -F - <<'EOF'
docs: tandai Rencana 06 (Laporan) selesai

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

## Hasil Akhir Rencana 06

- Empat laporan di menu Laporan: Peminjaman, Pengembalian, Keterlambatan, Koleksi Buku. Tautan menu yang sebelumnya berujung "halaman tidak ditemukan" kini berfungsi.
- Peminjaman dan pengembalian disaring per periode (bawaan bulan berjalan) dan per kelas saat meminjam. Keterlambatan per hari ini dengan perkiraan denda. Koleksi per judul dan status eksemplar.
- Setiap laporan dapat dicetak A4 mendatar lewat tombol "Cetak Laporan", dengan kop sekolah dan tanpa sidebar, topbar, atau filter.
- Periode yang salah tidak menggagalkan halaman, dan laporan besar dipotong di 1.000 baris dengan ringkasan yang tetap utuh.

## Yang Sengaja Belum Ada

| Hal | Alasan |
|---|---|
| Ekspor PDF/Excel | Di luar lingkup (spec §2.2, §13). Cetak peramban dapat disimpan sebagai PDF lewat dialog cetak |
| Laporan denda per siswa, buku terpopuler | Belum diminta; dapat ditambah di atas `reports.ts` bila pemilik produk memerlukannya |
| Grafik | Tidak diminta; tabel dan ringkasan lebih mudah dicetak dan dicocokkan |
| Temuan tertunda Rencana 04–05b (misalnya deadlock langka `setUserStatus`, penangkapan galat jaringan di form pengembalian) | Tercatat di memori proyek. Laporan tidak menyentuh kode itu |
