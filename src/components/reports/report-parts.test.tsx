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
    // M1: deskripsi laporan juga tampil di kop cetak, tidak hanya di layar.
    const printBlock = html.slice(html.indexOf('print:block'));
    expect(printBlock).toContain('Menurut tanggal pinjam.');
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

  it('ikut tercetak bila printable, misalnya pemberitahuan pemotongan baris', () => {
    const html = renderToStaticMarkup(<ReportNotice message="Laporan ini memuat lebih dari 1.000 baris." printable />);
    expect(html).toContain('role="alert"');
    expect(html).not.toContain('print:hidden');
  });
});
