import Link from 'next/link';
import { FilterBar, FilterSelect } from '@/components/ui/filter-bar';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { ScrollTable } from '@/components/ui/scroll-table';
import { TD, TH } from '@/components/ui/table-styles';
import {
  AUDIT_KIND_OPTIONS, auditActionLabel, auditEntityHref, parseAuditKind, parseDateFilter, redactSecrets, summarizeAudit,
} from '@/lib/audit-labels';
import { parsePage } from '@/lib/pagination';
import { formatSchoolDateTime } from '@/lib/school-date';
import { firstValue, type SearchParams } from '@/lib/search-params';
import { requireProfile } from '@/server/auth/guard';
import { listAuditLogs, type AuditRow } from '@/server/queries/audit-logs';

const CONTROL = 'rounded-md border border-[var(--color-ink-300)] bg-white px-3 py-2 text-sm';

function Subject({ row }: { row: AuditRow }) {
  const { subject } = summarizeAudit(row.action, row.metadata);
  const href = auditEntityHref(row.entity, row.entityId);
  const label = subject ?? (href ? 'Buka data' : '—');
  return href ? (
    <Link href={href} className="text-[var(--color-accent-600)] hover:underline">{label}</Link>
  ) : (
    <span>{label}</span>
  );
}

export default async function AuditLogPage({ searchParams }: { searchParams: SearchParams }) {
  await requireProfile();

  const params = await searchParams;
  const q = firstValue(params.q);
  const kind = parseAuditKind(firstValue(params.jenis));
  const dateText = firstValue(params.tanggal);
  const date = parseDateFilter(dateText);
  const page = parsePage(firstValue(params.hal));
  const { rows, total } = await listAuditLogs({ q, kind, date, page });

  return (
    <>
      <PageHeader
        title="Audit Log"
        description="Jejak setiap perubahan data: siapa, kapan, dan apa. Catatan ini tidak dapat diubah atau dihapus."
      />
      <FilterBar q={q} placeholder="Cari no. transaksi, barcode, NIS, judul, atau username">
        <FilterSelect name="jenis" label="Jenis data" value={kind} options={AUDIT_KIND_OPTIONS} />
        <input type="date" name="tanggal" defaultValue={date ?? ''} aria-label="Tanggal" className={CONTROL} />
      </FilterBar>
      {dateText && !date && (
        <p role="alert" className="mb-4 text-sm text-[var(--color-status-terlambat)]">
          Tanggal {dateText} tidak valid; filter tanggal diabaikan.
        </p>
      )}

      <ScrollTable>
        <thead>
          <tr>
            <th className={TH}>Waktu</th>
            <th className={TH}>Pengguna</th>
            <th className={TH}>Aksi</th>
            <th className={TH}>Data</th>
            <th className={TH}>Keterangan</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className={`${TD} text-center text-[var(--color-ink-500)]`}>Belum ada catatan yang cocok.</td>
            </tr>
          )}
          {rows.map((row) => {
            const { details } = summarizeAudit(row.action, row.metadata);
            return (
              <tr key={row.id} className="align-top">
                <td className={`${TD} whitespace-nowrap`}>{formatSchoolDateTime(row.createdAt)}</td>
                <td className={TD}>
                  {row.fullName ?? 'Sistem'}
                  {row.username && <span className="block font-mono text-xs text-[var(--color-ink-500)]">{row.username}</span>}
                </td>
                <td className={TD}>
                  {auditActionLabel(row.action)}
                  <span className="block font-mono text-xs text-[var(--color-ink-500)]">{row.action}</span>
                </td>
                <td className={TD}><Subject row={row} /></td>
                <td className={TD}>
                  {details.length > 0 && (
                    <ul className="space-y-0.5">
                      {details.map((detail) => <li key={detail}>{detail}</li>)}
                    </ul>
                  )}
                  {row.metadata !== null && (
                    <details className="mt-1 text-xs">
                      <summary className="cursor-pointer text-[var(--color-ink-500)]">Lihat isi lengkap</summary>
                      <pre className="mt-1 max-w-md overflow-x-auto whitespace-pre-wrap rounded bg-[var(--color-ink-50)] p-2">
                        {JSON.stringify(redactSecrets(row.metadata), null, 2)}
                      </pre>
                    </details>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </ScrollTable>

      <Pagination path="/pengaturan/audit-log" page={page} total={total} query={{ q, jenis: kind, tanggal: date ?? '' }} />
    </>
  );
}
