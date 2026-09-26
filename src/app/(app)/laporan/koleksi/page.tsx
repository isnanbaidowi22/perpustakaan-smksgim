import Link from 'next/link';
import { ReportHeader, ReportNotice, SummaryGrid } from '@/components/reports/report-parts';
import { buttonClass } from '@/components/ui/button-styles';
import { ScrollTable } from '@/components/ui/scroll-table';
import { TD, TH } from '@/components/ui/table-styles';
import { formatDate } from '@/lib/format';
import { truncatedMessage } from '@/lib/report-period';
import { schoolToday } from '@/lib/school-date';
import { firstValue, type SearchParams } from '@/lib/search-params';
import { requireProfile } from '@/server/auth/guard';
import { listCategoryOptions } from '@/server/queries/categories';
import { collectionReport } from '@/server/queries/reports';
import { getLibrarySettings } from '@/server/queries/settings';

const CONTROL = 'rounded-md border border-[var(--color-ink-300)] bg-white px-3 py-2 text-sm';
const NUMBER = `${TD} tabular text-right`;

function count(value: number): string {
  return value.toLocaleString('id-ID');
}

export default async function CollectionReportPage({ searchParams }: { searchParams: SearchParams }) {
  await requireProfile();
  const params = await searchParams;
  const q = firstValue(params.q).trim();
  const categoryId = firstValue(params.kategori).trim();

  const [report, categoryOptions, settings] = await Promise.all([
    collectionReport({ q, categoryId }),
    listCategoryOptions(),
    getLibrarySettings(),
  ]);
  const { summary } = report;
  const categoryLabel = categoryOptions.find((option) => option.value === categoryId)?.label;
  const scope = [`Per ${formatDate(schoolToday())}`, categoryLabel && `Kategori ${categoryLabel}`, q && `Kata kunci "${q}"`]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <ReportHeader
        schoolName={settings.schoolName?.trim() || 'Perpustakaan Sekolah'}
        title="Laporan Koleksi Buku"
        description="Judul aktif dan jumlah eksemplarnya per status. Total tidak menghitung eksemplar nonaktif."
        period={scope}
      />
      <form className="mb-4 flex flex-wrap items-end gap-2 print:hidden">
        <label className="text-sm">
          <span className="mb-1 block text-[var(--color-ink-700)]">Judul atau penulis</span>
          <input type="search" name="q" defaultValue={q} className={`${CONTROL} min-w-64`} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-[var(--color-ink-700)]">Kategori</span>
          <select name="kategori" defaultValue={categoryId} className={CONTROL}>
            <option value="">Semua kategori</option>
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <button type="submit" className={buttonClass('secondary')}>Tampilkan</button>
      </form>
      <ReportNotice message={report.truncated ? truncatedMessage('Saring per kategori atau kata kunci agar lengkap.') : null} printable />
      <SummaryGrid
        items={[
          { label: 'Judul', value: count(summary.titles) },
          { label: 'Eksemplar', value: count(summary.total) },
          { label: 'Tersedia / dipinjam', value: `${count(summary.available)} / ${count(summary.borrowed)}` },
          { label: 'Rusak / hilang', value: `${count(summary.damaged)} / ${count(summary.lost)}` },
        ]}
      />

      <ScrollTable>
        <thead>
          <tr>
            <th className={TH}>Judul</th>
            <th className={TH}>Kategori</th>
            <th className={TH}>Rak</th>
            <th className={`${TH} text-right`}>Tersedia</th>
            <th className={`${TH} text-right`}>Dipinjam</th>
            <th className={`${TH} text-right`}>Rusak</th>
            <th className={`${TH} text-right`}>Hilang</th>
            <th className={`${TH} text-right`}>Nonaktif</th>
            <th className={`${TH} text-right`}>Total</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.length === 0 && (
            <tr>
              <td colSpan={9} className={`${TD} text-center text-[var(--color-ink-500)]`}>Tidak ada judul yang cocok.</td>
            </tr>
          )}
          {report.rows.map((row) => (
            <tr key={row.id}>
              <td className={TD}>
                <Link href={`/master/buku/${row.id}`} className="text-[var(--color-accent-600)] hover:underline">{row.title}</Link>
                <span className="block text-xs text-[var(--color-ink-500)]">{row.author}</span>
              </td>
              <td className={TD}>{row.categoryName ?? '—'}</td>
              <td className={TD}>{row.rackCode ?? '—'}</td>
              <td className={NUMBER}>{row.available}</td>
              <td className={NUMBER}>{row.borrowed}</td>
              <td className={NUMBER}>{row.damaged}</td>
              <td className={NUMBER}>{row.lost}</td>
              <td className={NUMBER}>{row.inactive}</td>
              <td className={`${NUMBER} font-semibold`}>{row.total}</td>
            </tr>
          ))}
        </tbody>
      </ScrollTable>
    </>
  );
}
