import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/ui/action-form';
import { PageHeader } from '@/components/ui/page-header';
import { updateStudentAction } from '@/server/actions/students';
import { listAcademicYearOptions } from '@/server/queries/academic-years';
import { getStudent } from '@/server/queries/students';
import { StudentFields } from '../student-fields';

export default async function EditStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [student, yearOptions] = await Promise.all([getStudent(id), listAcademicYearOptions()]);
  if (!student) notFound();

  return (
    <>
      <PageHeader title="Ubah Data Siswa" description={`${student.nis} · ${student.name}`} />
      <ActionForm
        action={updateStudentAction.bind(null, student.id)}
        submitLabel="Simpan Perubahan"
        cancelHref="/master/siswa"
      >
        <StudentFields student={student} yearOptions={yearOptions} defaultYearId={null} />
      </ActionForm>
    </>
  );
}
