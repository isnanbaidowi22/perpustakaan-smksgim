import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/ui/action-form';
import { PageHeader } from '@/components/ui/page-header';
import { updateAcademicYearAction } from '@/server/actions/academic-years';
import { requireProfile } from '@/server/auth/guard';
import { getAcademicYear } from '@/server/queries/academic-years';
import { AcademicYearFields } from '../academic-year-fields';

export default async function EditAcademicYearPage({ params }: { params: Promise<{ id: string }> }) {
  await requireProfile();
  const { id } = await params;
  const year = await getAcademicYear(id);
  if (!year) notFound();

  return (
    <>
      <PageHeader
        title="Ubah Tahun Ajaran"
        description={year.isActive ? `${year.name} · tahun ajaran aktif` : year.name}
      />
      <ActionForm
        action={updateAcademicYearAction.bind(null, year.id)}
        submitLabel="Simpan Perubahan"
        cancelHref="/pengaturan/tahun-ajaran"
      >
        <AcademicYearFields year={year} />
      </ActionForm>
    </>
  );
}
