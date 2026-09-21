# Design Spec — Sistem Peminjaman Buku Perpustakaan

**Tanggal:** 21 September 2026
**Status:** Disetujui untuk perencanaan implementasi
**Sumber kebutuhan:** `PRD_Sistem_Peminjaman_Buku_Perpustakaan.md` v1.0
**Cakupan:** MVP Phase 1

---

## 1. Ringkasan

Aplikasi web untuk petugas dan admin perpustakaan sekolah, memusatkan pencatatan peminjaman dan pengembalian buku beserta histori transaksinya.

Sasaran operasional yang mengikat desain ini: satu transaksi peminjaman normal selesai dalam **kurang dari 30 detik**, dan status setiap eksemplar buku **selalu** mencerminkan keadaan fisiknya.

### 1.1 Keputusan Produk

Keputusan berikut sudah divalidasi bersama pemilik produk dan menjadi dasar seluruh desain.

| Topik | Keputusan |
|---|---|
| Stack | Next.js (App Router) + Supabase Postgres, deploy ke Vercel |
| Region | Vercel dan Supabase sama-sama `ap-southeast-1` (Singapore) |
| Model koleksi | `books` (judul) → `book_copies` (eksemplar fisik, barcode unik) |
| Autentikasi | Username + password, dipetakan ke email internal pada Supabase Auth |
| Peran | `admin` dan `petugas` |
| Batas pinjam | 3 eksemplar aktif per siswa — permintaan melebihi batas **ditolak** |
| Keterlambatan | Siswa dengan pinjaman lewat jatuh tempo **diblokir** dari peminjaman baru |
| Durasi pinjam | 3 hari (dapat dikonfigurasi) |
| Denda telat | Rp1.000 per hari per eksemplar (dapat dikonfigurasi) |
| Rusak / hilang | Dikonversi menjadi biaya ganti sebesar harga buku; eksemplar tidak kembali `TERSEDIA` |
| Tunggakan denda | Dicatat dan dapat ditandai lunas; **tidak** memblokir peminjaman |
| Tahun ajaran | Entitas master, tepat satu aktif; setiap transaksi terikat padanya |
| Barcode | Input scanner USB didukung sejak awal, plus halaman cetak label barcode |
| Bukti transaksi | Struk thermal 58mm / 80mm |
| Arah visual | Navy/slate dengan aksen teal; tenang, institusional |

### 1.2 Penyimpangan dari PRD

Tiga hal berbeda dari PRD v1.0 dan perlu diketahui pembaca dokumen itu.

**Keterlambatan kini memblokir peminjaman.** PRD Section 17 mencatat "Tidak", tetapi pemilik produk memilih blokir keras. BR-03 karenanya berubah dari opsional menjadi wajib. Keputusan ini berdampak langsung pada pelayanan di meja sirkulasi dan **sebaiknya dikonfirmasi ulang ke pengelola perpustakaan sebelum rilis**.

**Kelebihan kuota ditolak, bukan didenda.** PRD Section 6.3 menulis "Siswa melewati batas maksimal pinjaman → terhitung denda". Ini tidak koheren: denda adalah konsekuensi keterlambatan, bukan konsekuensi kuota. Kuota penuh menghasilkan penolakan transaksi disertai pesan yang menjelaskan sisa slot.

**Tabel `books` mendapat kolom `price`.** Dibutuhkan karena rusak/hilang dikonversi menjadi biaya ganti nominal. PRD Section 10.1 belum mencantumkannya.

---

## 2. Lingkup

### 2.1 Termasuk

Login dan sesi · Dashboard · Data Buku dan Eksemplar · Kategori · Rak · Data Siswa · Tahun Ajaran · Peminjaman · Pengembalian · Riwayat Transaksi · Perhitungan dan pelunasan denda · Cetak struk · Cetak label barcode · Pengaturan aturan perpustakaan · Manajemen pengguna · Audit log.

