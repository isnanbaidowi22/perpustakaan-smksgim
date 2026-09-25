'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { buttonClass } from '@/components/ui/button-styles';

/**
 * Tombol di atas halaman cetak. Tidak ikut tercetak. Tombol Cetak mendapat
 * fokus awal agar petugas cukup menekan Enter (alur papan ketik, spec 8.1).
 */
export function PrintToolbar({
  backHref, backLabel, autoFocus = true, children,
}: { backHref: string; backLabel: string; autoFocus?: boolean; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-ink-100)] bg-[var(--color-ink-50)] px-4 py-3 print:hidden">
      <button type="button" autoFocus={autoFocus} onClick={() => window.print()} className={buttonClass('primary')}>
        Cetak
      </button>
      <Link href={backHref} className={buttonClass('secondary')}>{backLabel}</Link>
      {children}
    </div>
  );
}
