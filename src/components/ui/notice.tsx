import { Check, CircleAlert, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

type Tone = 'success' | 'danger' | 'warning';

const TONES: Record<Tone, { className: string; Icon: typeof Check }> = {
  success: { className: 'bg-[var(--color-accent-100)] text-[var(--color-accent-700)]', Icon: Check },
  danger: { className: 'bg-[var(--color-status-terlambat)]/8 text-[var(--color-status-terlambat)]', Icon: CircleAlert },
  warning: { className: 'bg-[var(--color-status-rusak)]/10 text-[var(--color-status-rusak)]', Icon: TriangleAlert },
};

/** Kotak pesan berwarna dengan ikon, seperti "Semua pinjaman tepat waktu" di dashboard. */
export function Notice({
  tone, role, className = '', children,
}: { tone: Tone; role?: 'status' | 'alert'; className?: string; children: ReactNode }) {
  const { className: toneClass, Icon } = TONES[tone];
  return (
    <div role={role} className={`flex gap-2.5 rounded-lg px-4 py-3 text-sm ${toneClass} ${className}`}>
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
