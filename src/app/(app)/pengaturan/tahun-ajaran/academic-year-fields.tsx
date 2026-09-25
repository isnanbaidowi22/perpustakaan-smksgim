import { TextField } from '@/components/ui/fields';
import type { AcademicYear } from '@/server/queries/academic-years';

/** Kolom form tahun ajaran, dipakai bersama halaman tambah dan ubah. */
export function AcademicYearFields({ year }: { year?: AcademicYear }) {
  return (
    <>
      <TextField
        name="name"
        label="Nama tahun ajaran"
        defaultValue={year?.name}
        required
        autoFocus={!year}
        maxLength={20}
        hint="Dua tahun berurutan, misalnya 2026/2027."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="startDate" label="Tanggal mulai" type="date" defaultValue={year?.startDate} required />
        <TextField name="endDate" label="Tanggal selesai" type="date" defaultValue={year?.endDate} required />
      </div>
    </>
  );
}