**Catatan lingkup.** Empat item terakhir — Tahun Ajaran, Pengaturan, Manajemen Pengguna, dan Cetak — melampaui daftar "Phase 1" awal, tetapi menjadi konsekuensi langsung dari keputusan produk: tahun ajaran dipilih sebagai entitas master dengan satu yang aktif, struk thermal dan label barcode dipilih sebagai kebutuhan, BR-09 menuntut aturan dapat diubah tanpa menyentuh kode, dan seseorang harus dapat membuat akun petugas tanpa membuka dasbor Supabase.

Keempatnya sengaja dibangun **seminimal mungkin**: formulir sederhana, tanpa alur massal, tanpa impor. Bila lingkup perlu dipangkas demi jadwal, Manajemen Pengguna adalah kandidat pertama yang dapat ditunda — akun awal bisa dibuat lewat skrip seed.

### 2.2 Tidak Termasuk

Portal mandiri siswa · Reservasi buku · Notifikasi WhatsApp/email · Pembayaran denda daring · Integrasi sistem akademik · Modul Laporan · Ekspor PDF/Excel · Import Excel.

Import Excel belum dibangun, tetapi skema dirancang menerimanya: `nis` dan `barcode` adalah kunci alami yang stabil, sehingga import di fase berikutnya tidak memerlukan migrasi data.

---

## 3. Arsitektur

```
Browser (petugas)
   │  HTML + Server Actions — tidak ada kredensial Supabase di sisi klien
   ▼
Next.js App Router @ Vercel
   ├── app/       layar dan form
   ├── server/    I/O — satu-satunya lapisan yang menyentuh database
   └── domain/    aturan bisnis murni, tanpa I/O
   ▼
Supabase Postgres — RLS tolak-semua untuk peran anon
```

### 3.1 Aturan Arsitektural yang Mengikat

1. **`domain/` tidak boleh mengimpor apa pun dari `server/` atau `app/`.** Lapisan ini bebas I/O dan bebas waktu sistem; tanggal selalu disuntikkan sebagai parameter. Ini yang membuatnya dapat diuji dalam milidetik tanpa database.
2. **Status `book_copies` hanya boleh berubah di dalam `server/actions/`**, selalu di dalam transaksi database dengan baris eksemplar terkunci.
3. **`supabase-js` tidak pernah dipanggil dari komponen klien.** Seluruh akses data melalui server dengan service role.
4. **Setiap perubahan yang mengubah status transaksi atau status eksemplar menulis satu baris `audit_logs`** di dalam transaksi yang sama.

Supabase dipakai untuk tiga hal: Postgres, Auth, dan Storage (sampul buku). RLS disetel menolak seluruh akses dari peran `anon` dan `authenticated` sebagai jaring pengaman; otorisasi sesungguhnya ditegakkan di lapisan server. Bila kelak dibangun portal siswa (Phase 3), RLS harus diaktifkan sebagai kontrol utama — ini konsekuensi yang perlu diingat.

### 3.2 Struktur Direktori

```
src/
├── app/
│   ├── (auth)/login/
│   └── (app)/
│       ├── dashboard/
│       ├── master/{buku,kategori,siswa,rak}/
│       ├── transaksi/{peminjaman,pengembalian,riwayat}/
│       ├── cetak/{struk,label-barcode}/
│       └── pengaturan/{pengguna,konfigurasi,tahun-ajaran}/
├── domain/
│   ├── loan/{rules.ts, due-date.ts, transaction-number.ts}
│   ├── return/{fine.ts, copy-status.ts}
│   └── shared/{types.ts, violations.ts}
├── server/
│   ├── db/{client.ts, schema.ts, migrations/}
│   ├── actions/{auth.ts, loans.ts, returns.ts, books.ts, students.ts, settings.ts}
│   ├── queries/{dashboard.ts, history.ts, lookup.ts}
│   └── auth/{session.ts, guard.ts}
├── components/
│   ├── ui/        primitif berbasis shadcn/ui
│   └── features/  komponen per modul
└── lib/
```

### 3.3 Akses Database

