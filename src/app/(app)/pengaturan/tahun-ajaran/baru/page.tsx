import { ActionForm } from '@/components/ui/action-form';
import { CheckboxField } from '@/components/ui/fields';
import { PageHeader } from '@/components/ui/page-header';
import { createAcademicYearAction } from '@/server/actions/academic-years';
import { requireProfile } from '@/server/auth/guard';
import { getActiveAcademicYear } from '@/server/queries/academic-years';
import { AcademicYearFields } from '../academic-year-fields';

export default async function NewAcademicYearPage() {
  await requireProfile();
  const active = await getActiveAcademicYear();

  return (
    <>
      <PageHeader title="Tambah Tahun Ajaran" />
      <ActionForm action={createAcademicYearAction} submitLabel="Simpan Tahun Ajaran" cancelHref="/pengaturan/tahun-ajaran">
        <AcademicYearFields />
        <CheckboxField
          name="activate"
          label="Jadikan tahun ajaran aktif sekarang"
          defaultChecked={!active}
          hint={
            active
              ? `Tahun ajaran aktif saat ini ${active.name}. Bila dicentang, peminjaman baru tercatat di tahun yang baru.`
              : 'Belum ada tahun ajaran aktif. Tanpa tahun aktif, peminjaman tidak dapat dibuat.'
          }
        />
      </ActionForm>
    </>
  );
}
