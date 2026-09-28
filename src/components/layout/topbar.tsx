import { Calendar, ChevronDown, LogOut, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { initials } from '@/lib/format';
import { signOut } from '@/server/actions/auth';

const PILL = 'inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 py-1.5 text-sm';

export function Topbar({
  academicYear,
  userName,
}: {
  academicYear: string | null;
  userName: string;
}) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-[var(--color-ink-100)] bg-white px-4 lg:px-8 print:hidden">
      {/* Tahun ajaran selalu terlihat: petugas harus tahu ke tahun mana
          transaksinya masuk, tanpa perlu membuka halaman lain. Tombolnya
          membuka halaman Tahun Ajaran, tempat tahun aktif diganti. */}
      {academicYear ? (
        <Link
          href="/pengaturan/tahun-ajaran"
          title="Kelola tahun ajaran"
          className={`${PILL} border-[var(--color-ink-100)] text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)]`}
        >
          <Calendar aria-hidden="true" className="size-4 text-[var(--color-ink-500)]" strokeWidth={1.75} />
          <span>
            <span className="sr-only sm:not-sr-only">Tahun Ajaran </span><strong className="font-bold text-[var(--color-ink-900)]">{academicYear}</strong>
          </span>
          <ChevronDown aria-hidden="true" className="size-4 text-[var(--color-ink-500)]" strokeWidth={1.75} />
        </Link>
      ) : (
        <Link
          href="/pengaturan/tahun-ajaran"
          className={`${PILL} border-[var(--color-status-terlambat)]/30 bg-[var(--color-status-terlambat)]/5 font-medium text-[var(--color-status-terlambat)]`}
        >
          <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
          Belum ada tahun ajaran aktif — transaksi tidak dapat dibuat
        </Link>
      )}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="grid size-9 place-items-center rounded-full bg-[var(--color-accent-100)] text-[13px] font-bold text-[var(--color-accent-600)]"
          >
            {initials(userName)}
          </span>
          <span className="hidden text-[15px] font-semibold text-[var(--color-ink-900)] sm:block">{userName}</span>
        </div>
        <span aria-hidden="true" className="h-6 w-px bg-[var(--color-ink-100)]" />
        <form action={signOut}>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-md text-[15px] text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)]"
          >
            <LogOut aria-hidden="true" className="size-4" strokeWidth={1.75} />
            Keluar
          </button>
        </form>
      </div>
    </header>
  );
}