Drizzle ORM di atas `postgres-js`, terhubung ke Supabase melalui **Supavisor transaction pooler**. Pooler mode transaksi tidak mendukung prepared statement, sehingga klien harus dikonfigurasi dengan `prepare: false`. Ini wajib untuk lingkungan serverless Vercel; tanpa pooler, koneksi akan habis di bawah beban.

---

## 4. Skema Database

### 4.1 Tabel

```sql
-- Dibutuhkan untuk index pencarian fuzzy pada judul buku dan nama siswa
create extension if not exists pg_trgm;

-- Pengguna sistem, memperluas auth.users milik Supabase
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text not null unique,
  full_name   text not null,
  role        text not null check (role in ('admin','petugas')),
  status      text not null default 'active' check (status in ('active','inactive')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table academic_years (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,          -- '2026/2027'
  start_date  date not null,
  end_date    date not null,
  is_active   boolean not null default false,
  created_at  timestamptz not null default now(),
  check (end_date > start_date)
);
-- Tepat satu tahun ajaran aktif, ditegakkan database
create unique index one_active_academic_year
  on academic_years (is_active) where is_active;

create table categories (
  id      uuid primary key default gen_random_uuid(),
  name    text not null unique,
  status  text not null default 'active'
);

create table racks (
  id        uuid primary key default gen_random_uuid(),
  code      text not null unique,            -- 'A-3'
  name      text not null,
  location  text,
  status    text not null default 'active'
);

create table books (
  id            uuid primary key default gen_random_uuid(),
  isbn          text,
  title         text not null,
  author        text not null,
  publisher     text,
  publish_year  int,
  category_id   uuid references categories(id),
  rack_id       uuid references racks(id),
  price         numeric(12,2) not null default 0,  -- dasar biaya ganti
  cover_url     text,
  description   text,
  status        text not null default 'active' check (status in ('active','inactive')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index books_title_trgm on books using gin (title gin_trgm_ops);

create table book_copies (
  id                uuid primary key default gen_random_uuid(),
  book_id           uuid not null references books(id) on delete restrict,
  barcode           text not null unique,           -- 'BK-000123'
  status            text not null default 'TERSEDIA'
                    check (status in ('TERSEDIA','DIPINJAM','RUSAK','HILANG','NONAKTIF')),
  acquisition_date  date,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index book_copies_status on book_copies (status);
create index book_copies_book on book_copies (book_id);

create table students (
  id                uuid primary key default gen_random_uuid(),
  nis               text not null unique,
  name              text not null,
  class_name        text not null,                  -- 'XI RPL 1'
  major             text,
  gender            text check (gender in ('L','P')),
  phone             text,
  academic_year_id  uuid references academic_years(id),
  status            text not null default 'active' check (status in ('active','inactive')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index students_name_trgm on students using gin (name gin_trgm_ops);

create table loans (
  id                  uuid primary key default gen_random_uuid(),
  transaction_number  text not null unique,         -- 'PJM-20260921-0001'
  student_id          uuid not null references students(id) on delete restrict,
  student_class       text not null,                -- SNAPSHOT kelas saat meminjam
  academic_year_id    uuid not null references academic_years(id),
  loan_date           date not null,
  due_date            date not null,
  status              text not null default 'AKTIF'
                      check (status in ('AKTIF','SEBAGIAN_KEMBALI','SELESAI')),
  total_fine          numeric(12,2) not null default 0,
  notes               text,
  created_by          uuid not null references profiles(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index loans_student on loans (student_id);
create index loans_open_due on loans (due_date) where status <> 'SELESAI';

create table loan_items (
  id                uuid primary key default gen_random_uuid(),
  loan_id           uuid not null references loans(id) on delete restrict,
  book_copy_id      uuid not null references book_copies(id) on delete restrict,
  returned_at       timestamptz,
  return_condition  text check (return_condition in ('BAIK','RUSAK','HILANG')),
  days_late         int not null default 0,
  late_fine         numeric(12,2) not null default 0,
  replacement_fee   numeric(12,2) not null default 0,
  condition_note    text,
  returned_by       uuid references profiles(id),
  created_at        timestamptz not null default now()
);
create index loan_items_loan on loan_items (loan_id);
-- Satu eksemplar hanya boleh berada di satu peminjaman terbuka
create unique index one_open_loan_per_copy
  on loan_items (book_copy_id) where returned_at is null;

create table fine_payments (
  id           uuid primary key default gen_random_uuid(),
  loan_id      uuid not null references loans(id) on delete restrict,
  amount       numeric(12,2) not null check (amount > 0),
  paid_at      timestamptz not null default now(),
  received_by  uuid not null references profiles(id),
  note         text
);

create table library_settings (
  id                      int primary key default 1 check (id = 1),
  max_active_loans        int not null default 3,
  loan_duration_days      int not null default 3,
  fine_per_day            numeric(12,2) not null default 1000,
  block_when_overdue      boolean not null default true,
  block_when_unpaid_fine  boolean not null default false,
  school_name             text,
  school_logo_url         text,
  receipt_footer          text,
  updated_by              uuid references profiles(id),
  updated_at              timestamptz not null default now()
);

create table counters (
  scope  text primary key,                   -- 'loan:20260921'
  value  bigint not null default 0
);

create table audit_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles(id),
  action      text not null,                 -- 'loan.create'
  entity      text not null,                 -- 'loans'
  entity_id   uuid,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);
create index audit_logs_entity on audit_logs (entity, entity_id);
```

