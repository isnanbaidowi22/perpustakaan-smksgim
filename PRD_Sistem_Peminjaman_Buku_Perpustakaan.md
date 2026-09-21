# PRD — Sistem Peminjaman Buku Perpustakaan

**Dokumen Produk:** Product Requirements Document (PRD)  
**Versi:** 1.0  
**Tanggal:** 7 September 2026  
**Status:** Draft untuk Validasi Kebutuhan  
**Target Rilis:** MVP — setelah kebutuhan bisnis tervalidasi

> Dokumen kebutuhan produk untuk mendigitalisasi proses peminjaman dan pengembalian buku serta membangun histori transaksi yang terstruktur.

---

## Daftar Isi

1. [Ringkasan Eksekutif](#1-ringkasan-eksekutif)
2. [Latar Belakang & Problem Statement](#2-latar-belakang--problem-statement)
3. [Tujuan dan Sasaran](#3-tujuan-dan-sasaran)
4. [Ruang Lingkup Produk](#4-ruang-lingkup-produk)
5. [Persona & Aktor Sistem](#5-persona--aktor-sistem)
6. [User Journey](#6-user-journey)
7. [Functional Requirements](#7-functional-requirements)
8. [Business Rules](#8-business-rules)
9. [Non-Functional Requirements](#9-non-functional-requirements)
10. [Data Model Awal](#10-data-model-awal)
11. [Rancangan Navigasi & UX](#11-rancangan-navigasi--ux)
12. [Laporan dan Dashboard](#12-laporan-dan-dashboard)
13. [Acceptance Criteria MVP](#13-acceptance-criteria-mvp)
14. [KPI dan Success Metrics](#14-kpi-dan-success-metrics)
15. [Risiko dan Mitigasi](#15-risiko-dan-mitigasi)
16. [Roadmap Pengembangan](#16-roadmap-pengembangan)
17. [Open Questions / Keputusan yang Masih Dibutuhkan](#17-open-questions--keputusan-yang-masih-dibutuhkan)

---

## 1. Ringkasan Eksekutif

Sistem ini adalah aplikasi web untuk membantu petugas perpustakaan mencatat dan mengelola aktivitas peminjaman serta pengembalian buku secara terstruktur.

Fokus MVP adalah menggantikan pencatatan manual atau proses yang belum terdokumentasi dengan baik menjadi histori transaksi digital yang dapat dicari, diverifikasi, dan dilaporkan.

**Prinsip utama produk:**
- Data transaksi harus konsisten.
- Proses operasional petugas harus cepat.
- Status buku harus selalu dapat ditelusuri.

### Fokus MVP

| Outcome | Deskripsi |
|---|---|
| Pencatatan peminjaman | Setiap transaksi tersimpan dengan identitas siswa, buku, tanggal pinjam, dan tanggal jatuh tempo. |
| Pencatatan pengembalian | Tanggal kembali, status transaksi, dan keterlambatan tercatat. |
| Status koleksi | Petugas dapat mengetahui buku tersedia, dipinjam, rusak, atau hilang. |
| Riwayat | Seluruh histori transaksi dapat dicari dan difilter. |
| Laporan | Petugas/admin dapat melihat rekap peminjaman, pengembalian, dan keterlambatan. |

## 2. Latar Belakang & Problem Statement

Proses peminjaman buku saat ini belum terdokumentasi dengan baik. Kondisi tersebut menciptakan risiko operasional: riwayat peminjaman sulit dilacak, status buku tidak selalu akurat, pencarian transaksi memerlukan waktu, serta rekap dan laporan cenderung bergantung pada pekerjaan manual.

**Problem statement:**

> Perpustakaan membutuhkan satu sumber data terpusat yang mencatat siapa meminjam buku apa, kapan dipinjam, kapan harus dikembalikan, kapan dikembalikan, dan bagaimana status transaksi tersebut.

### 2.1 Dampak Bisnis

- Sulit mengetahui buku yang sedang dipinjam dan siapa peminjamnya.
- Risiko kehilangan atau salah pencatatan histori transaksi.
- Petugas menghabiskan waktu untuk mencari data dan membuat rekap.
- Keterlambatan pengembalian sulit dipantau.
- Data koleksi dan data transaksi tidak mudah digunakan untuk evaluasi.

## 3. Tujuan dan Sasaran

### 3.1 Product Goal

Membangun sistem peminjaman buku berbasis web yang membuat proses transaksi terdokumentasi, cepat, akurat, dan mudah dilacak.

### 3.2 Sasaran MVP

- 100% transaksi peminjaman yang dilakukan melalui sistem memiliki record digital.
- Petugas dapat menyelesaikan transaksi normal dalam waktu kurang dari 30 detik setelah data siswa dan buku tersedia.
- Petugas dapat menemukan riwayat transaksi berdasarkan siswa, buku, atau nomor transaksi.
- Status buku berubah otomatis mengikuti aktivitas transaksi.
- Laporan dasar dapat dihasilkan tanpa rekap manual.

## 4. Ruang Lingkup Produk

### 4.1 In Scope — MVP

| Modul | Prioritas | Deskripsi |
|---|---|---|
| Login & autentikasi | Must | Petugas/admin masuk ke sistem secara aman. |
| Dashboard | Must | Ringkasan jumlah buku, siswa, pinjaman aktif, keterlambatan, dan aktivitas terbaru. |
| Data Buku | Must | CRUD koleksi buku dan status eksemplar. |
| Data Siswa | Must | CRUD data siswa/peminjam. |
| Peminjaman | Must | Membuat transaksi pinjaman dan mengubah status buku. |
| Pengembalian | Must | Mencatat buku kembali, keterlambatan, dan status transaksi. |
| Riwayat Transaksi | Must | Pencarian, filter, detail, dan histori. |
| Laporan | Should | Rekap peminjaman, pengembalian, keterlambatan, dan koleksi. |
| Denda | Must | Perhitungan denda berdasarkan aturan yang dapat dikonfigurasi. |
| Barcode/QR | Could | Mempercepat identifikasi buku/siswa. |

### 4.2 Out of Scope — MVP

- Portal mandiri siswa untuk login dan melihat histori pribadi.
- Reservasi buku oleh siswa.
- Integrasi otomatis dengan sistem akademik sekolah.
- Notifikasi WhatsApp/email otomatis.
- Pembayaran denda online.
- Arsitektur microservices.

## 5. Persona & Aktor Sistem

| Aktor | Peran | Kebutuhan Utama |
|---|---|---|
| Admin | Mengelola sistem dan data master | Kontrol akses, data buku/siswa, laporan, konfigurasi. |
| Petugas Perpustakaan | Pengguna operasional utama | Transaksi cepat, pencarian, pengembalian, histori. |

### 5.1 Role & Permission Awal

| Aksi | Admin | Petugas |
|---|:---:|:---:|
| Login | Ya | Ya |
| Kelola user | Ya | Tidak |
| Kelola buku | Ya | Ya |
| Kelola siswa | Ya | Ya |
| Peminjaman | Ya | Ya |
| Pengembalian | Ya | Ya |
| Lihat laporan | Ya | Ya |
| Konfigurasi aturan | Ya | Opsional sesuai kebijakan |

## 6. User Journey

### 6.1 Peminjaman

1. Login.
2. Masuk ke menu **Peminjaman**.
3. Cari/scan siswa.
4. Tambahkan buku.
5. Validasi aturan.
6. Tentukan jatuh tempo.
7. Konfirmasi.
8. Simpan transaksi.
9. Sistem menghasilkan bukti transaksi dan ID transaksi.
10. Status buku berubah menjadi `DIPINJAM`.

### 6.2 Pengembalian

1. Login.
2. Masuk ke menu **Pengembalian**.
3. Cari ID transaksi/siswa/kode buku.
4. Tampilkan detail transaksi.
5. Catat tanggal kembali.
6. Hitung keterlambatan/denda.
7. Konfirmasi.
8. Status buku berubah menjadi `TERSEDIA` jika kondisi memungkinkan.

### 6.3 Penanganan Kondisi Khusus

- Buku tidak tersedia → transaksi ditolak.
- Siswa melewati batas maksimal pinjaman → terhitung denda.
- Ada pinjaman terlambat → sistem memberi peringatan dan memberikan denda keterlambatan.
- Buku rusak/hilang → pengembalian dapat menggunakan status khusus dan tidak otomatis dianggap tersedia.

## 7. Functional Requirements

| ID | Requirement | Deskripsi |
|---|---|---|
| FR-01 | Login & autentikasi | Sistem memvalidasi username/password dan mengatur hak akses berdasarkan role. |
| FR-02 | Dashboard | Sistem menampilkan total buku, siswa, tersedia, dipinjam, terlambat, dan transaksi terbaru. |
| FR-03 | Data buku | Petugas dapat tambah, lihat, ubah, nonaktifkan/hapus, cari, dan filter data buku. |
| FR-04 | Data siswa | Petugas dapat tambah, lihat, ubah, nonaktifkan, cari, dan filter siswa. |
| FR-05 | Peminjaman | Petugas memilih siswa dan satu atau lebih buku, memasukkan tanggal pinjam/jatuh tempo, lalu menyimpan transaksi. |
| FR-06 | Pengembalian | Petugas mencari transaksi, mencatat tanggal kembali, memproses keterlambatan, dan menyelesaikan transaksi. |
| FR-07 | Deteksi keterlambatan | Sistem membandingkan due date dengan tanggal kembali/tanggal hari ini. |
| FR-08 | Denda | Sistem menghitung denda bila fitur diaktifkan berdasarkan tarif dan hari terlambat. |
| FR-09 | Riwayat | Sistem menyimpan dan menampilkan histori transaksi secara permanen sesuai kebijakan retensi. |
| FR-10 | Laporan | Sistem menyediakan laporan berdasarkan periode dan filter yang relevan. |
| FR-11 | Import data | Sistem disiapkan untuk import Excel/CSV data awal buku/siswa pada fase berikutnya. |

### 7.1 Detail Form Peminjaman

| Field | Tipe | Wajib | Catatan |
|---|---|:---:|---|
| ID transaksi | Auto | Ya | Dibentuk otomatis dan unik. |
| Siswa | Lookup | Ya | Cari berdasarkan NIS/nama. |
| Buku | Lookup/scan | Ya | Bisa menambah lebih dari satu buku. |
| Tanggal pinjam | Date | Ya | Default tanggal hari ini. |
| Tanggal jatuh tempo | Date | Ya | Default dihitung dari konfigurasi durasi. |
| Catatan | Textarea | Tidak | Untuk kebutuhan khusus. |

### 7.2 Detail Form Pengembalian

| Field | Tipe | Wajib | Catatan |
|---|---|:---:|---|
| ID transaksi | Lookup | Ya | Menentukan transaksi aktif. |
| Tanggal kembali | Date | Ya | Default tanggal hari ini. |
| Kondisi buku | Select | Ya | Baik/Rusak/Hilang atau status lain sesuai kebijakan. |
| Hari terlambat | Auto | Ya | Dihitung oleh sistem. |
| Denda | Auto | Ya | Aktif jika denda digunakan. |
| Catatan | Textarea | Tidak | Catatan kondisi/pengembalian. |

## 8. Business Rules

| ID | Aturan |
|---|---|
| BR-01 | Buku berstatus `DIPINJAM` tidak dapat dipinjam oleh transaksi lain. |
| BR-02 | Siswa dapat dibatasi oleh jumlah maksimum buku aktif. |
| BR-03 | Sistem dapat membatasi peminjaman baru jika siswa memiliki pinjaman terlambat. |
| BR-04 | Tanggal jatuh tempo default dihitung dari durasi peminjaman yang dikonfigurasi. |
| BR-05 | Setiap transaksi memiliki nomor transaksi unik. |
| BR-06 | Setiap eksemplar buku disarankan memiliki kode/barcode unik. |
| BR-07 | Buku rusak/hilang tidak otomatis kembali menjadi `TERSEDIA`. |
| BR-08 | Data transaksi yang sudah terjadi tidak boleh dihapus sembarangan; koreksi harus tercatat melalui audit log. |
| BR-09 | Denda, batas pinjaman, dan durasi pinjaman sebaiknya dapat dikonfigurasi tanpa mengubah source code. |
| BR-10 | Semua perubahan status transaksi harus menghasilkan jejak histori yang dapat ditelusuri. |

### 8.1 Contoh Konfigurasi

| Parameter | Contoh Nilai | Status |
|---|---:|---|
| Maksimal buku aktif | 3 | Perlu disepakati |
| Durasi pinjam | 3 hari | Sudah disepakati |
| Denda per hari | Rp1.000 | Sudah disepakati |

## 9. Non-Functional Requirements

| Kategori | Requirement |
|---|---|
| Performance | Target waktu respon halaman/transaksi normal terasa < 2 detik pada jaringan yang wajar. |
| Security | Password di-hash; validasi input; proteksi SQL injection, XSS, CSRF/session sesuai stack. |
| Authorization | Akses fitur mengikuti role/permission. |
| Auditability | Aksi penting dapat ditelusuri dengan user dan timestamp. |
| Availability | Tersedia mekanisme backup dan restore database. |
| Data Integrity | Foreign key/constraint dan transaksi database digunakan untuk menjaga konsistensi status buku dan transaksi. |
| Maintainability | Arsitektur modular monolith dianjurkan untuk MVP; logika aturan bisnis dipisahkan dari UI. |
| Scalability | Mampu menangani ribuan siswa, ribuan eksemplar, dan puluhan ribu histori transaksi tanpa perubahan arsitektur besar. |
| Usability | Alur peminjaman mengutamakan pencarian cepat dan input minimal. |
| Responsive | Aplikasi dapat digunakan pada desktop dan tablet; mobile menjadi pertimbangan desain. |

## 10. Data Model Awal

Model berikut adalah baseline untuk diskusi teknis. Struktur dapat berubah setelah aturan bisnis dan sumber data sekolah tervalidasi.

### 10.1 Entitas dan Atribut Inti

| Entitas | Atribut Inti |
|---|---|
| `users` | `id`, `username`, `password_hash`, `role`, `status`, `created_at`, `updated_at` |
| `students` | `id`, `nis`, `name`, `class`, `major`, `gender`, `phone`, `status`, `created_at`, `updated_at` |
| `books` | `id`, `code/barcode`, `isbn`, `title`, `author`, `publisher`, `publish_year`, `category_id`, `rack`, `status`, `created_at`, `updated_at` |
| `categories` | `id`, `name`, `status` |
| `loans` | `id`, `transaction_number`, `student_id`, `loan_date`, `due_date`, `return_date`, `status`, `fine_total`, `created_by`, `created_at` |
| `loan_items` | `id`, `loan_id`, `book_id`, `return_date`, `item_status`, `condition_note` |
| `audit_logs` | `id`, `user_id`, `action`, `entity`, `entity_id`, `metadata`, `created_at` |
| `library_settings` | `id`, `max_active_loans`, `loan_duration_days`, `fine_per_day`, `block_when_overdue`, `updated_by`, `updated_at` |

### 10.2 Relasi Inti

```text
students 1 ─── N loans
loans    1 ─── N loan_items
books    1 ─── N loan_items
categories 1 ─── N books
users    1 ─── N loans (created_by)
users    1 ─── N audit_logs
```

### 10.3 Keputusan Data Penting

Sistem sebaiknya membedakan antara **judul buku** dan **eksemplar fisik**.

Jika satu judul memiliki 10 eksemplar, idealnya setiap eksemplar mempunyai kode unik sehingga sistem dapat mengetahui buku fisik mana yang sedang dipinjam, rusak, atau hilang.

## 11. Rancangan Navigasi & UX

```text
Dashboard
├── Master Data
│   ├── Buku
│   ├── Kategori
│   ├── Siswa
│   └── Rak
├── Transaksi
│   ├── Peminjaman
│   ├── Pengembalian
│   └── Riwayat
├── Laporan
│   ├── Peminjaman
│   ├── Pengembalian
│   ├── Keterlambatan
│   └── Koleksi Buku
└── Pengaturan
    ├── User
    └── Konfigurasi
```

### 11.1 Prinsip UX Transaksi

- Minimalkan field yang harus diketik manual.
- Gunakan autocomplete untuk siswa dan buku.
- Siapkan dukungan barcode/QR scanner sebagai peningkatan berikutnya.
- Tampilkan status buku secara jelas sebelum transaksi disimpan.
- Berikan konfirmasi sukses beserta nomor transaksi setelah penyimpanan.
- Gunakan pesan error yang operasional, misalnya:
  > `Buku BK-000123 sedang dipinjam oleh NIS 202600123`.

### 11.2 Contoh Layar Peminjaman

```text
[ Peminjaman ]

Siswa:
[ Cari NIS / Nama................ ]

Buku:
[ Scan / Cari Kode / Judul........ ] [ + Tambah ]

Daftar Buku:
1. Pemrograman Web (BK-000123)

Tanggal:
[ 07/09/2026 ]

Jatuh Tempo:
[ 14/09/2026 ]

Catatan:
[................................]

[ SIMPAN PEMINJAMAN ]
```

## 12. Laporan dan Dashboard

### 12.1 Dashboard

| Widget | Definisi |
|---|---|
| Total Buku | Jumlah koleksi/eksemplar aktif. |
| Buku Tersedia | Eksemplar berstatus `TERSEDIA`. |
| Sedang Dipinjam | Eksemplar berstatus `DIPINJAM`. |
| Terlambat | Transaksi aktif melewati due date. |
| Peminjaman Hari Ini | Jumlah transaksi yang dibuat hari ini. |
| Pengembalian Hari Ini | Jumlah item/transaksi yang dikembalikan hari ini. |
| Transaksi Terbaru | Daftar aktivitas terbaru. |

### 12.2 Laporan

| Laporan | Filter Utama | Output |
|---|---|---|
| Peminjaman | Periode, siswa, kelas, buku | Daftar transaksi pinjam. |
| Pengembalian | Periode, siswa, buku | Daftar transaksi kembali. |
| Keterlambatan | Status overdue, kelas | Daftar pinjaman yang terlambat. |
| Koleksi | Kategori, status, rak | Ringkasan koleksi. |
| Riwayat Siswa | NIS/nama, periode | Histori pinjaman siswa. |

**Format output yang disarankan:** tampilan web, print, PDF, dan Excel. PDF/Excel dapat diprioritaskan setelah alur transaksi inti stabil.

## 13. Acceptance Criteria MVP

### 13.1 Peminjaman

- Siswa tidak boleh kosong.
- Minimal satu buku harus dipilih.
- Buku harus berstatus `TERSEDIA`.
- Aturan maksimum pinjaman harus divalidasi.
- Nomor transaksi dibuat otomatis dan unik.
- Setelah transaksi tersimpan, status buku berubah menjadi `DIPINJAM`.
- Data tersimpan dan dapat ditemukan di riwayat transaksi.

### 13.2 Pengembalian

- Transaksi aktif dapat ditemukan berdasarkan nomor transaksi, NIS, nama siswa, atau kode buku.
- Tanggal pengembalian tercatat.
- Hari keterlambatan dihitung benar.
- Status buku menjadi `TERSEDIA` hanya bila kondisi buku memungkinkan.
- Jika denda aktif, nominal denda dihitung sesuai konfigurasi.
- Histori tetap dapat ditelusuri setelah transaksi selesai.

### 13.3 Data & Audit

- Data penting tidak dapat dihapus tanpa hak akses yang sesuai.
- Perubahan/aksi penting tercatat dalam audit log.
- Backup dan restore memiliki prosedur yang terdokumentasi.

## 14. KPI dan Success Metrics

| Metric | Target Awal | Cara Ukur |
|---|---|---|
| Adopsi transaksi digital | 100% transaksi operasional | Jumlah transaksi tercatat vs transaksi aktual. |
| Waktu transaksi | < 30 detik/transaksi normal | Waktu dari pencarian siswa sampai konfirmasi. |
| Akurasi status buku | > 99% | Sampling fisik vs status sistem. |
| Transaksi dengan data tidak lengkap | < 1% | Audit histori transaksi. |
| Waktu pencarian histori | < 10 detik | Pengujian operasional petugas. |
| Kehilangan histori | 0 kasus | Audit database/backup. |

## 15. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Data buku awal tidak rapi | Tinggi | Sediakan template import dan validasi data. |
| Data siswa berubah per tahun ajaran | Tinggi | Gunakan status aktif dan pertimbangkan periode/tahun ajaran. |
| Petugas tetap melakukan pencatatan di luar sistem | Tinggi | Buat workflow sederhana dan jadikan sistem sumber catatan resmi. |
| Status buku tidak konsisten | Tinggi | Gunakan transaksi atomik dan aturan status terpusat. |
| Kehilangan database | Tinggi | Backup otomatis, retensi backup, dan uji restore berkala. |
| Aturan peminjaman berubah | Sedang | Simpan parameter pada `library_settings`. |
| Kesalahan input manual | Sedang | Autocomplete, validasi, barcode/QR. |

## 16. Roadmap Pengembangan

| Fase | Fitur | Tujuan |
|---|---|---|
| **Phase 1 — MVP** | Login, buku, siswa, peminjaman, pengembalian, riwayat, dashboard | Mendigitalisasi proses inti. |
| **Phase 2** | Barcode/QR, import Excel, laporan PDF/Excel, audit log, denda | Meningkatkan kecepatan dan kontrol operasional. |
| **Phase 3** | Akun siswa, portal histori, notifikasi jatuh tempo, reservasi | Meningkatkan layanan kepada siswa. |
| **Phase 4** | Integrasi akademik, SSO, analitik, notifikasi WhatsApp/email | Membangun ekosistem perpustakaan terpadu. |

### 16.1 Rekomendasi Arsitektur

Untuk skala sekolah, gunakan **modular monolith** terlebih dahulu. Arsitektur ini cukup sederhana untuk dibangun dan dipelihara, tetapi tetap memungkinkan pemisahan modul dan pengembangan bertahap.

```text
Browser
   ↓
Web Application / API
   ↓
Database

Optional later:
├── File Storage
├── Notification Service
└── Academic Integration
```

**Contoh stack:**
- Web layer: Next.js/React atau Laravel.
- Database: PostgreSQL/MySQL.
- Pilihan final mengikuti kompetensi tim dan infrastruktur sekolah.

## 17. Open Questions / Keputusan yang Masih Dibutuhkan

Bagian ini harus divalidasi bersama pihak perpustakaan sebelum development dimulai karena akan memengaruhi desain database, workflow, dan permission.

| Topik | Pertanyaan | Nilai Saat Ini | Dampak |
|---|---|---|---|
| Peminjaman | Berapa maksimal buku per siswa? | 3 | Validasi transaksi dan konfigurasi. |
| Durasi | Berapa lama masa pinjam? | 3 hari | Perhitungan due date. |
| Overdue | Apakah siswa terlambat diblokir dari pinjaman baru? | Tidak | Business rule. |
| Denda | Apakah ada denda? Berapa tarifnya? | Rp1.000 | Model pengembalian dan laporan. |
| Eksemplar | Apakah setiap buku fisik punya barcode/kode unik? | Ya | Desain tabel books vs book_copies. |
| Siswa | Apakah siswa sudah memiliki NIS unik dan data Excel/database? | Sudah | Import dan identitas. |
| Akses | Apakah hanya petugas yang menggunakan sistem? | Ya | Role & authentication. |
| Infrastruktur | Jaringan LAN sekolah, internet/cloud, atau keduanya? | Ya | Deployment dan security. |
| Tahun ajaran | Apakah histori perlu dikelompokkan per tahun ajaran? | Ya | Data model dan laporan. |
| Kondisi buku | Bagaimana perlakuan buku rusak/hilang? | Ganti | Status dan pengembalian. |
| Cetak | Apakah perlu kartu/struk bukti peminjaman? | Ya | UX dan reporting. |
| Integrasi | Apakah perlu terhubung dengan sistem akademik? | Tidak | Roadmap/integrasi. |

### 17.1 Keputusan yang Direkomendasikan untuk Baseline

- Setiap eksemplar fisik buku memiliki kode/barcode unik.
- Satu transaksi dapat berisi beberapa buku.
- Tanggal jatuh tempo dihitung otomatis berdasarkan konfigurasi.
- Transaksi selesai tidak dihapus; histori tetap disimpan.
- Buku rusak/hilang tidak otomatis menjadi tersedia.
- Aturan maksimum pinjaman dan durasi disimpan sebagai konfigurasi.
- Import Excel disiapkan sejak desain awal untuk data siswa dan buku.
- Backup database dianggap requirement wajib untuk production.

---

> **Catatan:** PRD ini merupakan baseline produk. Nilai konfigurasi dan beberapa aturan operasional masih perlu divalidasi oleh pengelola perpustakaan sebelum dijadikan acceptance criteria final.
