import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PAGE_SIZE } from '@/lib/pagination';
import { FilterBar, FilterSelect, STATUS_OPTIONS } from './filter-bar';
import { Flash } from './flash';
import { PageHeader } from './page-header';
import { Pagination } from './pagination';
import { RecordStatusBadge } from './record-status-badge';
import { ScrollTable } from './scroll-table';

describe('PageHeader', () => {
  it('menampilkan judul, keterangan, dan aksi', () => {
    const html = renderToStaticMarkup(
      <PageHeader title="Kategori" description="Pengelompokan judul buku." actions={<a href="/x">Tambah</a>} />,
    );
    expect(html).toContain('<h1');
    expect(html).toContain('Pengelompokan judul buku.');
    expect(html).toContain('Tambah');
  });
});

describe('Flash', () => {
  it('menampilkan pesan sebagai status', () => {
    expect(renderToStaticMarkup(<Flash message="Kategori berhasil ditambahkan." />)).toContain('role="status"');
  });

  it('tidak menampilkan apa pun tanpa pesan', () => {
    expect(renderToStaticMarkup(<Flash message="" />)).toBe('');
  });
});

describe('FilterBar', () => {
  it('mengirim pencarian lewat GET dengan filter tambahan', () => {
    const html = renderToStaticMarkup(
      <FilterBar q="fiksi" placeholder="Cari nama kategori">
        <FilterSelect name="status" label="Filter status" value="all" options={STATUS_OPTIONS} />
      </FilterBar>,
    );
    expect(html).toContain('role="search"');
    expect(html).toContain('value="fiksi"');
    expect(html).toMatch(/<option value="all" selected="">Semua status<\/option>/);
  });
});

describe('FilterBar autoFocus', () => {
  it('memfokuskan kolom pencarian bila diminta, dan tidak secara bawaan', () => {
    expect(renderToStaticMarkup(<FilterBar q="" placeholder="Cari" autoFocus />)).toMatch(/<input[^>]*autofocus=""/i);
    expect(renderToStaticMarkup(<FilterBar q="" placeholder="Cari" />)).not.toMatch(/autofocus/i);
  });
});

describe('Pagination', () => {
  it('tidak tampil bila hanya satu halaman', () => {
    expect(renderToStaticMarkup(<Pagination path="/master/kategori" page={1} total={3} query={{}} />)).toBe('');
  });

  it('membawa filter ke tautan halaman berikutnya', () => {
    const html = renderToStaticMarkup(
      <Pagination path="/master/kategori" page={1} total={PAGE_SIZE + 1} query={{ q: 'fiksi' }} />,
    );
    expect(html).toContain('Halaman 1 dari 2');
    expect(html).toContain('href="/master/kategori?q=fiksi&amp;hal=2"');
    expect(html).not.toContain('Sebelumnya');
  });
});

describe('RecordStatusBadge', () => {
  it('memakai teks dan ikon, tidak hanya warna', () => {
    expect(renderToStaticMarkup(<RecordStatusBadge status="active" />)).toContain('Aktif');
    expect(renderToStaticMarkup(<RecordStatusBadge status="inactive" />)).toContain('Nonaktif');
  });
});

describe('ScrollTable', () => {
  it('membungkus tabel dalam wadah yang dapat digulir ke samping di layar sempit', () => {
    const html = renderToStaticMarkup(
      <ScrollTable>
        <tbody><tr><td>isi</td></tr></tbody>
      </ScrollTable>,
    );
    expect(html).toMatch(/^<div class="[^"]*overflow-x-auto[^"]*"><table/);
    expect(html).toContain('<td>isi</td>');
  });

  it('tidak memotong tabel saat dicetak', () => {
    const html = renderToStaticMarkup(
      <ScrollTable>
        <tbody><tr><td>isi</td></tr></tbody>
      </ScrollTable>,
    );
    expect(html).toContain('print:overflow-visible');
    expect(html).toContain('print:min-w-0');
  });
});
