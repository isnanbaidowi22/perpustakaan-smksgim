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
