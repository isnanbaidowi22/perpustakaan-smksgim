import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({ usePathname: () => '/master/buku' }));

import { AppShell } from './app-shell';

function render() {
  return renderToStaticMarkup(
    <AppShell sidebar={<nav>isi sidebar</nav>} topbar={<header>isi topbar</header>}>
      <p>isi halaman</p>
    </AppShell>,
  );
}

describe('AppShell', () => {
  it('menyusun sidebar, top bar, dan isi halaman', () => {
    const html = render();
    expect(html).toContain('isi sidebar');
    expect(html).toContain('isi topbar');
    expect(html).toMatch(/<main[^>]*><p>isi halaman<\/p><\/main>/);
  });

  it('menyembunyikan sidebar di bawah lebar lg sampai tombol Menu ditekan', () => {
    const html = render();
    expect(html).toContain('id="navigasi-utama" class="hidden lg:flex"');
    expect(html).toMatch(/<button[^>]*aria-expanded="false"[^>]*aria-controls="navigasi-utama"/);
    expect(html).toContain('Menu');
  });

  it('menempatkan tombol Menu sebelum panel navigasi agar urutan Tab maju masuk ke menu', () => {
    const html = render();
    const buttonIndex = html.indexOf('aria-controls="navigasi-utama"');
    const panelIndex = html.indexOf('id="navigasi-utama"');
    expect(buttonIndex).toBeGreaterThan(-1);
    expect(panelIndex).toBeGreaterThan(-1);
    expect(buttonIndex).toBeLessThan(panelIndex);
  });
});
