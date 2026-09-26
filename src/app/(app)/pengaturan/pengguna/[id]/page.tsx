import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/ui/action-form';
import { PageHeader } from '@/components/ui/page-header';
import { resetUserPasswordAction, updateUserAction } from '@/server/actions/users';
import { requireProfile } from '@/server/auth/guard';
import { getUser } from '@/server/queries/users';
import { PasswordFields, ProfileFields } from '../user-fields';

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  await requireProfile();
  const { id } = await params;
  const user = await getUser(id);
  if (!user) notFound();

  return (
    <>
      <PageHeader title="Ubah Pengguna" description={`${user.username} · ${user.fullName}`} />
      <ActionForm
        action={updateUserAction.bind(null, user.id)}
        submitLabel="Simpan Perubahan"
        cancelHref="/pengaturan/pengguna"
      >
        <ProfileFields user={user} />
      </ActionForm>

      <h2 className="page-title mb-3 mt-8 text-lg font-semibold">Atur Ulang Kata Sandi</h2>
      <ActionForm action={resetUserPasswordAction.bind(null, user.id)} submitLabel="Ganti Kata Sandi">
        <PasswordFields />
      </ActionForm>
    </>
  );
}
