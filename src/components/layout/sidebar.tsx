'use client';

import {
  ArrowDownLeft, ArrowUpRight, Book, Calendar, ChevronsLeft, ChevronsRight, CircleAlert, Clock,
  FileChartColumn, LayoutDashboard, LibraryBig, Rows3, ScrollText, SlidersVertical, Tag, UserRoundPlus,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { SIDEBAR_COOKIE, SIDEBAR_RAIL } from './sidebar-state';

interface NavSection {
  group: string | null;
  items: { href: string; label: string; icon: LucideIcon }[];
}

const NAV: NavSection[] = [
  { group: null, items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    group: 'Master Data',
    items: [
      { href: '/master/buku', label: 'Buku', icon: Book },
      { href: '/master/kategori', label: 'Kategori', icon: Tag },
      { href: '/master/rak', label: 'Rak', icon: Rows3 },
    ],
  },
  {
    group: 'Transaksi',
    items: [
      { href: '/transaksi/peminjaman', label: 'Peminjaman', icon: ArrowUpRight },
      { href: '/transaksi/pengembalian', label: 'Pengembalian', icon: ArrowDownLeft },
      { href: '/transaksi/riwayat', label: 'Riwayat', icon: Clock },
    ],
  },
  {
    // PRD bab 11: laporan terlihat oleh setiap akun.
    group: 'Laporan',
    items: [
      { href: '/laporan/peminjaman', label: 'Peminjaman', icon: FileChartColumn },
      { href: '/laporan/pengembalian', label: 'Pengembalian', icon: FileChartColumn },
      { href: '/laporan/keterlambatan', label: 'Keterlambatan', icon: CircleAlert },
      { href: '/laporan/koleksi', label: 'Koleksi Buku', icon: LibraryBig },
    ],
  },
  {
    group: 'Pengaturan',
    items: [
      { href: '/pengaturan/tahun-ajaran', label: 'Tahun Ajaran', icon: Calendar },
      { href: '/pengaturan/pengguna', label: 'Pengguna', icon: UserRoundPlus },
      { href: '/pengaturan/konfigurasi', label: 'Konfigurasi', icon: SlidersVertical },
      { href: '/pengaturan/audit-log', label: 'Audit Log', icon: ScrollText },
    ],
  },
];

/** Menu aktif juga untuk halaman turunannya, mis. /master/buku/123 menyalakan "Buku". */
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const ROW = 'flex h-9 items-center gap-3 rounded-lg px-2.5 text-[15px] transition-colors';

/**
 * Menu utama. Mode ringkas (rail) hanya berlaku mulai lebar lg: di layar
 * sempit menu tampil sebagai panel penuh, jadi seluruh kelas rail berawalan
 * `lg:`. Label yang disembunyikan tetap dibaca pembaca layar (`sr-only`).
 */
export function Sidebar({ schoolName, defaultRail = false }: { schoolName: string | null; defaultRail?: boolean }) {
  const pathname = usePathname() ?? '';
  const [rail, setRail] = useState(defaultRail);
  const hideInRail = rail ? 'lg:sr-only' : '';

  function toggleRail() {
    const next = !rail;
    setRail(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? SIDEBAR_RAIL : 'lebar'}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <nav
      aria-label="Menu utama"
      className={`flex h-full w-64 flex-col border-r border-[var(--color-ink-100)] bg-white transition-[width] duration-200 ${rail ? 'lg:w-[4.5rem]' : ''}`}
    >
      <div className={`flex h-16 shrink-0 items-center gap-3 border-b border-[var(--color-divider)] px-5 ${rail ? 'lg:justify-center lg:px-0' : ''}`}>
        <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[var(--color-accent-600)] text-white">
          <Book aria-hidden="true" className="size-[18px]" strokeWidth={2} />
        </span>
        <span className={`min-w-0 leading-tight ${hideInRail}`}>
          <span className="block text-[15px] font-bold text-[var(--color-ink-900)]">Perpustakaan</span>
          {schoolName && <span className="block truncate text-xs text-[var(--color-ink-500)]">{schoolName}</span>}
        </span>
      </div>

      <div className="flex-1 overflow-x-hidden overflow-y-auto px-3 py-3">
        {NAV.map((section) => (
          <div key={section.group ?? 'utama'} className="mb-2 last:mb-0">
            {section.group && (
              <>
                <div className={`px-2.5 pt-1.5 pb-1.5 text-[11px] font-semibold tracking-[0.08em] text-[var(--color-ink-400)] uppercase ${hideInRail}`}>
                  {section.group}
                </div>
                {rail && <div aria-hidden="true" className="mx-2 my-2 hidden border-t border-[var(--color-divider)] lg:block" />}
              </>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActivePath(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      title={rail ? (section.group ? `${item.label} (${section.group})` : item.label) : undefined}
                      className={`${ROW} ${rail ? 'lg:justify-center lg:px-0' : ''} ${active
                        ? 'bg-[var(--color-accent-100)] font-semibold text-[var(--color-accent-700)]'
                        : 'text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)] hover:text-[var(--color-ink-900)]'}`}
                    >
                      <Icon
                        aria-hidden="true"
                        strokeWidth={1.75}
                        className={`size-[18px] shrink-0 ${active ? 'text-[var(--color-accent-600)]' : 'text-[var(--color-ink-500)]'}`}
                      />
                      <span className={rail ? 'lg:sr-only' : 'truncate'}>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="hidden shrink-0 border-t border-[var(--color-divider)] p-3 lg:block">
        <button
          type="button"
          onClick={toggleRail}
          title={rail ? 'Luaskan menu' : undefined}
          className={`${ROW} w-full text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)] hover:text-[var(--color-ink-900)] ${rail ? 'lg:justify-center lg:px-0' : ''}`}
        >
          {rail
            ? <ChevronsRight aria-hidden="true" strokeWidth={1.75} className="size-[18px] shrink-0 text-[var(--color-ink-500)]" />
            : <ChevronsLeft aria-hidden="true" strokeWidth={1.75} className="size-[18px] shrink-0 text-[var(--color-ink-500)]" />}
          <span className={hideInRail}>{rail ? 'Luaskan menu' : 'Ciutkan menu'}</span>
        </button>
      </div>
    </nav>
  );
}