### 4.2 Keputusan Skema

**`TERLAMBAT` bukan status tersimpan.** `loans.status` hanya `AKTIF`, `SEBAGIAN_KEMBALI`, dan `SELESAI`. Keterlambatan dihitung saat dibaca: `due_date < CURRENT_DATE AND status <> 'SELESAI'`. Status terlambat yang disimpan akan memerlukan pekerjaan terjadwal harian untuk membaliknya, dan setiap kegagalan pekerjaan itu menampilkan data keliru di layar petugas. Nilai yang dihitung selalu benar.

**Ketersediaan tidak disimpan sebagai angka.** Tidak ada kolom stok di `books`; jumlah tersedia dihitung dari `book_copies`. Penghitung yang disimpan terpisah adalah sumber klasik data tidak sinkron — tepat risiko "status buku tidak konsisten" yang dicatat PRD.

**`loans.student_class` adalah snapshot, bukan duplikasi.** Kelas siswa berubah setiap tahun ajaran. Menyalinnya ke baris transaksi membuat pertanyaan "dia kelas berapa ketika meminjam buku ini" terjawab permanen tanpa tabel riwayat kesiswaan. Yang sengaja tidak didukung: mendaftar seluruh siswa suatu kelas pada tahun lampau bila siswa itu tidak pernah meminjam — itu pertanyaan data induk kesiswaan, di luar tanggung jawab sistem ini.

**Index parsial `one_open_loan_per_copy` adalah jaring pengaman tingkat database.** Bahkan bila logika aplikasi cacat, database menolak satu eksemplar berada di dua peminjaman terbuka sekaligus.

### 4.3 Mesin Status Eksemplar

```
TERSEDIA ──pinjam──► DIPINJAM ──kembali BAIK────► TERSEDIA
                          ├────kembali RUSAK────► RUSAK  ──┐
                          └────kembali HILANG───► HILANG ──┤
                                                           │
                       TERSEDIA ◄──────────────────────────┘
                       hanya melalui aksi admin eksplisit
                       (diperbaiki / ditemukan), tercatat audit log

apa pun ──penarikan koleksi (admin)──► NONAKTIF
```

Menegakkan BR-07: eksemplar rusak atau hilang tidak pernah kembali tersedia secara otomatis.

---

## 5. Aturan Bisnis

### 5.1 Lapisan Domain

Empat fungsi murni. Tanpa database, tanpa `Date.now()`, tanpa efek samping.

