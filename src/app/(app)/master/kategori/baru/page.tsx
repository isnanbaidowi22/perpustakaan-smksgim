import { ActionForm } from '@/components/ui/action-form';
import { TextField } from '@/components/ui/fields';
import { PageHeader } from '@/components/ui/page-header';
import { createCategoryAction } from '@/server/actions/categories';

export default function NewCategoryPage() {
  return (
    <>
      <PageHeader title="Tambah Kategori" />
      <ActionForm action={createCategoryAction} submitLabel="Simpan Kategori" cancelHref="/master/kategori">
        <TextField name="name" label="Nama kategori" required autoFocus maxLength={100} />
      </ActionForm>
    </>
  );
}
