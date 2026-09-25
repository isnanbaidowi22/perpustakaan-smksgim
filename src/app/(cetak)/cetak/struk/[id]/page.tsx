import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PrintToolbar } from '@/components/print/print-toolbar';
import { Barcode } from '@/components/ui/barcode';
import { buttonClass } from '@/components/ui/button-styles';
import { formatDate } from '@/lib/format';
import { parseReceiptWidth, receiptPageCss, receiptPageHeightMm, type ReceiptWidth } from '@/lib/receipt';
import { formatSchoolDateTime, schoolToday } from '@/lib/school-date';
import { firstValue, withQuery, type SearchParams } from '@/lib/search-params';
import { requireProfile } from '@/server/auth/guard';
import { getLoanDetail } from '@/server/queries/loans';
import { getLibrarySettings } from '@/server/queries/settings';

const WIDTHS: ReceiptWidth[] = [58, 80];
const WIDTH_CLASS: Record<ReceiptWidth, string> = { 58: 'w-[58mm]', 80: 'w-[80mm]' };
const RULE = 'my-2 border-t border-dashed border-black';

export default async function ReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  await requireProfile();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const width = parseReceiptWidth(firstValue(query.lebar));
  const [loan, settings] = await Promise.all([getLoanDetail(id, schoolToday()), getLibrarySettings()]);
  if (!loan) notFound();

  const schoolName = settings.schoolName?.trim() || 'Perpustakaan Sekolah';
  const footer = settings.receiptFooter?.trim() || null;
  const height = receiptPageHeightMm(loan.items.length, footer !== null, loan.notes !== null);

  return (
    <>
      <style>{receiptPageCss(width, height)}</style>
      <PrintToolbar backHref={`/transaksi/riwayat/${loan.id}`} backLabel="Kembali ke transaksi">
        <span className="ml-2 text-sm text-[var(--color-ink-500)]">Lebar kertas:</span>
        {WIDTHS.map((option) => (
          <Link
            key={option}
            href={withQuery(`/cetak/struk/${loan.id}`, { lebar: option === 58 ? undefined : option })}
            aria-current={option === width ? 'true' : undefined}
            className={buttonClass(option === width ? 'primary' : 'secondary', 'sm')}
          >
            {option} mm
          </Link>
        ))}
      </PrintToolbar>

      <article
        aria-label={`Struk ${loan.transactionNumber}`}
        className={`${WIDTH_CLASS[width]} mx-auto my-6 px-[3mm] py-[4mm] text-[11px] leading-snug print:my-0`}
      >
        <header className="text-center">
          <p className="text-[13px] font-bold">{schoolName}</p>
          <p className="font-semibold">STRUK PEMINJAMAN BUKU</p>
        </header>
        <hr className={RULE} />
        <dl className="grid grid-cols-[auto_1fr] gap-x-2">
          <dt>No.</dt><dd className="font-mono">{loan.transactionNumber}</dd>
          <dt>Siswa</dt><dd>{loan.studentName}</dd>
          <dt>NIS</dt><dd className="font-mono">{loan.studentNis}</dd>
          <dt>Kelas</dt><dd>{loan.studentClass}</dd>
          <dt>Pinjam</dt><dd>{formatDate(loan.loanDate)}</dd>
          <dt>Kembali</dt><dd className="font-bold">{formatDate(loan.dueDate)}</dd>
        </dl>
        <hr className={RULE} />
        <ol className="space-y-1">
          {loan.items.map((item, index) => (
            <li key={item.id}>
              {index + 1}. {item.bookTitle}
              <span className="block pl-3 font-mono">{item.barcode}</span>
            </li>
          ))}
        </ol>
        <p className="mt-1">Jumlah: {loan.items.length} buku</p>
        {loan.notes && <p className="mt-1">Catatan: {loan.notes}</p>}
        <hr className={RULE} />
        <p>Petugas: {loan.createdByName}</p>
        <p>Dicetak: {formatSchoolDateTime(new Date())}</p>
        <Barcode value={loan.transactionNumber} className="mt-2 h-[12mm] w-full" />
        {footer && <p className="mt-2 text-center">{footer}</p>}
      </article>
    </>
  );
}
