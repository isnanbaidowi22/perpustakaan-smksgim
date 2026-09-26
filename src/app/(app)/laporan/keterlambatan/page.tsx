import Link from 'next/link';
import { ReportFilters, ReportHeader, ReportNotice, SummaryGrid } from '@/components/reports/report-parts';
import { ScrollTable } from '@/components/ui/scroll-table';
import { TD, TH } from '@/components/ui/table-styles';
import { formatDate, formatRupiah } from '@/lib/format';
import { TRUNCATED_MESSAGE } from '@/lib/report-period';
import { schoolToday } from '@/lib/school-date';
import { firstValue, type SearchParams } from '@/lib/search-params';
import { requireProfile } from '@/server/auth/guard';
import { listReportClassOptions, overdueReport } from '@/server/queries/reports';
import { getLibrarySettings } from '@/server/queries/settings';

export default async function OverdueReportPage({ searchParams }: { searchParams: SearchParams }) {
  await requireProfile();
  const params = await searchParams;
  const today = schoolToday();
  const className = firstValue(params.kelas).trim();

  const [settings, classOptions] = await Promise.all([getLibrarySettings(), listReportClassOptions()]);
  const report = await overdueReport({ className }, today, settings.finePerDay);
  const { summary } = report;

  return (
    <>
      <ReportHeader
        schoolName={settings.schoolName?.trim() || 'Perpustakaan Sekolah'}
        title="Laporan Keterlambatan"
        description={`Buku yang belum kembali dan sudah lewat jatuh tempo per hari ini. Perkiraan denda memakai tarif ${formatRupiah(settings.finePerDay)} per hari; denda sesungguhnya dihitung saat pengembalian.`}
        period={`Per ${formatDate(today)}${className ? ` · Kelas ${className}` : ''}`}
      />
      <ReportFilters className={className} classOptions={classOptions} />
      <ReportNotice message={report.truncated ? TRUNCATED_MESSAGE : null} />
      <SummaryGrid
        items={[
          { label: 'Siswa terlambat', value: summary.students.toLocaleString('id-ID') },
          { label: 'Buku terlambat', value: summary.copies.toLocaleString('id-ID') },
          { label: 'Perkiraan denda', value: formatRupiah(summary.estimatedFines) },
        ]}
      />
      <p className="mb-4 text-sm text-[var(--color-ink-500)] print:hidden">
        Per {formatDate(today)}, tarif {formatRupiah(settings.finePerDay)} per hari.
      </p>

      <ScrollTable>
        <thead>
          <tr>
            <th className={TH}>Siswa</th>
            <th className={TH}>Kelas</th>
            <th className={TH}>No. Transaksi</th>
            <th className={TH}>Buku</th>
            <th className={TH}>Jatuh Tempo</th>
            <th className={TH}>Telat</th>
            <th className={TH}>Perkiraan Denda</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.length === 0 && (
            <tr>
              <td colSpan={7} className={`${TD} text-center text-[var(--color-ink-500)]`}>Tidak ada buku yang terlambat dikembalikan.</td>
            </tr>
          )}
          {report.rows.map((row) => (
            <tr key={row.id}>
              <td className={TD}>
                {row.studentName}
                <span className="block font-mono text-xs text-[var(--color-ink-500)]">{row.studentNis}</span>
              </td>
              <td className={TD}>{row.studentClass}</td>
              <td className={TD}>
                <Link href={`/transaksi/riwayat/${row.loanId}`} className="font-mono text-[var(--color-accent-600)] hover:underline">
                  {row.transactionNumber}
                </Link>
              </td>
              <td className={TD}>
                {row.bookTitle}
                <span className="block font-mono text-xs text-[var(--color-ink-500)]">{row.barcode}</span>
              </td>
              <td className={TD}>{formatDate(row.dueDate)}</td>
              <td className={`${TD} tabular text-[var(--color-status-terlambat)]`}>{row.daysLate} hari</td>
              <td className={`${TD} tabular`}>{formatRupiah(row.estimatedFine)}</td>
            </tr>
          ))}
        </tbody>
      </ScrollTable>
    </>
  );
}