| Fungsi | Masukan | Keluaran |
|---|---|---|
| `validateLoanRequest()` | siswa, pinjaman aktifnya, eksemplar yang diminta, settings, tanggal acuan | `{ ok: true }` atau `{ ok: false, violations: Violation[] }` |
| `calculateDueDate()` | tanggal pinjam, durasi hari | tanggal jatuh tempo |
| `calculateItemFine()` | jatuh tempo, tanggal kembali, kondisi, tarif per hari, harga buku | `{ daysLate, lateFine, replacementFee, total }` |
| `nextCopyStatus()` | kondisi pengembalian | status eksemplar berikutnya |
| `resolveLoanStatus()` | daftar item beserta tanda sudah kembali | `AKTIF` / `SEBAGIAN_KEMBALI` / `SELESAI` |

### 5.2 Aturan Peminjaman

| Kode | Aturan | Akibat |
|---|---|---|
| `NO_COPY_SELECTED` | Tidak ada eksemplar yang dipilih | Tolak |
| `STUDENT_INACTIVE` | Siswa berstatus tidak aktif | Tolak |
| `QUOTA_EXCEEDED` | Jumlah eksemplar aktif + permintaan > `max_active_loans` | Tolak |
| `HAS_OVERDUE` | Ada pinjaman terbuka lewat jatuh tempo, dan `block_when_overdue` | Tolak |
| `COPY_UNAVAILABLE` | Eksemplar tidak berstatus `TERSEDIA` | Tolak |
| `DUPLICATE_COPY` | Eksemplar sama dimasukkan dua kali dalam satu transaksi | Tolak |
| `NO_ACTIVE_YEAR` | Tidak ada tahun ajaran aktif | Tolak |
| `UNPAID_FINE` | Ada denda belum lunas, dan `block_when_unpaid_fine` | Tolak — **mati secara bawaan** |

### 5.3 Perhitungan Denda

Dihitung **per eksemplar**, bukan per transaksi.

```
hariTelat     = max(0, selisihHari(tanggalKembali, jatuhTempo))
dendaTelat    = hariTelat × fine_per_day
biayaGanti    = kondisi ∈ {RUSAK, HILANG} ? harga_buku : 0
totalItem     = dendaTelat + biayaGanti
```

Kembali tepat pada hari jatuh tempo menghasilkan denda nol. Buku yang rusak **dan** terlambat menanggung kedua biaya. `loans.total_fine` adalah jumlah seluruh `loan_items` miliknya, dihitung ulang setiap pengembalian.

Harga ganti diambil dari `books.price` sebagai nilai awal, dan **petugas dapat menimpanya** saat pengembalian bila harga sudah berubah. Nilai yang disimpan di `loan_items.replacement_fee` adalah yang final.

### 5.4 Pelunasan Denda

Dialog pelunasan menampilkan nominal denda dan sisa yang belum dibayar, dengan kolom jumlah yang **terisi otomatis sebesar sisa tagihan**. Petugas cukup menekan "Tandai Lunas" untuk pembayaran penuh — kasus yang paling sering — atau mengubah nominalnya bila siswa membayar sebagian. Setiap penekanan menulis satu baris `fine_payments`.

Suatu peminjaman dianggap lunas bila total `fine_payments` miliknya ≥ `loans.total_fine`. Status lunas **dihitung, tidak disimpan** — konsisten dengan keputusan pada Section 4.2. Daftar tunggakan adalah peminjaman dengan `total_fine > 0` yang belum mencapai ambang itu.

---

## 6. Alur Transaksi

### 6.1 `createLoan()`

Seluruh langkah berada dalam satu transaksi database.

1. Baca `library_settings` dan tahun ajaran aktif.
2. Kunci baris siswa; ambil pinjaman terbuka beserta jumlah eksemplarnya.
3. `select ... from book_copies where id = any($1) for update` — **kunci seluruh eksemplar yang diminta**.
4. Panggil `validateLoanRequest()` dengan state yang baru saja dibaca.
5. Ada pelanggaran → **rollback**, kembalikan daftar pelanggaran terstruktur.
6. Ambil nomor urut dari `counters` (`insert ... on conflict do update ... returning value`) → `PJM-20260921-0001`.
7. Insert `loans` (termasuk snapshot `student_class`) dan `loan_items`.
8. `update book_copies set status = 'DIPINJAM'` untuk eksemplar terkait.
9. Insert `audit_logs` dengan aksi `loan.create`.
10. Commit; kembalikan id dan nomor transaksi.

