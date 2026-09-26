import Link from 'next/link';
import { ReportFilters, ReportHeader, ReportNotice, SummaryGrid } from '@/components/reports/report-parts';
import { LoanStatusBadge } from '@/components/ui/loan-status-badge';
import { ScrollTable } from '@/components/ui/scroll-table';
import { TD, TH } from '@/components/ui/table-styles';
import { formatDate } from '@/lib/format';
import { formatPeriod, parseReportPeriod, truncatedMessage } from '@/lib/report-period';
import { schoolToday } from '@/lib/school-date';
import { firstValue, type SearchParams } from '@/lib/search-params';
import { requireProfile } from '@/server/auth/guard';
import { listReportClassOptions, loanReport } from '@/server/queries/reports';
import { getLibrarySettings } from '@/server/queries/settings';

function count(value: number): string {
  return value.toLocaleString('id-ID');
}

export default async function LoanReportPage({ searchParams }: { searchParams: SearchParams }) {
  await requireProfile();
  const params = await searchParams;
  const today = schoolToday();
  const periodResult = parseReportPeriod({ dari: firstValue(params.dari), sampai: firstValue(params.sampai) }, today);
  const { period } = periodResult;
  const className = firstValue(params.kelas).trim();

  const [report, classOptions, settings] = await Promise.all([
    loanReport({ from: period.from, to: period.to, className }, today),
    listReportClassOptions(),
    getLibrarySettings(),
  ]);

  return (
    <>
      <ReportHeader
        schoolName={settings.schoolName?.trim() || 'Perpustakaan Sekolah'}
        title="Laporan Peminjaman"
        description="Transaksi peminjaman menurut tanggal pinjam, dengan kelas saat meminjam."
        period={`Periode ${formatPeriod(period)}${className ? ` · Kelas ${className}` : ''}`}
      />
      <ReportFilters from={period.from} to={period.to} className={className} classOptions={classOptions} />
      <ReportNotice message={periodResult.ok ? null : periodResult.message} />
      <ReportNotice
        message={report.truncated ? truncatedMessage('Persempit periode atau pilih satu kelas agar lengkap.') : null}
        printable
      />
      <SummaryGrid
        items={[
          { label: 'Transaksi', value: count(report.summary.loans) },
          { label: 'Buku dipinjam', value: count(report.summary.copies) },
          { label: 'Siswa', value: count(report.summary.students) },
        ]}
      />

      <ScrollTable>
        <thead>
          <tr>
            <th className={TH}>Tanggal Pinjam</th>
            <th className={TH}>No. Transaksi</th>
            <th className={TH}>Siswa</th>
            <th className={TH}>Kelas</th>
            <th className={TH}>Buku</th>
            <th className={TH}>Jatuh Tempo</th>
            <th className={TH}>Status</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.length === 0 && (
            <tr>
              <td colSpan={7} className={`${TD} text-center text-[var(--color-ink-500)]`}>Tidak ada peminjaman pada periode ini.</td>
            </tr>
          )}
          {report.rows.map((row) => (
            <tr key={row.id}>
              <td className={TD}>{formatDate(row.loanDate)}</td>
              <td className={TD}>
                <Link href={`/transaksi/riwayat/${row.id}`} className="font-mono text-[var(--color-accent-600)] hover:underline">
                  {row.transactionNumber}
                </Link>
              </td>
              <td className={TD}>
                {row.studentName}
                <span className="block font-mono text-xs text-[var(--color-ink-500)]">{row.studentNis}</span>
              </td>
              <td className={TD}>{row.studentClass}</td>
              <td className={`${TD} tabular`}>
                {row.itemCount}
                {row.openCount > 0 && row.status !== 'SELESAI' && (
                  <span className="block text-xs text-[var(--color-ink-500)]">{row.openCount} belum kembali</span>
                )}
              </td>
              <td className={TD}>{formatDate(row.dueDate)}</td>
              <td className={TD}><LoanStatusBadge status={row.status} daysOverdue={row.daysOverdue} /></td>
            </tr>
          ))}
        </tbody>
      </ScrollTable>
    </>
  );
}
