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
import { formatRupiah } from '@/lib/format';
import { parsePage } from '@/lib/pagination';
import { firstValue, parseStatusFilter, type SearchParams } from '@/lib/search-params';
import { setBookStatusAction } from '@/server/actions/books';
import { requireProfile } from '@/server/auth/guard';
import { listBooks } from '@/server/queries/books';
import { listCategoryOptions } from '@/server/queries/categories';

export default async function BooksPage({ searchParams }: { searchParams: SearchParams }) {
  await requireProfile();
  const params = await searchParams;
  const q = firstValue(params.q);
  const categoryId = firstValue(params.kategori);
  const status = parseStatusFilter(firstValue(params.status));
  const page = parsePage(firstValue(params.hal));

  const [categoryOptions, { rows, total }] = await Promise.all([
    listCategoryOptions(),
    listBooks({ q, categoryId, status, page }),
  ]);

  return (
    <>
      <PageHeader
        title="Buku"
        description="Judul koleksi. Setiap judul memiliki satu atau lebih eksemplar fisik berbarcode."
        actions={<Link href="/master/buku/baru" className={buttonClass('primary')}>Tambah Buku</Link>}
      />
      <Flash message={firstValue(params.pesan)} />
      <FilterBar q={q} placeholder="Cari judul, penulis, atau ISBN">
        <FilterSelect
          name="kategori"
          label="Filter kategori"
          value={categoryId}
          options={[{ value: '', label: 'Semua kategori' }, ...categoryOptions]}
        />
        <FilterSelect name="status" label="Filter status" value={status} options={STATUS_OPTIONS} />
      </FilterBar>

      <ScrollTable>
        <thead>
          <tr>
            <th className={TH}>Judul</th>
            <th className={TH}>Kategori</th>
            <th className={TH}>Rak</th>
            <th className={TH}>Eksemplar</th>
            <th className={TH}>Harga</th>
            <th className={TH}>Status</th>
            <th className={TH}><span className="sr-only">Aksi</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className={`${TD} text-center text-[var(--color-ink-500)]`}>Belum ada buku yang cocok.</td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.id}>
              <td className={TD}>
                <Link href={`/master/buku/${row.id}`} className="font-medium hover:underline">{row.title}</Link>
                <div className="text-xs text-[var(--color-ink-500)]">{row.author}</div>
              </td>
              <td className={TD}>{row.categoryName ?? '—'}</td>
              <td className={`${TD} font-mono`}>{row.rackCode ?? '—'}</td>
              <td className={TD}>
                {row.totalCopies === 0 ? (
                  <span className="text-[var(--color-status-rusak)]">Belum ada eksemplar</span>
                ) : (
                  `${row.availableCopies}/${row.totalCopies} tersedia`
                )}
              </td>
              <td className={TD}>{formatRupiah(row.price)}</td>
              <td className={TD}><RecordStatusBadge status={row.status} /></td>
              <td className={TD}>
                <div className="flex items-start justify-end gap-2">
                  <Link href={`/master/buku/${row.id}`} className={buttonClass('secondary', 'sm')}>Kelola</Link>
                  <ActionButton
                    action={setBookStatusAction.bind(null, row.id, row.status === 'active' ? 'inactive' : 'active')}
                    label={row.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </ScrollTable>

      <Pagination path="/master/buku" page={page} total={total} query={{ q, kategori: categoryId, status }} />
    </>
  );
}
