import { ActionForm } from '@/components/ui/action-form';
import { PageHeader } from '@/components/ui/page-header';
import { createBookAction } from '@/server/actions/books';
import { listCategoryOptions } from '@/server/queries/categories';
import { listRackOptions } from '@/server/queries/racks';
import { BookFields } from '../book-fields';

export default async function NewBookPage() {
  const [categoryOptions, rackOptions] = await Promise.all([listCategoryOptions(), listRackOptions()]);

  return (
    <>
      <PageHeader title="Tambah Buku" description="Eksemplar ditambahkan setelah data judul tersimpan." />
      <ActionForm action={createBookAction} submitLabel="Simpan Buku" cancelHref="/master/buku">
        <BookFields categoryOptions={categoryOptions} rackOptions={rackOptions} />
      </ActionForm>
    </>
  );
}
