import Link from 'next/link';
import { AccessDenied } from '@/components/ui/access-denied';
import { ActionButton } from '@/components/ui/action-button';
import { buttonClass } from '@/components/ui/button-styles';
import { Flash } from '@/components/ui/flash';
import { PageHeader } from '@/components/ui/page-header';
import { RecordStatusBadge } from '@/components/ui/record-status-badge';
import { ScrollTable } from '@/components/ui/scroll-table';
import { TD, TH } from '@/components/ui/table-styles';
import { firstValue, type SearchParams } from '@/lib/search-params';
import { setUserStatusAction } from '@/server/actions/users';
import { requireProfile } from '@/server/auth/guard';
import { listUsers } from '@/server/queries/users';

export default async function UsersPage({ searchParams }: { searchParams: SearchParams }) {
  const profile = await requireProfile();
  if (profile.role !== 'admin') return <AccessDenied />;
  const params = await searchParams;
  const users = await listUsers();

  return (
    <>
      <PageHeader
        title="Pengguna"
        description="Akun yang dapat masuk ke aplikasi. Setiap akun dapat mengelola seluruh data dan pengaturan. Username tidak dapat diubah setelah dibuat."
        actions={<Link href="/pengaturan/pengguna/baru" className={buttonClass('primary')}>Tambah Pengguna</Link>}
      />
      <Flash message={firstValue(params.pesan)} />

      <ScrollTable>
        <thead>
          <tr>
            <th className={TH}>Username</th>
            <th className={TH}>Nama</th>
            <th className={TH}>Status</th>
            <th className={TH}><span className="sr-only">Aksi</span></th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td className={`${TD} font-mono`}>{user.username}</td>
              <td className={TD}>{user.fullName}</td>
              <td className={TD}><RecordStatusBadge status={user.status} /></td>
              <td className={TD}>
                <div className="flex items-start justify-end gap-2">
                  <Link href={`/pengaturan/pengguna/${user.id}`} className={buttonClass('secondary', 'sm')}>Ubah</Link>
                  {user.id === profile.id ? (
                    <span className="px-2.5 py-1 text-xs text-[var(--color-ink-500)]">Akun Anda</span>
                  ) : (
                    <ActionButton
                      action={setUserStatusAction.bind(null, user.id, user.status === 'active' ? 'inactive' : 'active')}
                      label={user.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                      confirmText={
                        user.status === 'active'
                          ? `Nonaktifkan ${user.username}? Pengguna ini tidak dapat masuk sampai diaktifkan kembali.`
                          : undefined
                      }
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
