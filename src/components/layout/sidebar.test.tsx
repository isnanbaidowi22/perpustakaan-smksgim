import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Sidebar } from './sidebar';

const COMMON = [
  '/dashboard',
  '/master/buku',
  '/master/kategori',
  '/master/siswa',
  '/master/rak',
  '/cetak/label-barcode',
  '/transaksi/peminjaman',
  '/transaksi/pengembalian',
  '/transaksi/riwayat',
  // PRD bab 11 dan 5.1: laporan terlihat oleh admin dan petugas.
  '/laporan/peminjaman',
  '/laporan/pengembalian',
  '/laporan/keterlambatan',
  '/laporan/koleksi',
];

const ADMIN_ONLY = ['/pengaturan/tahun-ajaran', '/pengaturan/pengguna', '/pengaturan/konfigurasi', '/pengaturan/audit-log'];

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
