import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { LabelCopy } from '@/server/queries/labels';

const { mockFind, mockSettings } = vi.hoisted(() => ({ mockFind: vi.fn(), mockSettings: vi.fn() }));

vi.mock('@/server/queries/labels', () => ({ findLabelCopies: mockFind }));
vi.mock('@/server/queries/settings', () => ({ getLibrarySettings: mockSettings }));
vi.mock('@/server/auth/guard', () => ({
  requireProfile: vi.fn(async () => ({ id: 'u1', role: 'admin', fullName: 'Petugas', status: 'active' })),
}));

import LabelPage from './page';

function copy(barcode: string, title = 'Pemrograman Web'): LabelCopy {
  return { id: `id-${barcode}`, barcode, bookTitle: title, rackCode: 'A-3' };
}

async function render(params: Record<string, string> = {}) {
  return renderToStaticMarkup(await LabelPage({ searchParams: Promise.resolve(params) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSettings.mockResolvedValue({ schoolName: 'SMK Negeri 1 Contoh', receiptFooter: null });
});

describe('LabelPage', () => {
  it('tanpa pilihan: menampilkan petunjuk dan tidak membaca eksemplar', async () => {
    const html = await render();

    expect(mockFind).not.toHaveBeenCalled();
    expect(html).toContain('Cetak Label Barcode');
    expect(html).toContain('name="dari"');
    expect(html).toContain('name="sampai"');
    expect(html).toContain('Cetak Label');
    expect(html).toContain('@page { size: A4; margin: 0; }');
    expect(html).toContain('Lembar label A4 3 × 7, 63,5 × 38,1 mm (tipe L7160 atau yang setara)');
  });

  it('menjelaskan rentang yang tidak lengkap tanpa membaca eksemplar', async () => {
    const html = await render({ dari: 'BK-000001' });

    expect(mockFind).not.toHaveBeenCalled();
    expect(html).toContain('Isi barcode awal dan akhir rentang');
    expect(html).toContain('value="BK-000001"');
  });

  it('mencetak satu label per eksemplar dengan nama sekolah, judul, barcode, dan rak', async () => {
    mockFind.mockResolvedValueOnce({ copies: [copy('BK-000001'), copy('BK-000002')], total: 2, bookTitle: null });

    const html = await render({ dari: 'bk-000001', sampai: 'BK-000002' });

    expect(mockFind).toHaveBeenCalledWith({ kind: 'range', from: 'BK-000001', to: 'BK-000002' });
    expect(html).toContain('2 label · 1 lembar A4');
    expect(html).toContain('aria-label="Barcode BK-000001"');
    expect(html).toContain('aria-label="Barcode BK-000002"');
    expect(html.match(/SMK Negeri 1 Contoh/g)).toHaveLength(2);
    expect(html).toContain('Rak A-3');
  });

  it('per judul: menyebut judulnya dan kembali ke halaman buku', async () => {
    mockFind.mockResolvedValueOnce({ copies: [copy('BK-000007', 'Basis Data')], total: 1, bookTitle: 'Basis Data' });

    const html = await render({ buku: 'b1' });

    expect(mockFind).toHaveBeenCalledWith({ kind: 'book', bookId: 'b1' });
    expect(html).toContain('1 label untuk &quot;Basis Data&quot; · 1 lembar A4');
    expect(html).toContain('href="/master/buku/b1"');
  });

  it('menjelaskan bila tidak ada eksemplar yang cocok dalam rentang', async () => {
    mockFind.mockResolvedValueOnce({ copies: [], total: 0, bookTitle: null });
    expect(await render({ dari: 'BK-900000', sampai: 'BK-900010' }))
      .toContain('Tidak ada eksemplar aktif dengan barcode BK-900000 sampai BK-900010.');
  });

  it('per judul: menjelaskan buku yang ada tetapi belum punya eksemplar aktif', async () => {
    mockFind.mockResolvedValueOnce({ copies: [], total: 0, bookTitle: 'Basis Data' });
    expect(await render({ buku: 'b1' }))
      .toContain('Judul ini belum punya eksemplar aktif untuk dilabeli.');
  });

  it('per judul: menjelaskan id yang bukan UUID atau buku yang tidak ditemukan', async () => {
    mockFind.mockResolvedValueOnce({ copies: [], total: 0, bookTitle: null });
    const html = await render({ buku: 'bukan-uuid' });
    expect(html).toContain('Buku tidak ditemukan. Buka ulang dari Master Data → Buku.');
    expect(html).not.toContain('Judul ini belum punya eksemplar aktif');
  });

  it('memberi tahu bila rentang melebihi batas sekali cetak', async () => {
    const copies = Array.from({ length: 210 }, (_, index) => copy(`BK-${String(index + 1).padStart(6, '0')}`));
    mockFind.mockResolvedValueOnce({ copies, total: 250, bookTitle: null });

    const html = await render({ dari: 'BK-000001', sampai: 'BK-000250' });

    expect(html).toContain(
      'Rentang ini berisi 250 eksemplar; sekali cetak maksimal 210 label (10 lembar). Yang tampil sampai BK-000210; cetak sisanya dengan rentang mulai setelah barcode itu.',
    );
    expect(html).toContain('210 label · 10 lembar A4');
  });

  it('memberi tahu bila permintaan per judul melebihi batas sekali cetak', async () => {
    const copies = Array.from({ length: 210 }, (_, index) => copy(`BK-${String(index + 1).padStart(6, '0')}`, 'Basis Data'));
    mockFind.mockResolvedValueOnce({ copies, total: 250, bookTitle: 'Basis Data' });

    const html = await render({ buku: 'b1' });

    expect(html).toContain(
      'Judul ini punya 250 eksemplar; sekali cetak maksimal 210 label (10 lembar). Yang tampil sampai BK-000210; cetak sisanya dengan rentang mulai setelah barcode itu.',
    );
    expect(html).not.toContain('Rentang ini berisi');
  });

  it('merender dua lembar terpisah untuk 22 label', async () => {
    const copies = Array.from({ length: 22 }, (_, index) => copy(`BK-${String(index + 1).padStart(6, '0')}`));
    mockFind.mockResolvedValueOnce({ copies, total: 22, bookTitle: null });

    const html = await render({ dari: 'BK-000001', sampai: 'BK-000022' });

    expect(html.match(/data-sheet/g)).toHaveLength(2);
  });

  it('memperingatkan barcode yang tidak dapat dikodekan, tanpa menggagalkan label lain', async () => {
    mockFind.mockResolvedValueOnce({ copies: [copy('BK-000001'), copy('BUKU-É1')], total: 2, bookTitle: null });

    const html = await render({ dari: 'B', sampai: 'BZ' });

    expect(html).toContain('1 barcode tidak dapat dicetak sebagai Code128: BUKU-É1.');
    expect(html).toContain('aria-label="Barcode BK-000001"');
    expect(html).toContain('Tidak dapat dicetak sebagai barcode');
  });
});
