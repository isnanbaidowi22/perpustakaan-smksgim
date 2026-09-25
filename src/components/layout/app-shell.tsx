'use client';

import { usePathname } from 'next/navigation';
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { buttonClass } from '@/components/ui/button-styles';

/**
 * Kerangka responsif (PRD bab 9: desktop dan tablet). Mulai lebar 1024px (lg)
 * sidebar selalu tampil. Di bawahnya sidebar tersembunyi dan dibuka lewat
 * tombol Menu sebagai panel di atas konten.
 *
 * Tombol Menu ditempatkan sebelum panel #navigasi-utama dalam DOM (bukan di
 * dalam kolom konten) supaya urutan Tab maju dari tombol langsung masuk ke
 * tautan menu, bukan melompat ke topbar/konten yang tertutup panel.
 */
export function AppShell({
  sidebar,
  topbar,
  children,
}: {
  sidebar: ReactNode;
  topbar: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  // Menu dianggap terbuka hanya di halaman tempat ia dibuka. Begitu petugas
  // berpindah halaman lewat tautan sidebar, panel tertutup sendiri tanpa
  // efek yang menyinkronkan state dengan URL.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn !== null && openOn === pathname;
  const toggleRef = useRef<HTMLButtonElement>(null);

  function close() {
    setOpenOn(null);
    toggleRef.current?.focus();
  }

  function handlePanelKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') close();
  }

  return (
    <div className="min-h-screen lg:flex">
      <div className="flex items-center border-b border-[var(--color-ink-100)] bg-white px-4 py-2 lg:hidden">
        <button
          ref={toggleRef}
          type="button"
          aria-expanded={open}
          aria-controls="navigasi-utama"
          onClick={() => setOpenOn(open ? null : pathname)}
          className={buttonClass('secondary', 'sm')}
        >
          <span aria-hidden="true">☰</span>&nbsp;Menu
        </button>
      </div>
      <div
        id="navigasi-utama"
        className={open ? 'fixed inset-0 z-30 flex lg:static lg:z-auto' : 'hidden lg:flex'}
        onKeyDown={handlePanelKeyDown}
      >
        <div className="h-full shrink-0">{sidebar}</div>
        {open && (
          <button
            type="button"
            aria-label="Tutup menu"
            onClick={close}
            className="flex-1 bg-[var(--color-ink-900)]/40 lg:hidden"
          />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col" inert={open}>
        {topbar}
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
