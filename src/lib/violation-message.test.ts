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