Langkah 3 adalah inti pertahanan integritas. Bila dua petugas menyimpan eksemplar yang sama pada saat bersamaan, transaksi kedua menunggu kunci dilepas, lalu membaca status `DIPINJAM`, dan ditolak dengan pesan yang benar. Tanpa penguncian baris, keduanya lolos validasi dan satu buku fisik tercatat dipinjam dua orang.

### 6.2 `processReturn()`

Mendukung pengembalian sebagian: satu transaksi dapat berisi tiga buku dan siswa kerap mengembalikan satu terlebih dahulu.

1. Kunci baris `loans`, `loan_items` yang belum kembali, dan `book_copies` terkait.
2. Untuk setiap item yang dikembalikan, panggil `calculateItemFine()`.
3. Perbarui `loan_items`: `returned_at`, `return_condition`, `days_late`, `late_fine`, `replacement_fee`, `condition_note`, `returned_by`.
4. Perbarui status setiap eksemplar melalui `nextCopyStatus()`.
5. Hitung ulang `loans.total_fine`; set status `SELESAI` bila seluruh item sudah kembali, selain itu `SEBAGIAN_KEMBALI`.
6. Insert `audit_logs` dengan aksi `return.process`.
7. Commit.

### 6.3 Penomoran Transaksi

Format `PJM-YYYYMMDD-NNNN`, nomor urut harian diambil dari tabel `counters` di dalam transaksi yang sama. Menghitung `count(*)` transaksi hari ini rawan tabrakan di bawah konkurensi; baris counter yang terkunci bersifat deterministik dan bebas tabrakan.

---

## 7. Autentikasi dan Otorisasi

Petugas memasukkan **username**, bukan email. Server memetakannya ke `<username>@perpus.local` dan memanggil `signInWithPassword` milik Supabase Auth. Pemetaan ini tidak pernah terlihat pengguna.

Konsekuensi: pemulihan kata sandi lewat email tidak tersedia. Admin mereset kata sandi pengguna dari layar Pengaturan → Pengguna. Ini dapat diterima karena seluruh pengguna adalah staf internal yang dapat menghubungi admin secara langsung.

Sesi dikelola cookie `httpOnly` melalui `@supabase/ssr`. Setiap Server Action memanggil penjaga yang memverifikasi sesi dan peran sebelum melakukan apa pun.

| Aksi | Admin | Petugas |
|---|:---:|:---:|
| Peminjaman, pengembalian, riwayat | Ya | Ya |
| Kelola buku, eksemplar, kategori, rak, siswa | Ya | Ya |
| Tandai denda lunas | Ya | Ya |
| Pulihkan eksemplar rusak/hilang ke tersedia | Ya | Tidak |
| Kelola pengguna | Ya | Tidak |
| Ubah konfigurasi perpustakaan | Ya | Tidak |
| Kelola tahun ajaran | Ya | Tidak |
| Lihat audit log | Ya | Tidak |

---

## 8. Sistem Desain dan Layar

### 8.1 Fondasi Visual

Palet navy/slate dengan aksen teal, dibangun sebagai token CSS sehingga dapat diarahkan ke warna sekolah tanpa menyentuh komponen.

Tipografi: **Inter** untuk antarmuka, dengan **angka tabular diaktifkan** pada seluruh tabel dan nominal — kolom tanggal dan denda yang tidak sejajar secara vertikal jauh lebih lambat dipindai mata. **Source Serif 4** untuk judul halaman, memberi bobot institusional yang membedakan aplikasi ini dari dasbor SaaS generik tanpa jatuh ke kesan kekanakan.

Warna status konsisten di seluruh aplikasi: Tersedia hijau · Dipinjam biru · Terlambat merah · Rusak oranye · Hilang abu gelap. **Setiap badge status menyertakan ikon**, tidak mengandalkan warna saja, agar tetap terbaca oleh petugas dengan buta warna.

