import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@/server/actions/copies', () => ({ addCopiesAction: vi.fn(), changeCopyStatusAction: vi.fn() }));

import { CopiesSection } from './copies-section';

const copies = [
  { id: 'k1', barcode: 'BK-000001', status: 'TERSEDIA' as const, acquisitionDate: '2026-07-15', notes: null },
  { id: 'k2', barcode: 'BK-000002', status: 'RUSAK' as const, acquisitionDate: null, notes: 'Sampul sobek' },
];

describe('CopiesSection', () => {
  it('menampilkan eksemplar, ringkasan ketersediaan, dan aksi status untuk admin', () => {
    const html = renderToStaticMarkup(
      <CopiesSection bookId="b1" bookActive copies={copies} canManageStatus />,
    );

    expect(html).toContain('1 dari 2 eksemplar tersedia');
    expect(html).toContain('BK-000002');
    expect(html).toContain('15/07/2026');
    expect(html).toContain('Sampul sobek');
    expect(html).toContain('Rusak');
    expect(html).toContain('Pulihkan ke tersedia');
    expect(html).toContain('Tarik dari koleksi');
    expect(html).toContain('name="count"');
  });

  it('menyembunyikan aksi status dari petugas', () => {
    const html = renderToStaticMarkup(
      <CopiesSection bookId="b1" bookActive copies={copies} canManageStatus={false} />,
    );
    expect(html).not.toContain('Pulihkan ke tersedia');
    expect(html).not.toContain('Tarik dari koleksi');
  });

  it('mengganti form tambah dengan penjelasan bila buku nonaktif', () => {
    const html = renderToStaticMarkup(
      <CopiesSection bookId="b1" bookActive={false} copies={[]} canManageStatus />,
    );
    expect(html).toContain('Belum ada eksemplar');
    expect(html).toContain('Buku ini nonaktif');
    expect(html).not.toContain('name="count"');
  });
});
