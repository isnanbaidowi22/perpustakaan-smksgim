import { z } from 'zod';
import { checkbox, isoDate, requiredText } from './common';

const NAME_PATTERN = /^(\d{4})\/(\d{4})$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const NAME_FORMAT = 'Nama tahun ajaran ditulis seperti 2026/2027: dua tahun berurutan.';

function isConsecutive(name: string): boolean {
  const match = NAME_PATTERN.exec(name);
  return match !== null && Number(match[2]) === Number(match[1]) + 1;
}

const fields = {
  // Satu pemeriksaan di dalam `.pipe()`, bukan `.regex()` lalu `.refine()`:
  // zod 4 tetap menjalankan `.refine()` walau `.regex()` gagal, sehingga
  // pesan yang sama muncul dua kali. `.pipe()` berhenti di kegagalan pertama.
  name: requiredText('Nama tahun ajaran wajib diisi, misalnya 2026/2027.', 20)
    .pipe(z.string().refine(isConsecutive, NAME_FORMAT)),
  startDate: isoDate('Tanggal mulai wajib diisi dengan tanggal yang valid.'),
  endDate: isoDate('Tanggal selesai wajib diisi dengan tanggal yang valid.'),
};

interface YearDates {
  name: string;
  startDate: string;
  endDate: string;
}

/**
 * Tanggal yang tidak cocok dengan namanya hampir selalu salah ketik tahun,
 * dan tahun ajaran yang keliru membuat transaksi setahun penuh tercatat di
 * tahun yang salah. Karena tahun kedua = tahun pertama + 1, tanggal selesai
 * otomatis setelah tanggal mulai bila keduanya lolos pemeriksaan ini.
 *
 * Zod 4 tetap menjalankan refinement objek walau kolomnya punya galat
 * format; pemeriksaan dilewati bila nama atau tanggal belum sah, agar tidak
 * menumpuk pesan yang menyesatkan.
 */
function dateIssues({ name, startDate, endDate }: YearDates): { path: keyof YearDates; message: string }[] {
  if (!isConsecutive(name)) return [];
  const [firstYear, secondYear] = name.split('/');
  const issues: { path: keyof YearDates; message: string }[] = [];
  if (ISO_DATE.test(startDate) && !startDate.startsWith(`${firstYear}-`)) {
    issues.push({ path: 'startDate', message: `Tanggal mulai harus jatuh pada tahun ${firstYear}, sesuai nama tahun ajaran.` });
  }
  if (ISO_DATE.test(endDate) && !endDate.startsWith(`${secondYear}-`)) {
    issues.push({ path: 'endDate', message: `Tanggal selesai harus jatuh pada tahun ${secondYear}, sesuai nama tahun ajaran.` });
  }
  return issues;
}

export const academicYearSchema = z.object(fields).superRefine((value, ctx) => {
  for (const issue of dateIssues(value)) ctx.addIssue({ code: 'custom', path: [issue.path], message: issue.message });
});

export const newAcademicYearSchema = z.object({ ...fields, activate: checkbox() }).superRefine((value, ctx) => {
  for (const issue of dateIssues(value)) ctx.addIssue({ code: 'custom', path: [issue.path], message: issue.message });
});

export type AcademicYearInput = z.output<typeof academicYearSchema>;
export type NewAcademicYearInput = z.output<typeof newAcademicYearSchema>;
