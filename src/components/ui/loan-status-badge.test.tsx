import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LoanStatusBadge } from './loan-status-badge';

describe('LoanStatusBadge', () => {
  it('menampilkan Terlambat beserta jumlah harinya untuk pinjaman terbuka yang lewat jatuh tempo', () => {
    const html = renderToStaticMarkup(<LoanStatusBadge status="SEBAGIAN_KEMBALI" daysOverdue={4} />);
    expect(html).toContain('Terlambat 4 hari');
  });

  it('menampilkan label status tersimpan bila tidak terlambat', () => {
    expect(renderToStaticMarkup(<LoanStatusBadge status="AKTIF" daysOverdue={0} />)).toContain('Dipinjam');
    expect(renderToStaticMarkup(<LoanStatusBadge status="SEBAGIAN_KEMBALI" daysOverdue={0} />)).toContain('Sebagian kembali');
    expect(renderToStaticMarkup(<LoanStatusBadge status="SELESAI" daysOverdue={0} />)).toContain('Selesai');
  });

  it('menyertakan ikon, tidak hanya warna (spec 8.1)', () => {
    expect(renderToStaticMarkup(<LoanStatusBadge status="AKTIF" daysOverdue={0} />)).toContain('aria-hidden="true"');
  });
});