Tata letak: sidebar kiri permanen mengikuti navigasi PRD Section 11; top bar menampilkan tahun ajaran aktif secara permanen — petugas harus selalu tahu ke tahun mana transaksinya masuk.

Target aksesibilitas: kontras WCAG AA, cincin fokus terlihat pada seluruh elemen interaktif, seluruh alur transaksi dapat diselesaikan tanpa tetikus.

### 8.2 Layar Peminjaman

Satu layar, dua kolom, tanpa wizard.

```
┌─ SISWA ──────────────────┐ ┌─ BUKU ───────────────────────────┐
│ [🔍 Scan / NIS / Nama  ] │ │ [📷 Scan barcode / cari judul  ] │
│ ┌──────────────────────┐ │ │ ┌──────────────────────────────┐ │
│ │ Ahmad Fauzi          │ │ │ │ 1. Pemrograman Web           │ │
│ │ 202600123 · XI RPL 1 │ │ │ │    BK-000123 · Rak A-3    [×]│ │
│ │ Slot: ●●○  2 dari 3  │ │ │ │ 2. Basis Data Lanjut         │ │
│ │ ✓ Tidak ada tunggakan│ │ │ │    BK-000451 · Rak A-1    [×]│ │
│ └──────────────────────┘ │ │ └──────────────────────────────┘ │
└──────────────────────────┘ └──────────────────────────────────┘
┌─ Pinjam: 21/09/2026   Jatuh tempo: 24/09/2026 (3 hari) ───────┐
│ Catatan: [                                                  ] │
└───────────────────────────────────────────────────────────────┘
      2 buku · slot tersisa 1        [ SIMPAN PEMINJAMAN ⌃↵ ]
```

Perilaku papan ketik, demi target di bawah 30 detik:

- Fokus berpindah otomatis ke kolom scan buku begitu siswa terpilih.
- `Enter` menambahkan buku lalu mengosongkan kolom untuk pemindaian berikutnya.
- `Ctrl+Enter` menyimpan transaksi.
- Kartu siswa menampilkan sisa slot (`●●○`) dan peringatan **sebelum** petugas menambahkan buku, sehingga penolakan kuota jarang terjadi. Mencegah lebih baik daripada menampilkan pesan galat.

Setelah simpan: dialog konfirmasi memuat nomor transaksi dan tombol **Cetak Struk**.

### 8.3 Layar Pengembalian

Satu kolom pencarian universal menerima nomor transaksi, NIS, nama siswa, atau barcode buku. Sistem menebak jenis masukan dari polanya; petugas tidak perlu memilih mode.

Hasil menampilkan detail transaksi dengan kotak centang dan pilihan kondisi per buku. Panel kanan menghitung denda secara langsung saat pilihan berubah — nominal terlihat **sebelum** tombol ditekan, bukan sesudah.

### 8.4 Dashboard

Tujuh widget sesuai PRD Section 12.1: Total Buku, Buku Tersedia, Sedang Dipinjam, Terlambat, Peminjaman Hari Ini, Pengembalian Hari Ini, dan tabel Transaksi Terbaru. Ditambah satu daftar yang tidak ada di PRD tetapi berguna secara operasional: **jatuh tempo hari ini**, agar petugas dapat mengantisipasi.

### 8.5 Cetak

**Struk peminjaman**: lebar 58mm dan 80mm melalui CSS `@page`, tanpa dependensi driver printer khusus. Memuat nama sekolah, nomor transaksi, nama dan NIS siswa, daftar buku beserta barcode, tanggal pinjam, jatuh tempo, dan teks catatan kaki dari konfigurasi.

**Label barcode**: halaman cetak berisi kisi label untuk ditempel pada eksemplar buku, dapat dipilih per rentang atau per judul. Barcode dirender sebagai Code128.

---

## 9. Penanganan Galat

