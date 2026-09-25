import { ActionForm } from '@/components/ui/action-form';
import { PageHeader } from '@/components/ui/page-header';
import { createRackAction } from '@/server/actions/racks';
import { RackFields } from '../rack-fields';

export default function NewRackPage() {
  return (
    <>
      <PageHeader title="Tambah Rak" />
      <ActionForm action={createRackAction} submitLabel="Simpan Rak" cancelHref="/master/rak">
        <RackFields />
      </ActionForm>
    </>
  );
}
