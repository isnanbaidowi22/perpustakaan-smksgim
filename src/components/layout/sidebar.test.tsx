import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Sidebar } from './sidebar';

describe('Sidebar', () => {
  it('menampilkan keempat kelompok menu dengan tautan yang benar', () => {
    const html = renderToStaticMarkup(<Sidebar />);

    for (const group of ['Master Data', 'Transaksi', 'Pengaturan']) {
      expect(html).toContain(group);
    }

    const hrefs = [
      '/dashboard',
      '/master/buku',
      '/master/kategori',
      '/master/siswa',
      '/master/rak',
      '/transaksi/peminjaman',
      '/transaksi/pengembalian',
      '/transaksi/riwayat',
      '/pengaturan/tahun-ajaran',
      '/pengaturan/pengguna',
      '/pengaturan/konfigurasi',
    ];
    for (const href of hrefs) {
      expect(html).toContain(`href="${href}"`);
    }
  });
});
