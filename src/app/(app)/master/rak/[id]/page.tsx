import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/ui/action-form';
import { PageHeader } from '@/components/ui/page-header';
import { updateRackAction } from '@/server/actions/racks';
import { requireProfile } from '@/server/auth/guard';
import { getRack } from '@/server/queries/racks';
import { RackFields } from '../rack-fields';

export default async function EditRackPage({ params }: { params: Promise<{ id: string }> }) {
  await requireProfile();
  const { id } = await params;
  const rack = await getRack(id);
  if (!rack) notFound();

  return (
    <>
      <PageHeader title="Ubah Rak" description={`${rack.code} — ${rack.name}`} />
      <ActionForm action={updateRackAction.bind(null, rack.id)} submitLabel="Simpan Perubahan" cancelHref="/master/rak">
        <RackFields rack={rack} />
      </ActionForm>
    </>
  );
}
