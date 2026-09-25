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
import { setStudentStatusAction } from '@/server/actions/students';
import { listClassNames, listStudents } from '@/server/queries/students';

export default async function StudentsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = firstValue(params.q);
  const className = firstValue(params.kelas);
  const status = parseStatusFilter(firstValue(params.status));
  const page = parsePage(firstValue(params.hal));

  const [classNames, { rows, total }] = await Promise.all([
    listClassNames(),
    listStudents({ q, className, status, page }),
  ]);
  const classOptions = [
    { value: '', label: 'Semua kelas' },
    ...classNames.map((name) => ({ value: name, label: name })),
  ];

  return (
    <>
      <PageHeader
        title="Siswa"
        description="Data peminjam. Siswa nonaktif tidak dapat meminjam buku baru."
        actions={<Link href="/master/siswa/baru" className={buttonClass('primary')}>Tambah Siswa</Link>}
      />
      <Flash message={firstValue(params.pesan)} />
      <FilterBar q={q} placeholder="Cari NIS atau nama siswa">
        <FilterSelect name="kelas" label="Filter kelas" value={className} options={classOptions} />
        <FilterSelect name="status" label="Filter status" value={status} options={STATUS_OPTIONS} />
      </FilterBar>

      <ScrollTable>
        <thead>
          <tr>
            <th className={TH}>NIS</th>
            <th className={TH}>Nama</th>
            <th className={TH}>Kelas</th>
            <th className={TH}>Jurusan</th>
            <th className={TH}>Tahun Ajaran</th>
            <th className={TH}>Status</th>
            <th className={TH}><span className="sr-only">Aksi</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className={`${TD} text-center text-[var(--color-ink-500)]`}>Belum ada siswa yang cocok.</td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.id}>
              <td className={`${TD} font-mono`}>{row.nis}</td>
              <td className={TD}>{row.name}</td>
              <td className={TD}>{row.className}</td>
              <td className={TD}>{row.major ?? '—'}</td>
              <td className={TD}>{row.academicYearName ?? '—'}</td>
              <td className={TD}><RecordStatusBadge status={row.status} /></td>
              <td className={TD}>
                <div className="flex items-start justify-end gap-2">
                  <Link href={`/master/siswa/${row.id}`} className={buttonClass('secondary', 'sm')}>Ubah</Link>
                  <ActionButton
                    action={setStudentStatusAction.bind(null, row.id, row.status === 'active' ? 'inactive' : 'active')}
                    label={row.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </ScrollTable>

      <Pagination path="/master/siswa" page={page} total={total} query={{ q, kelas: className, status }} />
    </>
  );
}
