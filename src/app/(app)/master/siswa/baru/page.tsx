import { ActionForm } from '@/components/ui/action-form';
import { PageHeader } from '@/components/ui/page-header';
import { createStudentAction } from '@/server/actions/students';
import { getActiveAcademicYear, listAcademicYearOptions } from '@/server/queries/academic-years';
import { StudentFields } from '../student-fields';

export default async function NewStudentPage() {
  const [yearOptions, activeYear] = await Promise.all([listAcademicYearOptions(), getActiveAcademicYear()]);

  return (
    <>
      <PageHeader title="Tambah Siswa" />
      <ActionForm action={createStudentAction} submitLabel="Simpan Siswa" cancelHref="/master/siswa">
        <StudentFields yearOptions={yearOptions} defaultYearId={activeYear?.id ?? null} />
      </ActionForm>
    </>
  );
}
