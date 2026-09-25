import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/ui/action-form';
import { buttonClass } from '@/components/ui/button-styles';
import { TextField } from '@/components/ui/fields';
import { Flash } from '@/components/ui/flash';
import { LoanStatusBadge } from '@/components/ui/loan-status-badge';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollTable } from '@/components/ui/scroll-table';
import { TD, TH } from '@/components/ui/table-styles';
import { RETURN_CONDITION_LABELS } from '@/lib/circulation-labels';
import { formatDate, formatRupiah } from '@/lib/format';
import { formatSchoolDateTime, schoolToday } from '@/lib/school-date';
import { firstValue, withQuery, type SearchParams } from '@/lib/search-params';
import { payFineAction } from '@/server/actions/fines';
import { requireProfile } from '@/server/auth/guard';
import { getLoanDetail } from '@/server/queries/loans';

const SECTION = 'page-title mb-3 mt-8 text-lg font-semibold';

function money(amount: number): string {
  return amount > 0 ? formatRupiah(amount) : '—';
}

export default async function LoanDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  await requireProfile();
  const { id } = await params;
  const query = await searchParams;
  const loan = await getLoanDetail(id, schoolToday());
  if (!loan) notFound();

  const isOpen = loan.status !== 'SELESAI';

  return (
    <>
      <PageHeader
        title={loan.transactionNumber}
        description={`${loan.studentName} · NIS ${loan.studentNis} · ${loan.studentClass}`}
        actions={(
          <>
            <Link href={`/cetak/struk/${loan.id}`} className={buttonClass('secondary')}>Cetak Struk</Link>
            {isOpen && (
              <Link
                href={withQuery('/transaksi/pengembalian', { q: loan.transactionNumber, pinjam: loan.id })}
                className={buttonClass('primary')}
              >
                Proses Pengembalian
              </Link>
            )}
          </>
        )}
      />
      <Flash message={firstValue(query.pesan)} />

      <dl className="grid gap-4 rounded-lg border border-[var(--color-ink-100)] bg-white p-4 text-sm sm:grid-cols-3">
        <div><dt className="text-[var(--color-ink-500)]">Tanggal pinjam</dt><dd>{formatDate(loan.loanDate)}</dd></div>
        <div><dt className="text-[var(--color-ink-500)]">Jatuh tempo</dt><dd>{formatDate(loan.dueDate)}</dd></div>
        <div>
          <dt className="text-[var(--color-ink-500)]">Status</dt>
          <dd><LoanStatusBadge status={loan.status} daysOverdue={loan.daysOverdue} /></dd>
        </div>
        <div><dt className="text-[var(--color-ink-500)]">Tahun ajaran</dt><dd>{loan.academicYearName}</dd></div>
        <div><dt className="text-[var(--color-ink-500)]">Dicatat oleh</dt><dd>{loan.createdByName}</dd></div>
        {loan.notes && <div><dt className="text-[var(--color-ink-500)]">Catatan</dt><dd>{loan.notes}</dd></div>}
      </dl>

      <h2 className={SECTION}>Buku</h2>
      <ScrollTable>
        <thead>
          <tr>
            <th className={TH}>Barcode</th>
            <th className={TH}>Judul</th>
            <th className={TH}>Dikembalikan</th>
            <th className={TH}>Kondisi</th>
            <th className={TH}>Telat</th>
            <th className={TH}>Denda Telat</th>
            <th className={TH}>Biaya Ganti</th>
          </tr>
        </thead>
        <tbody>
          {loan.items.map((item) => (
            <tr key={item.id}>
              <td className={`${TD} font-mono`}>{item.barcode}</td>
              <td className={TD}>{item.bookTitle}</td>
              <td className={TD}>{item.returnedAt ? formatSchoolDateTime(item.returnedAt) : 'Belum kembali'}</td>
              <td className={TD}>
                {item.returnCondition ? RETURN_CONDITION_LABELS[item.returnCondition] : '—'}
                {item.conditionNote && <span className="block text-xs text-[var(--color-ink-500)]">{item.conditionNote}</span>}
              </td>
              <td className={TD}>{item.daysLate > 0 ? `${item.daysLate} hari` : '—'}</td>
              <td className={TD}>{money(item.lateFine)}</td>
              <td className={TD}>{money(item.replacementFee)}</td>
            </tr>
          ))}
        </tbody>
      </ScrollTable>

      <h2 className={SECTION}>Denda</h2>
      <dl className="grid gap-4 rounded-lg border border-[var(--color-ink-100)] bg-white p-4 text-sm sm:grid-cols-3">
        <div><dt className="text-[var(--color-ink-500)]">Total denda</dt><dd className="tabular">{formatRupiah(loan.totalFine)}</dd></div>
        <div><dt className="text-[var(--color-ink-500)]">Sudah dibayar</dt><dd className="tabular">{formatRupiah(loan.paidTotal)}</dd></div>
        <div>
          <dt className="text-[var(--color-ink-500)]">Sisa</dt>
          <dd className="tabular font-semibold">
            {loan.unpaidFine > 0 ? formatRupiah(loan.unpaidFine) : loan.totalFine > 0 ? 'Lunas' : 'Tidak ada denda'}
          </dd>
        </div>
      </dl>

      {loan.payments.length > 0 && (
        <div className="mt-4">
          <ScrollTable>
            <thead>
              <tr>
                <th className={TH}>Waktu</th>
                <th className={TH}>Nominal</th>
                <th className={TH}>Diterima oleh</th>
                <th className={TH}>Catatan</th>
              </tr>
            </thead>
            <tbody>
              {loan.payments.map((payment) => (
                <tr key={payment.id}>
                  <td className={TD}>{formatSchoolDateTime(payment.paidAt)}</td>
                  <td className={TD}>{formatRupiah(payment.amount)}</td>
                  <td className={TD}>{payment.receivedByName}</td>
                  <td className={TD}>{payment.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </ScrollTable>
        </div>
      )}

      {loan.unpaidFine > 0 && (
        <>
          <h2 className={SECTION}>Pelunasan Denda</h2>
          <ActionForm action={payFineAction.bind(null, loan.id)} submitLabel="Tandai Lunas">
            <TextField
              name="amount"
              label="Nominal dibayar (Rp)"
              inputMode="numeric"
              required
              defaultValue={String(loan.unpaidFine)}
              hint={`Sisa tagihan ${formatRupiah(loan.unpaidFine)}. Ubah bila siswa membayar sebagian.`}
            />
            <TextField name="note" label="Catatan" maxLength={200} />
          </ActionForm>
        </>
      )}
    </>
  );
}
