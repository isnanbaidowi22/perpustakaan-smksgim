import Link from 'next/link';
import { buttonClass } from '@/components/ui/button-styles';
import { LoanStatusBadge } from '@/components/ui/loan-status-badge';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollTable } from '@/components/ui/scroll-table';
import { TD, TH } from '@/components/ui/table-styles';
import { formatDate } from '@/lib/format';
import { schoolToday } from '@/lib/school-date';
import { requireProfile } from '@/server/auth/guard';
import { getDashboardStats, listDueToday } from '@/server/queries/dashboard';
import { listLoans } from '@/server/queries/loans';

const RECENT_LIMIT = 8;
const SECTION = 'page-title mb-3 text-lg font-semibold';
const BOX = 'rounded-lg border border-[var(--color-ink-100)] bg-white';

function StatCard({
  href, label, value, detail, alert = false,
}: { href: string; label: string; value: number; detail: string; alert?: boolean }) {
  const valueTone = alert && value > 0 ? 'text-[var(--color-status-terlambat)]' : 'text-[var(--color-ink-900)]';
  return (
    <Link href={href} className={`${BOX} block p-4 hover:border-[var(--color-accent-600)]`}>
      <span className="block text-sm text-[var(--color-ink-500)]">{label}</span>
      <span className={`tabular mt-1 block text-3xl font-semibold ${valueTone}`}>{value.toLocaleString('id-ID')}</span>
      <span className="mt-1 block text-xs text-[var(--color-ink-500)]">{detail}</span>
    </Link>
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
  const recentRows = recent.rows.slice(0, RECENT_LIMIT);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Keadaan perpustakaan hari ini, ${formatDate(today)}. Selamat bertugas, ${profile.fullName}.`}
        actions={(
          <>
            <Link href="/transaksi/peminjaman" className={buttonClass('primary')}>Peminjaman Baru</Link>
            <Link href="/transaksi/pengembalian" className={buttonClass('secondary')}>Pengembalian</Link>
          </>
        )}
      />

      <section aria-label="Ringkasan hari ini" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard href="/master/buku" label="Total Buku" value={stats.totalCopies} detail={`eksemplar · ${stats.totalTitles} judul aktif`} />
        <StatCard href="/master/buku" label="Buku Tersedia" value={stats.availableCopies} detail="eksemplar siap dipinjam dari judul aktif" />
        <StatCard href="/transaksi/riwayat?status=open" label="Sedang Dipinjam" value={stats.borrowedCopies} detail="eksemplar di tangan siswa · lihat transaksinya" />
        <StatCard
          href="/transaksi/riwayat?status=overdue"
          label="Terlambat"
          value={stats.overdueLoans}
          detail={`transaksi · ${stats.overdueCopies} buku belum kembali`}
          alert
        />
        <StatCard href="/transaksi/riwayat" label="Peminjaman Hari Ini" value={stats.loansToday} detail={`transaksi · ${stats.copiesLentToday} buku`} />
        <StatCard href="/transaksi/riwayat" label="Pengembalian Hari Ini" value={stats.copiesReturnedToday} detail="buku kembali hari ini" />
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <section aria-labelledby="jatuh-tempo-hari-ini">
          <h2 id="jatuh-tempo-hari-ini" className={SECTION}>Jatuh Tempo Hari Ini</h2>
          {dueToday.length === 0 ? (
            <p className={`${BOX} p-4 text-sm text-[var(--color-ink-500)]`}>Tidak ada pinjaman yang jatuh tempo hari ini.</p>
          ) : (
            <ul className={`${BOX} divide-y divide-[var(--color-ink-100)]`}>
              {dueToday.map((row) => (
                <li key={row.id} className="px-4 py-3 text-sm">
                  <Link href={`/transaksi/riwayat/${row.id}`} className="font-medium text-[var(--color-accent-600)] hover:underline">
                    {row.studentName}
                  </Link>
                  <span className="block text-xs text-[var(--color-ink-500)]">
                    {row.studentNis} · {row.studentClass} · <span className="font-mono">{row.transactionNumber}</span> · {row.openCount} buku
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="transaksi-terbaru" className="lg:col-span-2">
          <h2 id="transaksi-terbaru" className={SECTION}>Transaksi Terbaru</h2>
          <ScrollTable>
            <thead>
              <tr>
                <th className={TH}>No. Transaksi</th>
                <th className={TH}>Siswa</th>
                <th className={TH}>Pinjam</th>
                <th className={TH}>Jatuh Tempo</th>
                <th className={TH}>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentRows.length === 0 && (
                <tr>
                  <td colSpan={5} className={`${TD} text-center text-[var(--color-ink-500)]`}>Belum ada transaksi.</td>
                </tr>
              )}
              {recentRows.map((row) => (
                <tr key={row.id}>
                  <td className={TD}>
                    <Link href={`/transaksi/riwayat/${row.id}`} className="font-mono text-[var(--color-accent-600)] hover:underline">
                      {row.transactionNumber}
                    </Link>
                  </td>
                  <td className={TD}>
                    {row.studentName}
                    <span className="block text-xs text-[var(--color-ink-500)]">{row.studentClass}</span>
                  </td>
                  <td className={TD}>{formatDate(row.loanDate)}</td>
                  <td className={TD}>{formatDate(row.dueDate)}</td>
                  <td className={TD}><LoanStatusBadge status={row.status} daysOverdue={row.daysOverdue} /></td>
                </tr>
              ))}
            </tbody>
          </ScrollTable>
          <Link href="/transaksi/riwayat" className="mt-2 inline-block text-sm text-[var(--color-accent-600)] hover:underline">
            Lihat semua transaksi
          </Link>
        </section>
      </div>
    </>
  );
}