Pelanggaran aturan dikembalikan sebagai objek terstruktur, bukan untai teks, sehingga antarmuka dapat menyusun pesan operasional sesuai PRD Section 11.1:

> ⛔ **Eksemplar BK-000123 sedang dipinjam** — Ahmad Fauzi (NIS 202600123), jatuh tempo 24/09/2026
> ⛔ **Kuota penuh** — Ahmad Fauzi sudah meminjam 3 buku. Kembalikan salah satu terlebih dahulu.
> ⛔ **Ada pinjaman terlambat** — PJM-20260917-0003, telat 4 hari. Selesaikan dahulu sebelum meminjam.

Setiap pesan menyebutkan entitas yang terlibat dan tindakan yang harus diambil. Pesan generik seperti "Transaksi gagal" tidak diterima di mana pun dalam sistem ini.

---

## 10. Pengujian

| Lapis | Alat | Cakupan |
|---|---|---|
| Aturan bisnis | Vitest | Seluruh `domain/`. Termasuk kasus batas: kembali tepat di hari jatuh tempo (denda nol), kembali lebih awal, rusak **dan** terlambat (dua biaya bertumpuk), permintaan melebihi sisa slot, tahun ajaran tidak aktif |
| Integrasi | Vitest + Supabase lokal | Server Actions terhadap database sungguhan |
| End-to-end | Playwright | login → pinjam → kembalikan → periksa riwayat; serta alur penolakan kuota penuh dan eksemplar tidak tersedia |

**Uji konkurensi bersifat wajib, bukan opsional.** Dua pemanggilan `createLoan()` paralel atas eksemplar yang sama harus menghasilkan tepat satu keberhasilan dan satu penolakan `COPY_UNAVAILABLE`. Uji ini adalah satu-satunya bukti bahwa klaim integritas arsitektur ini benar berlaku; fitur peminjaman tidak dianggap selesai sebelum uji ini hijau.

---

## 11. Deployment dan Operasional

Vercel dan Supabase **wajib berada di region yang sama** (`ap-southeast-1`). Region yang berbeda benua menambah puluhan milidetik pada setiap perjalanan bolak-balik di dalam transaksi, dan target respon di bawah 2 detik pada NFR menjadi sulit dicapai.

Koneksi database melalui Supavisor transaction pooler dengan `prepare: false`.

Cadangan: cadangan harian otomatis bawaan Supabase. Prosedur pemulihan harus didokumentasikan dan **diuji sekali sebelum rilis** — cadangan yang belum pernah dipulihkan bukanlah cadangan.

Migrasi skema dikelola berkas melalui Drizzle Kit dan masuk kendali versi.

---

## 12. Risiko

| Risiko | Mitigasi |
|---|---|
| Blokir keterlambatan mengganggu pelayanan nyata | Konfirmasi ulang ke pengelola perpustakaan sebelum rilis; tersedia sakelar `block_when_overdue` untuk mematikannya tanpa rilis ulang |
| Data buku awal tidak rapi | Halaman cetak label barcode memungkinkan pemberian kode pada koleksi yang belum berbarcode |
| Harga buku kosong sehingga biaya ganti nol | Petugas dapat menimpa nominal saat pengembalian; validasi memperingatkan bila harga nol |
| Batas koneksi serverless | Supavisor transaction pooler |
| Petugas tetap mencatat di luar sistem | Alur papan ketik satu layar dan cetak struk menjadikan sistem jalur tercepat |

---

## 13. Catatan untuk Fase Berikutnya

- Modul Laporan (empat laporan pada PRD Section 12.2) — `loans.student_class` sudah menyimpan snapshot kelas sehingga laporan per kelas akurat secara historis.
- Import Excel — `nis` dan `barcode` sudah menjadi kunci alami yang stabil.
- Ekspor PDF/Excel.
- Portal siswa — **memerlukan pengaktifan RLS sebagai kontrol utama**, bukan sekadar jaring pengaman.
- Blokir tunggakan denda — kolom `block_when_unpaid_fine` sudah tersedia dalam keadaan mati; mengaktifkannya cukup satu aturan di lapisan domain.
