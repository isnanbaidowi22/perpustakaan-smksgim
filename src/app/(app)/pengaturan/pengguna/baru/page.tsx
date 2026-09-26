import { ActionForm } from '@/components/ui/action-form';
import { TextField } from '@/components/ui/fields';
import { PageHeader } from '@/components/ui/page-header';
import { createUserAction } from '@/server/actions/users';
import { requireProfile } from '@/server/auth/guard';
import { PasswordFields, ProfileFields } from '../user-fields';

export default async function NewUserPage() {
  await requireProfile();

  return (
    <>
      <PageHeader title="Tambah Pengguna" />
      <ActionForm action={createUserAction} submitLabel="Buat Pengguna" cancelHref="/pengaturan/pengguna">
        <TextField
          name="username"
          label="Username"
          required
          autoFocus
          maxLength={30}
          hint="Huruf kecil, angka, titik, dan garis bawah, misalnya siti.aminah. Tidak dapat diubah setelah dibuat."
        />
        <ProfileFields />
        <PasswordFields />
      </ActionForm>
    </>
  );
}
