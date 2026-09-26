import type { ReactNode } from 'react';
import { buttonClass } from '@/components/ui/button-styles';
import type { Option } from '@/lib/options';
import { formatSchoolDateTime } from '@/lib/school-date';
import { PrintButton } from './print-button';

const CONTROL = 'rounded-md border border-[var(--color-ink-300)] bg-white px-3 py-2 text-sm';
const LABEL = 'mb-1 block text-[var(--color-ink-700)]';

/**
 * Judul laporan di layar, dan kop di kertas: nama sekolah, judul, periode,
 * waktu cetak. Laporan dicetak A4 mendatar agar tabel lebar tetap terbaca.
 */
export function ReportHeader({
  schoolName, title, description, period,
}: { schoolName: string; title: string; description: string; period: string | null }) {
  return (
    <>
      <style>{'@page { size: A4 landscape; margin: 12mm; }'}</style>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <h1 className="page-title text-2xl font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-500)]">{description}</p>
        </div>
        <PrintButton />
      </div>
      <div className="mb-4 hidden text-center print:block"><p className="text-base font-bold">{schoolName}</p>
        <p className="text-lg font-semibold">{title}</p>
        {period && <p className="text-sm">{period}</p>}
        <p className="text-xs text-[var(--color-ink-500)]">{description}</p>
        <p className="text-xs">Dicetak {formatSchoolDateTime(new Date())}</p>
      </div>
    </>
  );
}

/** Form GET: filter laporan dapat dibagikan dan di-bookmark lewat URL. */
export function ReportFilters({
  from, to, className, classOptions, children,
}: { from?: string; to?: string; className?: string; classOptions?: Option[]; children?: ReactNode }) {
  return (
    <form className="mb-4 flex flex-wrap items-end gap-2 print:hidden">
      {from !== undefined && (
        <label className="text-sm">
          <span className={LABEL}>Dari tanggal</span>
          <input type="date" name="dari" defaultValue={from} className={CONTROL} />
        </label>
      )}
      {to !== undefined && (
        <label className="text-sm">
          <span className={LABEL}>Sampai tanggal</span>
          <input type="date" name="sampai" defaultValue={to} className={CONTROL} />
        </label>
      )}
      {classOptions && (
        <label className="text-sm">
          <span className={LABEL}>Kelas</span>
          <select name="kelas" defaultValue={className ?? ''} className={CONTROL}>
            <option value="">Semua kelas</option>
            {classOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      )}
      {children}
      <button type="submit" className={buttonClass('secondary')}>Tampilkan</button>
    </form>
  );
}

export function SummaryGrid({ items }: { items: { label: string; value: string }[] }) {
  return (
    <dl className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4 print:gap-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-[var(--color-ink-100)] bg-white p-3 print:p-2">
          <dt className="text-xs text-[var(--color-ink-500)]">{item.label}</dt>
          <dd className="tabular text-xl font-semibold">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ReportNotice({ message, printable }: { message: string | null; printable?: boolean }) {
  if (!message) return null;
  const base = 'mb-4 rounded-md bg-[var(--color-status-rusak)]/10 px-3 py-2 text-sm text-[var(--color-status-rusak)]';
  return (
    <p role="alert" className={printable ? base : `${base} print:hidden`}>
      {message}
    </p>
  );
}
