import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import NotFound from './not-found';

describe('NotFound', () => {
  it('menampilkan pesan halaman tidak ditemukan dalam bahasa Indonesia dan tautan ke dashboard', () => {
    const html = renderToStaticMarkup(<NotFound />);

    expect(html).toContain('Halaman tidak ditemukan');
    expect(html).toContain('href="/dashboard"');
  });
});
