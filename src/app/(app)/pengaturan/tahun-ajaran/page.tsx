import Link from 'next/link';
import { AccessDenied } from '@/components/ui/access-denied';
import { ActionButton } from '@/components/ui/action-button';
import { buttonClass } from '@/components/ui/button-styles';
import { Flash } from '@/components/ui/flash';
import { PageHeader } from '@/components/ui/page-header';
import { RecordStatusBadge } from '@/components/ui/record-status-badge';
import { ScrollTable } from '@/components/ui/scroll-table';
import { TD, TH } from '@/components/ui/table-styles';
import { formatDate } from '@/lib/format';
import { firstValue, type SearchParams } from '@/lib/search-params';
import { activateAcademicYearAction } from '@/server/actions/academic-years';
import { requireProfile } from '@/server/auth/guard';
import { listAcademicYears } from '@/server/queries/academic-years';

export default async function AcademicYearsPage({ searchParams }: { searchParams: SearchParams }) {
  const profile = await requireProfile();
  if (profile.role !== 'admin') return <AccessDenied />;
  const params = await searchParams;
  const years = await listAcademicYears();

  return (
    <>
      <PageHeader
        title="Tahun Ajaran"
        description="Tepat satu tahun ajaran aktif. Setiap peminjaman tercatat di tahun ajaran yang aktif saat itu."
        actions={<Link href="/pengaturan/tahun-ajaran/baru" className={buttonClass('primary')}>Tambah Tahun Ajaran</Link>}
      />
      <Flash message={firstValue(params.pesan)} />

      <ScrollTable>
        <thead>
          <tr>
            <th className={TH}>Nama</th>
            <th className={TH}>Mulai</th>
            <th className={TH}>Selesai</th>
            <th className={TH}>Status</th>
            <th className={TH}><span className="sr-only">Aksi</span></th>
          </tr>
        </thead>
        <tbody>
          {years.length === 0 && (
            <tr>
              <td colSpan={5} className={`${TD} text-center text-[var(--color-ink-500)]`}>
                Belum ada tahun ajaran. Tambahkan satu dan jadikan aktif agar peminjaman dapat dibuat.
              </td>
            </tr>
          )}
          {years.map((year) => (
            <tr key={year.id}>
              <td className={`${TD} font-medium`}>{year.name}</td>
              <td className={`${TD} tabular-nums`}>{formatDate(year.startDate)}</td>
              <td className={`${TD} tabular-nums`}>{formatDate(year.endDate)}</td>
              <td className={TD}><RecordStatusBadge status={year.isActive ? 'active' : 'inactive'} /></td>
              <td className={TD}>
                <div className="flex items-start justify-end gap-2">
                  <Link href={`/pengaturan/tahun-ajaran/${year.id}`} className={buttonClass('secondary', 'sm')}>Ubah</Link>
                  {!year.isActive && (
                    <ActionButton
                      action={activateAcademicYearAction.bind(null, year.id)}
                      label="Jadikan Aktif"
                      confirmText={`Jadikan ${year.name} tahun ajaran aktif? Peminjaman baru akan tercatat di tahun ini.`}
                    />
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </ScrollTable>
    </>
  );
}
