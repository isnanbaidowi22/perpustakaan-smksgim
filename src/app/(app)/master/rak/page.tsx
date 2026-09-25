import Link from 'next/link';
import { ActionButton } from '@/components/ui/action-button';
import { buttonClass } from '@/components/ui/button-styles';
import { FilterBar, FilterSelect, STATUS_OPTIONS } from '@/components/ui/filter-bar';
import { Flash } from '@/components/ui/flash';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { RecordStatusBadge } from '@/components/ui/record-status-badge';
import { ScrollTable } from '@/components/ui/scroll-table';
import { TD, TH } from '@/components/ui/table-styles';
import { parsePage } from '@/lib/pagination';
import { firstValue, parseStatusFilter, type SearchParams } from '@/lib/search-params';
import { setRackStatusAction } from '@/server/actions/racks';
import { requireProfile } from '@/server/auth/guard';
import { listRacks } from '@/server/queries/racks';

export default async function RacksPage({ searchParams }: { searchParams: SearchParams }) {
  await requireProfile();
  const params = await searchParams;
  const q = firstValue(params.q);
  const status = parseStatusFilter(firstValue(params.status));
  const page = parsePage(firstValue(params.hal));
  const { rows, total } = await listRacks({ q, status, page });

  return (
    <>
      <PageHeader
        title="Rak"
        description="Lokasi fisik buku di perpustakaan."
        actions={<Link href="/master/rak/baru" className={buttonClass('primary')}>Tambah Rak</Link>}
      />
      <Flash message={firstValue(params.pesan)} />
      <FilterBar q={q} placeholder="Cari kode atau nama rak">
        <FilterSelect name="status" label="Filter status" value={status} options={STATUS_OPTIONS} />
      </FilterBar>

      <ScrollTable>
        <thead>
          <tr>
            <th className={TH}>Kode</th>
            <th className={TH}>Nama</th>
            <th className={TH}>Lokasi</th>
            <th className={TH}>Jumlah Judul</th>
            <th className={TH}>Status</th>
            <th className={TH}><span className="sr-only">Aksi</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className={`${TD} text-center text-[var(--color-ink-500)]`}>Belum ada rak yang cocok.</td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.id}>
              <td className={`${TD} font-mono`}>{row.code}</td>
              <td className={TD}>{row.name}</td>
              <td className={TD}>{row.location ?? '—'}</td>
              <td className={TD}>{row.bookCount}</td>
              <td className={TD}><RecordStatusBadge status={row.status} /></td>
              <td className={TD}>
                <div className="flex items-start justify-end gap-2">
                  <Link href={`/master/rak/${row.id}`} className={buttonClass('secondary', 'sm')}>Ubah</Link>
                  <ActionButton
                    action={setRackStatusAction.bind(null, row.id, row.status === 'active' ? 'inactive' : 'active')}
                    label={row.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </ScrollTable>

      <Pagination path="/master/rak" page={page} total={total} query={{ q, status }} />
    </>
  );
}
