import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({ usePathname: () => '/master/buku' }));

import { AppShell, getIsLargeViewport, subscribeToLargeViewport } from './app-shell';

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

describe('viewport lg (dipakai agar kolom konten tidak inert saat rotasi tablet)', () => {
  afterEach(() => {
    // @ts-expect-error -- window sengaja tidak ada di environment 'node'; dipasang manual per uji.
    delete globalThis.window;
  });

  it('getIsLargeViewport membaca hasil matchMedia("(min-width: 1024px)") saat ini', () => {
    const matchMedia = vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    // @ts-expect-error -- stub minimal window untuk lingkungan uji node.
    globalThis.window = { matchMedia };

    expect(getIsLargeViewport()).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith('(min-width: 1024px)');
  });

  it('subscribeToLargeViewport memasang dan melepas listener change pada MediaQueryList', () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const matchMedia = vi.fn(() => ({ matches: false, addEventListener, removeEventListener }));
    // @ts-expect-error -- stub minimal window untuk lingkungan uji node.
    globalThis.window = { matchMedia };

    const onChange = vi.fn();
    const unsubscribe = subscribeToLargeViewport(onChange);
    expect(addEventListener).toHaveBeenCalledWith('change', onChange);

    unsubscribe();
    expect(removeEventListener).toHaveBeenCalledWith('change', onChange);
  });
});
