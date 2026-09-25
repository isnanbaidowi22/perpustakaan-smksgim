import Link from 'next/link';
import { buttonClass } from '@/components/ui/button-styles';
import { FilterBar, FilterSelect } from '@/components/ui/filter-bar';
import { Flash } from '@/components/ui/flash';
import { LoanStatusBadge } from '@/components/ui/loan-status-badge';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { ScrollTable } from '@/components/ui/scroll-table';
import { TD, TH } from '@/components/ui/table-styles';
import { HISTORY_STATUS_OPTIONS, parseHistoryStatus } from '@/lib/circulation-labels';
import { formatDate, formatRupiah } from '@/lib/format';
import { parsePage } from '@/lib/pagination';
import { schoolToday } from '@/lib/school-date';
import { firstValue, type SearchParams } from '@/lib/search-params';
import { requireProfile } from '@/server/auth/guard';
import { listLoans, type LoanRow } from '@/server/queries/loans';

function fineLabel(row: LoanRow): string {
  if (row.unpaidFine > 0) return `${formatRupiah(row.unpaidFine)} belum lunas`;
  return row.totalFine > 0 ? 'Lunas' : '—';
}

export default async function HistoryPage({ searchParams }: { searchParams: SearchParams }) {
  await requireProfile();
  const params = await searchParams;
  const q = firstValue(params.q);
  const status = parseHistoryStatus(firstValue(params.status));
  const page = parsePage(firstValue(params.hal));
  const { rows, total } = await listLoans({ q, status, page }, schoolToday());

  return (
    <>
      <PageHeader
        title="Riwayat Transaksi"
        description="Seluruh peminjaman beserta pengembalian dan dendanya."
        actions={<Link href="/transaksi/peminjaman" className={buttonClass('primary')}>Peminjaman Baru</Link>}
      />
      <Flash message={firstValue(params.pesan)} />
      <FilterBar q={q} placeholder="Cari no. transaksi, NIS, atau nama siswa">
        <FilterSelect name="status" label="Filter status" value={status} options={HISTORY_STATUS_OPTIONS} />
      </FilterBar>

      <ScrollTable>
        <thead>
          <tr>
            <th className={TH}>No. Transaksi</th>
            <th className={TH}>Siswa</th>
            <th className={TH}>Pinjam</th>
            <th className={TH}>Jatuh Tempo</th>
            <th className={TH}>Buku</th>
            <th className={TH}>Denda</th>
            <th className={TH}>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className={`${TD} text-center text-[var(--color-ink-500)]`}>Belum ada transaksi yang cocok.</td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.id}>
              <td className={TD}>
                <Link href={`/transaksi/riwayat/${row.id}`} className="font-mono text-[var(--color-accent-600)] hover:underline">
                  {row.transactionNumber}
                </Link>
              </td>
              <td className={TD}>
                {row.studentName}
                <span className="block text-xs text-[var(--color-ink-500)]">{row.studentNis} · {row.studentClass}</span>
              </td>
              <td className={TD}>{formatDate(row.loanDate)}</td>
              <td className={TD}>{formatDate(row.dueDate)}</td>
              <td className={TD}>
                {row.itemCount} buku
                {row.openCount > 0 && row.status !== 'SELESAI' && (
                  <span className="block text-xs text-[var(--color-ink-500)]">{row.openCount} belum kembali</span>
                )}
              </td>
              <td className={TD}>{fineLabel(row)}</td>
              <td className={TD}><LoanStatusBadge status={row.status} daysOverdue={row.daysOverdue} /></td>
            </tr>
          ))}
        </tbody>
      </ScrollTable>

      <Pagination path="/transaksi/riwayat" page={page} total={total} query={{ q, status }} />
    </>
  );
}
