import { ArrowDownLeft, Plus } from 'lucide-react';
import Link from 'next/link';
import { buttonClass } from '@/components/ui/button-styles';
import { CARD, CARD_TITLE } from '@/components/ui/card-styles';
import { LoanStatusBadge } from '@/components/ui/loan-status-badge';
import { Notice } from '@/components/ui/notice';
import { PageHeader } from '@/components/ui/page-header';
import { TD, TH } from '@/components/ui/table-styles';
import { formatDate, formatLongDate } from '@/lib/format';
import { schoolToday } from '@/lib/school-date';
import { requireProfile } from '@/server/auth/guard';
import { getDashboardStats, listDueToday, type DashboardStats, type DueTodayRow } from '@/server/queries/dashboard';
import { listLoans, type LoanRow } from '@/server/queries/loans';

const RECENT_LIMIT = 8;
const NUMBER_LINK = 'tabular rounded-sm hover:underline decoration-2 underline-offset-4';

function count(value: number): string {
  return value.toLocaleString('id-ID');
}

/** Persen eksemplar yang ada di rak, dibulatkan ke bawah agar 99,6% tidak tampil sebagai 100%. */
function shelfPercent(stats: DashboardStats): number {
  return stats.totalCopies === 0 ? 0 : Math.floor((stats.availableCopies / stats.totalCopies) * 100);
}

function CollectionCard({ stats }: { stats: DashboardStats }) {
  const percent = shelfPercent(stats);
  const columns = [
    { label: 'Total eksemplar', value: stats.totalCopies, href: '/master/buku', tone: 'text-[var(--color-ink-900)]' },
    { label: 'Tersedia', value: stats.availableCopies, href: '/master/buku', tone: 'text-[var(--color-accent-600)]' },
    { label: 'Sedang dipinjam', value: stats.borrowedCopies, href: '/transaksi/riwayat?status=open', tone: 'text-[var(--color-ink-900)]' },
  ];
  return (
    <section aria-labelledby="koleksi" className={`${CARD} p-6`}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="koleksi" className={CARD_TITLE}>Koleksi</h2>
        <span className="text-[13px] text-[var(--color-ink-500)]">{count(stats.totalTitles)} judul aktif</span>
      </div>
      <dl className="mt-4 grid grid-cols-3 divide-x divide-[var(--color-divider)]">
        {columns.map((column) => (
          <div key={column.label} className="min-w-0 pl-4 first:pl-0">
            <dt className="text-[13px] text-[var(--color-ink-500)]">{column.label}</dt>
            <dd className={`mt-1 text-3xl font-bold tracking-tight sm:text-4xl ${column.tone}`}>
              <Link href={column.href} className={NUMBER_LINK}>{count(column.value)}</Link>
            </dd>
          </div>
        ))}
      </dl>
      <div aria-hidden="true" className="mt-5 h-2 overflow-hidden rounded-full bg-[var(--color-ink-100)]">
        <div className="h-full rounded-full bg-[var(--color-accent-600)]" style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-2.5 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-[var(--color-ink-500)]">
        <span>{percent}% eksemplar ada di rak</span>
        <span>{count(stats.borrowedCopies)} di tangan siswa</span>
      </div>
    </section>
  );
}

