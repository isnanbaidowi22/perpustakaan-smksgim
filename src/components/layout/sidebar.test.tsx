import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({ usePathname: () => '/master/buku/b1' }));

import { isActivePath, Sidebar } from './sidebar';

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
  // PRD bab 11 dan 5.1: laporan terlihat oleh setiap akun.
  '/laporan/peminjaman',
  '/laporan/pengembalian',
  '/laporan/keterlambatan',
  '/laporan/koleksi',
];

const PENGATURAN = ['/pengaturan/tahun-ajaran', '/pengaturan/pengguna', '/pengaturan/konfigurasi', '/pengaturan/audit-log'];

describe('Sidebar', () => {
  it('menampilkan seluruh menu, termasuk Pengaturan, untuk setiap akun', () => {
    const html = renderToStaticMarkup(<Sidebar schoolName="SMK GIM" />);
    for (const href of [...COMMON, ...PENGATURAN]) {
      expect(html).toContain(`href="${href}"`);
    }
    expect(html).toContain('Pengaturan');
  });

  it('menampilkan nama sekolah di bawah nama aplikasi', () => {
    expect(renderToStaticMarkup(<Sidebar schoolName="SMK GIM" />)).toContain('SMK GIM');
  });

  it('menandai menu halaman yang sedang dibuka, termasuk halaman turunannya', () => {
    const html = renderToStaticMarkup(<Sidebar schoolName={null} />);
    expect(html).toMatch(/<a aria-current="page"[^>]*href="\/master\/buku"/);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });

  it('menyediakan tombol ciutkan menu, dan tetap menyebut label menu bagi pembaca layar saat ringkas', () => {
    expect(renderToStaticMarkup(<Sidebar schoolName={null} />)).toContain('Ciutkan menu');

    const rail = renderToStaticMarkup(<Sidebar schoolName={null} defaultRail />);
    expect(rail).toContain('Luaskan menu');
    expect(rail).toContain('lg:w-[4.5rem]');
    expect(rail).toMatch(/<span class="lg:sr-only">Buku<\/span>/);
  });
});

describe('isActivePath', () => {
  it('cocok untuk alamat yang sama dan turunannya, tidak untuk awalan yang kebetulan sama', () => {
    expect(isActivePath('/master/buku', '/master/buku')).toBe(true);
    expect(isActivePath('/master/buku/baru', '/master/buku')).toBe(true);
    expect(isActivePath('/master/bukuan', '/master/buku')).toBe(false);
  });
});
