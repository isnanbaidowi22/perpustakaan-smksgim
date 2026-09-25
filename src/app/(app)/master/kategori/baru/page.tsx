import { ActionForm } from '@/components/ui/action-form';
import { TextField } from '@/components/ui/fields';
import { PageHeader } from '@/components/ui/page-header';
import { createCategoryAction } from '@/server/actions/categories';
import { requireProfile } from '@/server/auth/guard';

export default async function NewCategoryPage() {
  await requireProfile();
  return (
    <>
      <PageHeader title="Tambah Kategori" />
      <ActionForm action={createCategoryAction} submitLabel="Simpan Kategori" cancelHref="/master/kategori">
        <TextField name="name" label="Nama kategori" required autoFocus maxLength={100} />
      </ActionForm>
    </>
  );
}
