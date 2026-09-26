import Link from 'next/link';
import { ReportFilters, ReportHeader, ReportNotice, SummaryGrid } from '@/components/reports/report-parts';
import { ScrollTable } from '@/components/ui/scroll-table';
import { TD, TH } from '@/components/ui/table-styles';
import { RETURN_CONDITION_LABELS } from '@/lib/circulation-labels';
import { formatRupiah } from '@/lib/format';
import { formatPeriod, parseReportPeriod, TRUNCATED_MESSAGE } from '@/lib/report-period';
import { formatSchoolDateTime, schoolToday } from '@/lib/school-date';
import { firstValue, type SearchParams } from '@/lib/search-params';
import { requireProfile } from '@/server/auth/guard';
import { listReportClassOptions, returnReport } from '@/server/queries/reports';
import { getLibrarySettings } from '@/server/queries/settings';

function money(amount: number): string {
  return amount > 0 ? formatRupiah(amount) : '—';
}

export default async function ReturnReportPage({ searchParams }: { searchParams: SearchParams }) {
  await requireProfile();
  const params = await searchParams;
  const periodResult = parseReportPeriod({ dari: firstValue(params.dari), sampai: firstValue(params.sampai) }, schoolToday());
  const { period } = periodResult;
  const className = firstValue(params.kelas).trim();

  const [report, classOptions, settings] = await Promise.all([
    returnReport({ from: period.from, to: period.to, className }),
    listReportClassOptions(),
    getLibrarySettings(),
  ]);
  const { summary } = report;

  return (
    <>
      <ReportHeader
        schoolName={settings.schoolName?.trim() || 'Perpustakaan Sekolah'}
        title="Laporan Pengembalian"
        description="Eksemplar yang kembali menurut tanggal kembali (WIB), dengan kondisi, denda telat, dan biaya ganti."
        period={`Periode ${formatPeriod(period)}${className ? ` · Kelas ${className}` : ''}`}
      />
      <ReportFilters from={period.from} to={period.to} className={className} classOptions={classOptions} />
      <ReportNotice message={periodResult.ok ? null : periodResult.message} />
      <ReportNotice message={report.truncated ? TRUNCATED_MESSAGE : null} />
      <SummaryGrid
        items={[
          { label: 'Buku kembali', value: summary.copies.toLocaleString('id-ID') },
          { label: 'Rusak / hilang', value: `${summary.damaged} / ${summary.lost}` },
          { label: 'Denda telat', value: formatRupiah(summary.lateFines) },
          { label: 'Biaya ganti', value: formatRupiah(summary.replacementFees) },
        ]}
      />

      <ScrollTable>
        <thead>
          <tr>
            <th className={TH}>Waktu Kembali</th>
            <th className={TH}>No. Transaksi</th>
            <th className={TH}>Siswa</th>
            <th className={TH}>Kelas</th>
            <th className={TH}>Buku</th>
            <th className={TH}>Kondisi</th>
            <th className={TH}>Telat</th>
            <th className={TH}>Denda Telat</th>
            <th className={TH}>Biaya Ganti</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.length === 0 && (
            <tr>
              <td colSpan={9} className={`${TD} text-center text-[var(--color-ink-500)]`}>Tidak ada pengembalian pada periode ini.</td>
            </tr>
          )}
          {report.rows.map((row) => (
            <tr key={row.id}>
              <td className={`${TD} whitespace-nowrap`}>{formatSchoolDateTime(row.returnedAt)}</td>
              <td className={TD}>
                <Link href={`/transaksi/riwayat/${row.loanId}`} className="font-mono text-[var(--color-accent-600)] hover:underline">
                  {row.transactionNumber}
                </Link>
              </td>
              <td className={TD}>
                {row.studentName}
                <span className="block font-mono text-xs text-[var(--color-ink-500)]">{row.studentNis}</span>
              </td>
              <td className={TD}>{row.studentClass}</td>
              <td className={TD}>
                {row.bookTitle}
                <span className="block font-mono text-xs text-[var(--color-ink-500)]">{row.barcode}</span>
              </td>
              <td className={TD}>{row.condition ? RETURN_CONDITION_LABELS[row.condition] : '—'}</td>
              <td className={`${TD} tabular`}>{row.daysLate > 0 ? `${row.daysLate} hari` : '—'}</td>
              <td className={`${TD} tabular`}>{money(row.lateFine)}</td>
              <td className={`${TD} tabular`}>{money(row.replacementFee)}</td>
            </tr>
          ))}
        </tbody>
      </ScrollTable>
    </>
  );
}
