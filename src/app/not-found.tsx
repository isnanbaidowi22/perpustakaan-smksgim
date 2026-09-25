import Link from 'next/link';
import { buttonClass } from '@/components/ui/button-styles';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-4 text-center">
      <h1 className="page-title text-2xl font-semibold">Halaman tidak ditemukan</h1>
      <p className="max-w-sm text-sm text-[var(--color-ink-500)]">
        Alamat yang Anda tuju tidak ada, atau sudah dipindahkan. Periksa kembali tautannya, atau kembali ke dashboard.
      </p>
      <Link href="/dashboard" className={buttonClass('primary')}>Kembali ke Dashboard</Link>
    </main>
  );
}
