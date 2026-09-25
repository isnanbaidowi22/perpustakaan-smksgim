import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Barcode } from './barcode';

describe('Barcode', () => {
  it('merender SVG dengan satu persegi latar dan satu persegi per bar', () => {
    const html = renderToStaticMarkup(<Barcode value="A" className="h-[14mm] w-full" />);

    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Barcode A"');
    expect(html).toContain('viewBox="0 0 66 40"');
    expect(html).toContain('class="h-[14mm] w-full"');
    expect(html.match(/<rect /g)).toHaveLength(1 + 13);
  });

  it('menampilkan teks dan peringatan bila barcode tidak dapat dikodekan', () => {
    const html = renderToStaticMarkup(<Barcode value="BUKU-É1" />);

    expect(html).not.toContain('<svg');
    expect(html).toContain('BUKU-É1');
    expect(html).toContain('Tidak dapat dicetak sebagai barcode');
  });
});
