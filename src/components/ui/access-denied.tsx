import Link from 'next/link';
import { buttonClass } from './button-styles';

/**
 * Ditampilkan halaman khusus admin saat dibuka petugas lewat URL langsung.
 * `forbidden()` Next.js 16 masih eksperimental, jadi halaman menampilkan
 * panel ini sendiri. Server Action-nya tetap menolak lewat `authorize`.
 */
export function AccessDenied() {
  return (
    <div role="alert" className="max-w-xl rounded-lg border border-[var(--color-ink-100)] bg-white p-6">
      <h1 className="page-title text-xl font-semibold">Akses ditolak</h1>
      <p className="mt-2 text-sm text-[var(--color-ink-500)]">
        Halaman ini hanya untuk admin. Minta admin perpustakaan bila pengaturan ini perlu diubah.
      </p>
      <Link href="/dashboard" className={`${buttonClass('secondary')} mt-4`}>Kembali ke Dashboard</Link>
    </div>
  );
}
