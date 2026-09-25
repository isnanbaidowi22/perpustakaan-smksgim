import { calculateDueDate } from '@/domain/loan/due-date';
import { PageHeader } from '@/components/ui/page-header';
import { schoolToday } from '@/lib/school-date';
import { requireProfile } from '@/server/auth/guard';
import { getActiveAcademicYear } from '@/server/queries/academic-years';
import { getLibrarySettings } from '@/server/queries/settings';
import { LoanDesk } from './loan-desk';

export default async function LoanPage() {
  await requireProfile();
  const today = schoolToday();
  const [settings, activeYear] = await Promise.all([getLibrarySettings(), getActiveAcademicYear()]);

  return (
    <>
      <PageHeader
        title="Peminjaman"
        description="Pindai kartu siswa, lalu pindai barcode setiap buku. Tekan Ctrl+Enter untuk menyimpan."
      />
      {!activeYear && (
        <p role="alert" className="mb-4 rounded-md bg-[var(--color-status-terlambat)]/10 px-3 py-2 text-sm text-[var(--color-status-terlambat)]">
          Belum ada tahun ajaran aktif. Peminjaman tidak dapat disimpan sampai admin mengaktifkannya di Pengaturan → Tahun Ajaran.
        </p>
      )}
      <LoanDesk
        loanDate={today}
        dueDate={calculateDueDate(today, settings.loanDurationDays)}
        durationDays={settings.loanDurationDays}
      />
    </>
  );
}
