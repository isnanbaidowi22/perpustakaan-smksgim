import { SelectField, TextField } from '@/components/ui/fields';
import type { Option } from '@/lib/options';
import type { Student } from '@/server/queries/students';

const GENDER_OPTIONS: Option[] = [
  { value: 'L', label: 'Laki-laki' },
  { value: 'P', label: 'Perempuan' },
];

/** Kolom form siswa, dipakai bersama halaman tambah dan ubah. */
export function StudentFields({
  student,
  yearOptions,
  defaultYearId,
}: {
  student?: Student;
  yearOptions: Option[];
  defaultYearId: string | null;
}) {
  return (
    <>
      <TextField name="nis" label="NIS" defaultValue={student?.nis} required autoFocus={!student} maxLength={30} />
      <TextField name="name" label="Nama lengkap" defaultValue={student?.name} required maxLength={150} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="className"
          label="Kelas"
          defaultValue={student?.className}
          required
          maxLength={30}
          hint="Tulis persis seperti di data sekolah, misalnya XI RPL 1."
        />
        <TextField name="major" label="Jurusan" defaultValue={student?.major ?? ''} maxLength={50} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          name="gender"
          label="Jenis kelamin"
          placeholder="— Tidak diisi —"
          defaultValue={student?.gender ?? ''}
          options={GENDER_OPTIONS}
        />
        <TextField
          name="phone"
          label="Nomor telepon"
          type="tel"
          inputMode="tel"
          defaultValue={student?.phone ?? ''}
          maxLength={20}
        />
      </div>
      <SelectField
        name="academicYearId"
        label="Tahun ajaran"
        placeholder="— Tanpa tahun ajaran —"
        defaultValue={student?.academicYearId ?? defaultYearId ?? ''}
        options={yearOptions}
      />
    </>
  );
}
