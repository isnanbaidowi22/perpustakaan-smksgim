import type { ReactNode } from 'react';
import { CARD } from './card-styles';

/**
 * Pembungkus setiap tabel daftar. PRD bab 9 mewajibkan aplikasi dapat dipakai
 * di tablet; tabel 6–7 kolom tidak muat di 768px, jadi tabel mempertahankan
 * lebar minimumnya dan wadahnya yang digulir ke samping, bukan halamannya.
 */
export function ScrollTable({ children }: { children: ReactNode }) {
  return (
    <div className={`overflow-x-auto ${CARD} print:overflow-visible print:rounded-none`}>
      <table className="w-full min-w-[40rem] text-sm [&_tbody_tr:hover]:bg-[var(--color-ink-50)]/70 print:min-w-0 print:text-xs">
        {children}
      </table>
    </div>
  );
}
