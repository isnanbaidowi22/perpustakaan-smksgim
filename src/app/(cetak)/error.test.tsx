import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ErrorPage from './error';

describe('ErrorPage (cetak)', () => {
  it('menampilkan pesan galat dalam bahasa Indonesia, tombol coba lagi, dan tautan ke dashboard', () => {
    const retry = vi.fn();
    const error = Object.assign(new Error('boom'), { digest: 'abc123' });

    const html = renderToStaticMarkup(<ErrorPage error={error} retry={retry} />);

    expect(html).toContain('Halaman ini gagal dimuat');
    expect(html).toContain('Coba lagi');
    expect(html).toContain('href="/dashboard"');
  });
});
