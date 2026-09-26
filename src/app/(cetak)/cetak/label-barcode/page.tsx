import { PrintToolbar } from '@/components/print/print-toolbar';
import { Barcode } from '@/components/ui/barcode';
import { buttonClass } from '@/components/ui/button-styles';
import { encodeCode128 } from '@/lib/code128';
import { chunkSheets, LABEL_SHEET, LABELS_PER_SHEET, MAX_LABELS, parseLabelRequest } from '@/lib/label-request';
import { firstValue, type SearchParams } from '@/lib/search-params';
import { requireProfile } from '@/server/auth/guard';
import { findLabelCopies, type LabelCopy } from '@/server/queries/labels';
import { getLibrarySettings } from '@/server/queries/settings';

const CONTROL = 'rounded-md border border-[var(--color-ink-300)] bg-white px-3 py-2 text-sm';
const ALERT = 'mt-3 rounded-md bg-[var(--color-status-terlambat)]/10 px-3 py-2 text-sm text-[var(--color-status-terlambat)]';
const WARN = 'mt-3 rounded-md bg-[var(--color-status-rusak)]/10 px-3 py-2 text-sm text-[var(--color-status-rusak)]';

function sheetsOf(count: number): number {
  return Math.ceil(count / LABELS_PER_SHEET);
}

export default async function LabelPage({ searchParams }: { searchParams: SearchParams }) {
  await requireProfile();
  const params = await searchParams;
  const dari = firstValue(params.dari);
  const sampai = firstValue(params.sampai);
  const request = parseLabelRequest({ buku: firstValue(params.buku), dari, sampai });

  const [settings, batch] = await Promise.all([
    getLibrarySettings(),
    request.kind === 'book' || request.kind === 'range' ? findLabelCopies(request) : Promise.resolve(null),
  ]);
  const schoolName = settings.schoolName?.trim() || 'Perpustakaan Sekolah';
  const copies: LabelCopy[] = batch?.copies ?? [];
  const unprintable = copies.filter((copy) => encodeCode128(copy.barcode) === null).map((copy) => copy.barcode);

  let problem: string | null = null;
  if (request.kind === 'invalid') problem = request.message;
  if (request.kind === 'book' && batch?.bookTitle === null) {
    problem = 'Buku tidak ditemukan. Buka ulang dari Master Data → Buku.';
  } else if (batch && batch.total === 0) {
    problem = request.kind === 'book'
      ? 'Judul ini belum punya eksemplar aktif untuk dilabeli. Tambahkan eksemplarnya di halaman buku.'
      : `Tidak ada eksemplar aktif dengan barcode ${dari.trim().toUpperCase()} sampai ${sampai.trim().toUpperCase()}.`;
  }
  const truncated = batch !== null && batch.total > MAX_LABELS
    ? `${request.kind === 'book' ? 'Judul ini punya' : 'Rentang ini berisi'} ${batch.total} eksemplar; sekali cetak maksimal ${MAX_LABELS} label (10 lembar). Yang tampil sampai ${copies.at(-1)?.barcode ?? ''}; cetak sisanya dengan rentang mulai setelah barcode itu.`
    : null;
  const subject = request.kind === 'book' && copies.length > 0 ? ` untuk "${copies[0].bookTitle}"` : '';
  const sheets = chunkSheets(copies);

  return (
    <>
      <style>{'@page { size: A4; margin: 0; }'}</style>
      <PrintToolbar
        backHref={request.kind === 'book' ? `/master/buku/${request.bookId}` : '/master/buku'}
        backLabel={request.kind === 'book' ? 'Kembali ke buku' : 'Kembali ke Master Data'}
        autoFocus={copies.length > 0}
      />

      <div className="max-w-3xl px-4 py-5 print:hidden">
        <h1 className="page-title text-2xl font-semibold">Cetak Label Barcode</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-500)]">
          Pilih rentang barcode, atau buka Master Data → Buku → pilih judul → Cetak Label untuk seluruh eksemplar satu judul.
          Lembar label A4 berisi {LABELS_PER_SHEET} label. Lembar label A4 3 × 7, 63,5 × 38,1 mm (tipe L7160 atau yang setara).
        </p>
        <form className="mt-4 flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="mb-1 block text-[var(--color-ink-700)]">Dari barcode</span>
            <input name="dari" defaultValue={dari} autoFocus={copies.length === 0} autoComplete="off" className={CONTROL} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-[var(--color-ink-700)]">Sampai barcode</span>
            <input name="sampai" defaultValue={sampai} autoComplete="off" className={CONTROL} />
          </label>
          <button type="submit" className={buttonClass('secondary')}>Tampilkan</button>
        </form>
        {problem && <p role="alert" className={ALERT}>{problem}</p>}
        {truncated && <p role="alert" className={WARN}>{truncated}</p>}
        {unprintable.length > 0 && (
          <p role="alert" className={WARN}>
            {unprintable.length} barcode tidak dapat dicetak sebagai Code128: {unprintable.join(', ')}. Labelnya hanya
            berisi teks; ubah barcode tersebut di halaman buku agar dapat dipindai.
          </p>
        )}
        {copies.length > 0 && (
          <p role="status" className="mt-3 text-sm">
            {copies.length} label{subject} · {sheetsOf(copies.length)} lembar A4
          </p>
        )}
      </div>

      {sheets.map((sheet, sheetIndex) => (
        <div
          key={sheetIndex}
          data-sheet
          className="mx-auto border border-[var(--color-ink-100)] print:border-0"
          style={{
            width: `${LABEL_SHEET.widthMm}mm`,
            height: `${LABEL_SHEET.heightMm}mm`,
            padding: `${LABEL_SHEET.marginTopMm}mm ${LABEL_SHEET.marginSideMm}mm`,
            breakAfter: sheetIndex < sheets.length - 1 ? 'page' : undefined,
          }}
        >
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${LABEL_SHEET.columns}, ${LABEL_SHEET.labelWidthMm}mm)`,
              gridAutoRows: `${LABEL_SHEET.labelHeightMm}mm`,
              columnGap: `${LABEL_SHEET.columnGapMm}mm`,
            }}
          >
            {sheet.map((copy) => (
              <div
                key={copy.id}
                className="flex flex-col items-center justify-center overflow-hidden border border-dashed border-[var(--color-ink-100)] px-[3mm] text-center print:border-transparent [break-inside:avoid]"
              >
                <p className="w-full truncate text-[7pt]">{schoolName}</p>
                <p className="w-full truncate text-[8pt] font-semibold">{copy.bookTitle}</p>
                <Barcode value={copy.barcode} className="my-[1mm] h-[13mm] w-full" />
                <p className="font-mono text-[9pt] font-semibold">{copy.barcode}</p>
                {copy.rackCode && <p className="text-[7pt]">Rak {copy.rackCode}</p>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
