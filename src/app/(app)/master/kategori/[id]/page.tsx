import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/ui/action-form';
import { TextField } from '@/components/ui/fields';
import { PageHeader } from '@/components/ui/page-header';
import { updateCategoryAction } from '@/server/actions/categories';
import { requireProfile } from '@/server/auth/guard';
import { getCategory } from '@/server/queries/categories';

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  await requireProfile();
  const { id } = await params;
  const category = await getCategory(id);
  if (!category) notFound();

  return (
    <>
      <PageHeader title="Ubah Kategori" description={category.name} />
      <ActionForm
        action={updateCategoryAction.bind(null, category.id)}
        submitLabel="Simpan Perubahan"
        cancelHref="/master/kategori"
      >
        <TextField name="name" label="Nama kategori" defaultValue={category.name} required maxLength={100} />
      </ActionForm>
    </>
  );
}
