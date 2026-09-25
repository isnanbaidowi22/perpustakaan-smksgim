import { ActionForm } from '@/components/ui/action-form';
import { PageHeader } from '@/components/ui/page-header';
import { createRackAction } from '@/server/actions/racks';
import { requireProfile } from '@/server/auth/guard';
import { RackFields } from '../rack-fields';

export default async function NewRackPage() {
  await requireProfile();
  return (
    <>
      <PageHeader title="Tambah Rak" />
      <ActionForm action={createRackAction} submitLabel="Simpan Rak" cancelHref="/master/rak">
        <RackFields />
      </ActionForm>
    </>
  );
}
