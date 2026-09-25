import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AccessDenied } from './access-denied';

describe('AccessDenied', () => {
  it('menjelaskan bahwa halaman khusus admin dan menawarkan jalan kembali', () => {
    const html = renderToStaticMarkup(<AccessDenied />);
    expect(html).toContain('Akses ditolak');
    expect(html).toContain('Halaman ini hanya untuk admin');
    expect(html).toContain('href="/dashboard"');
  });
});