function RecentLoans({ rows }: { rows: LoanRow[] }) {
  return (
    <section aria-labelledby="transaksi-terbaru" className={`${CARD} overflow-hidden`}>
      <div className="flex items-center justify-between gap-4 px-6 py-5">
        <h2 id="transaksi-terbaru" className={CARD_TITLE}>Transaksi Terbaru</h2>
        <Link href="/transaksi/riwayat" className="text-[15px] font-medium text-[var(--color-accent-600)] hover:underline">
          Lihat semua
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm [&_tbody_tr:hover]:bg-[var(--color-ink-50)]/70">
          <thead>
            <tr className="border-t border-[var(--color-divider)]">
              <th className={TH}>No. Transaksi</th>
              <th className={TH}>Siswa</th>
              <th className={TH}>Pinjam</th>
              <th className={TH}>Jatuh tempo</th>
              <th className={TH}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className={`${TD} text-center text-[var(--color-ink-500)]`}>Belum ada transaksi.</td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id}>
                <td className={TD}>
                  <Link href={`/transaksi/riwayat/${row.id}`} className="whitespace-nowrap font-mono font-semibold text-[var(--color-accent-600)] hover:underline">
                    {row.transactionNumber}
                  </Link>
                </td>
                <td className={TD}>
                  <span className="block font-semibold text-[var(--color-ink-900)]">{row.studentName}</span>
                  <span className="block text-xs text-[var(--color-ink-500)]">{row.studentClass}</span>
                </td>
                <td className={TD}>{formatDate(row.loanDate)}</td>
                <td className={TD}>{formatDate(row.dueDate)}</td>
                <td className={TD}><LoanStatusBadge status={row.status} daysOverdue={row.daysOverdue} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ActivityTile({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <Link href="/transaksi/riwayat" className="block rounded-xl bg-[var(--color-ink-50)] p-4 hover:bg-[var(--color-divider)]">
      <span className="block text-[13px] text-[var(--color-ink-500)]">{label}</span>
      <span className="tabular mt-1 block text-3xl font-bold tracking-tight text-[var(--color-ink-900)]">{count(value)}</span>
      <span className="mt-1 block text-xs text-[var(--color-ink-500)]">{detail}</span>
    </Link>
  );
}

function TodayCard({ stats }: { stats: DashboardStats }) {
  return (
    <section aria-labelledby="aktivitas-hari-ini" className={`${CARD} p-6`}>
      <h2 id="aktivitas-hari-ini" className={CARD_TITLE}>Aktivitas hari ini</h2>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <ActivityTile label="Peminjaman" value={stats.loansToday} detail={`${count(stats.copiesLentToday)} buku`} />
        <ActivityTile label="Pengembalian" value={stats.loansReturnedToday} detail={`${count(stats.copiesReturnedToday)} buku`} />
      </div>
    </section>
  );
}

function AttentionCard({ stats, dueToday }: { stats: DashboardStats; dueToday: DueTodayRow[] }) {
  const overdue = stats.overdueLoans > 0;
  return (
    <section aria-labelledby="perlu-perhatian" className={`${CARD} p-6`}>
      <h2 id="perlu-perhatian" className={CARD_TITLE}>Perlu perhatian</h2>
      <dl className="mt-2 divide-y divide-[var(--color-divider)] text-[15px]">
        <div className="flex items-center justify-between gap-4 py-3">
          <dt className="text-[var(--color-ink-700)]">Terlambat</dt>
          <dd>
            <Link
              href="/transaksi/riwayat?status=overdue"
              className={`font-bold hover:underline ${overdue ? 'text-[var(--color-status-terlambat)]' : 'text-[var(--color-ink-900)]'}`}
            >
              {count(stats.overdueLoans)} transaksi
            </Link>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 py-3">
          <dt className="text-[var(--color-ink-700)]">Jatuh tempo hari ini</dt>
          <dd className="font-bold text-[var(--color-ink-900)]">{count(dueToday.length)} pinjaman</dd>
        </div>
      </dl>

      {!overdue && dueToday.length === 0 && (
        <Notice tone="success" className="mt-3">Semua pinjaman tepat waktu. Tidak ada yang perlu ditindaklanjuti.</Notice>
      )}
      {overdue && (
        <Notice tone="danger" className="mt-3">
          {count(stats.overdueCopies)} buku belum kembali melewati jatuh tempo.{' '}
          <Link href="/transaksi/riwayat?status=overdue" className="font-semibold underline underline-offset-2">Lihat daftarnya</Link>
        </Notice>
      )}
      {dueToday.length > 0 && (
        <ul aria-label="Jatuh tempo hari ini" className="mt-3 space-y-2">
          {dueToday.map((row) => (
            <li key={row.id} className="rounded-lg bg-[var(--color-ink-50)] px-3.5 py-3 text-sm">
              <Link
                href={`/transaksi/riwayat/${row.id}`}
                className="font-semibold text-[var(--color-ink-900)] hover:text-[var(--color-accent-600)] hover:underline"
              >
                {row.studentName}
              </Link>
              <span className="mt-0.5 block text-xs text-[var(--color-ink-500)]">
                {row.studentClass} · <span className="font-mono">{row.transactionNumber}</span> · {row.openCount} buku
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function DashboardPage() {
  const profile = await requireProfile();
  const today = schoolToday();
  const [stats, dueToday, recent] = await Promise.all([
    getDashboardStats(today),
    listDueToday(today),
    listLoans({ q: '', status: 'all', page: 1 }, today),
  ]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${formatLongDate(today)} · Selamat bertugas, ${profile.fullName}`}
        actions={(
          <>
            <Link href="/transaksi/pengembalian" className={buttonClass('secondary')}>
              <ArrowDownLeft aria-hidden="true" />Pengembalian
            </Link>
            <Link href="/transaksi/peminjaman" className={buttonClass('primary')}>
              <Plus aria-hidden="true" />Peminjaman Baru
            </Link>
          </>
        )}
      />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
        <div className="min-w-0 space-y-5 lg:col-span-2">
          <CollectionCard stats={stats} />
          <RecentLoans rows={recent.rows.slice(0, RECENT_LIMIT)} />
        </div>
        <div className="min-w-0 space-y-5">
          <TodayCard stats={stats} />
          <AttentionCard stats={stats} dueToday={dueToday} />
        </div>
      </div>
    </>
  );
}
