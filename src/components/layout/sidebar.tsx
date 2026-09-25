import Link from 'next/link';
import type { UserRole } from '@/domain/shared/types';

interface NavSection {
  group: string | null;
  /** Bila diisi, grup hanya tampil untuk peran ini. Server tetap menegakkan aksesnya. */
  roles?: UserRole[];
  items: { href: string; label: string }[];
}

const NAV: NavSection[] = [
  { group: null, items: [{ href: '/dashboard', label: 'Dashboard' }] },
  {
    group: 'Master Data',
    items: [
      { href: '/master/buku', label: 'Buku' },
      { href: '/master/kategori', label: 'Kategori' },
      { href: '/master/siswa', label: 'Siswa' },
      { href: '/master/rak', label: 'Rak' },
    ],
  },
  {
    group: 'Transaksi',
    items: [
      { href: '/transaksi/peminjaman', label: 'Peminjaman' },
      { href: '/transaksi/pengembalian', label: 'Pengembalian' },
      { href: '/transaksi/riwayat', label: 'Riwayat' },
    ],
  },
  {
    // PRD bab 11. Halamannya dibuat di Rencana 06; sampai saat itu tautan ini 404.
    group: 'Laporan',
    items: [
      { href: '/laporan/peminjaman', label: 'Peminjaman' },
      { href: '/laporan/pengembalian', label: 'Pengembalian' },
      { href: '/laporan/keterlambatan', label: 'Keterlambatan' },
      { href: '/laporan/koleksi', label: 'Koleksi Buku' },
    ],
  },
  {
    group: 'Pengaturan',
    roles: ['admin'],
    items: [
      { href: '/pengaturan/tahun-ajaran', label: 'Tahun Ajaran' },
      { href: '/pengaturan/pengguna', label: 'Pengguna' },
      { href: '/pengaturan/konfigurasi', label: 'Konfigurasi' },
    ],
  },
];

export function Sidebar({ role }: { role: UserRole }) {
  const sections = NAV.filter((section) => !section.roles || section.roles.includes(role));

  return (
    <nav
      aria-label="Menu utama"
      className="h-full w-60 overflow-y-auto border-r border-[var(--color-ink-100)] bg-white px-3 py-5"
    >
      <div className="px-3 pb-6 font-serif text-lg font-semibold">Perpustakaan</div>
      {sections.map((section) => (
        <div key={section.group ?? 'utama'} className="mb-5">
          {section.group && (
            <div className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-500)]">
              {section.group}
            </div>
          )}
          {section.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-1.5 text-sm text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)]"
            >
              {item.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
