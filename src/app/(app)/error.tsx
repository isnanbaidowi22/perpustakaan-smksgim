'use client';

import Link from 'next/link';
import { buttonClass } from '@/components/ui/button-styles';

/**
 * Next.js 16: `retry()` mencoba merender ulang anak error boundary ini tanpa
 * memuat ulang seluruh halaman (lihat error.md § Props, `retry` stabil sejak
 * v16.3.0). Pesannya sengaja umum — detail galat server tidak boleh bocor
 * ke klien di produksi.
 */
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-4 text-center">
      <h1 className="page-title text-2xl font-semibold">Halaman ini gagal dimuat</h1>
      <p className="max-w-sm text-sm text-[var(--color-ink-500)]">
        Terjadi masalah saat memuat halaman ini. Coba lagi, atau kembali ke dashboard bila masalah berlanjut.
      </p>
      {error.digest && (
        <p className="text-xs text-[var(--color-ink-300)]">Kode rujukan: {error.digest}</p>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={() => retry()} className={buttonClass('primary')}>Coba lagi</button>
        <Link href="/dashboard" className={buttonClass('secondary')}>Kembali ke Dashboard</Link>
      </div>
    </main>
  );
}
