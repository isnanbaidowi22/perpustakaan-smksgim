import Link from 'next/link';
import { buttonClass } from '@/components/ui/button-styles';
import { FilterBar } from '@/components/ui/filter-bar';
import { LoanStatusBadge } from '@/components/ui/loan-status-badge';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollTable } from '@/components/ui/scroll-table';
import { TD, TH } from '@/components/ui/table-styles';
import { formatDate } from '@/lib/format';
import { schoolToday } from '@/lib/school-date';
import { firstValue, withQuery, type SearchParams } from '@/lib/search-params';
import { requireProfile } from '@/server/auth/guard';
import { findLoansForReturn, getLoanDetail } from '@/server/queries/loans';
import { getLibrarySettings } from '@/server/queries/settings';
import { ReturnForm } from './return-form';

export default async function ReturnPage({ searchParams }: { searchParams: SearchParams }) {
  await requireProfile();
  const params = await searchParams;
  const q = firstValue(params.q);
  const chosen = firstValue(params.pinjam);
  const today = schoolToday();

  const candidates = q ? await findLoansForReturn(q, today) : [];
  const selectedId = chosen || (candidates.length === 1 ? candidates[0].id : '');
  const [loan, settings] = await Promise.all([
    selectedId ? getLoanDetail(selectedId, today) : Promise.resolve(null),
    getLibrarySettings(),
  ]);

  return (
    <>
      <PageHeader
        title="Pengembalian"
        description="Cari dengan nomor transaksi, NIS, nama siswa, atau pindai barcode salah satu bukunya."
      />
      <FilterBar q={q} placeholder="No. transaksi, NIS, nama siswa, atau barcode buku" autoFocus={!loan} />

      {q && candidates.length === 0 && !loan && (
        <p className="mb-4 text-sm text-[var(--color-ink-500)]">
          Tidak ada peminjaman yang masih berjalan untuk &quot;{q}&quot;. Periksa ejaan, atau cari di{' '}
          <Link href="/transaksi/riwayat" className="text-[var(--color-accent-600)] hover:underline">Riwayat Transaksi</Link>{' '}
          bila bukunya sudah dikembalikan.
        </p>
      )}

      {candidates.length > 1 && (
        <div className="mb-6">
          <ScrollTable>
            <thead>
              <tr>
                <th className={TH}>No. Transaksi</th>
                <th className={TH}>Siswa</th>
                <th className={TH}>Jatuh Tempo</th>
                <th className={TH}>Belum Kembali</th>
                <th className={TH}><span className="sr-only">Aksi</span></th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((candidate) => (
                <tr key={candidate.id} aria-current={candidate.id === selectedId ? 'true' : undefined}>
                  <td className={`${TD} font-mono`}>{candidate.transactionNumber}</td>
                  <td className={TD}>
                    {candidate.studentName}
                    <span className="block text-xs text-[var(--color-ink-500)]">{candidate.studentNis} · {candidate.studentClass}</span>
                  </td>
                  <td className={TD}>
                    {formatDate(candidate.dueDate)}
                    {candidate.daysOverdue > 0 && (
                      <span className="block text-xs text-[var(--color-status-terlambat)]">Terlambat {candidate.daysOverdue} hari</span>
                    )}
                  </td>
                  <td className={TD}>{candidate.openCount} buku</td>
                  <td className={TD}>
                    <Link href={withQuery('/transaksi/pengembalian', { q, pinjam: candidate.id })} className={buttonClass('secondary', 'sm')}>
                      Pilih
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </ScrollTable>
        </div>
      )}

      {loan && loan.status === 'SELESAI' && (
        <p className="text-sm">
          Transaksi {loan.transactionNumber} sudah selesai; seluruh bukunya sudah kembali.{' '}
          <Link href={`/transaksi/riwayat/${loan.id}`} className="text-[var(--color-accent-600)] hover:underline">Lihat rinciannya</Link>.
        </p>
      )}

      {loan && loan.status !== 'SELESAI' && (
        <section aria-labelledby="pinjaman-heading">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 id="pinjaman-heading" className="page-title text-lg font-semibold">
              <span className="font-mono">{loan.transactionNumber}</span> · {loan.studentName}
            </h2>
            <span className="text-sm text-[var(--color-ink-500)]">
              NIS {loan.studentNis} · jatuh tempo {formatDate(loan.dueDate)}
            </span>
            <LoanStatusBadge status={loan.status} daysOverdue={loan.daysOverdue} />
          </div>
          <ReturnForm
            key={loan.id}
            loan={{
              id: loan.id,
              dueDate: loan.dueDate,
              items: loan.items
                .filter((item) => item.returnedAt === null)
                .map(({ id, barcode, bookTitle, bookPrice }) => ({ id, barcode, bookTitle, bookPrice })),
            }}
            today={today}
            finePerDay={settings.finePerDay}
            searchQuery={q}
          />
        </section>
      )}
    </>
  );
}
