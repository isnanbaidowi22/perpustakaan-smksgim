import { AccessDenied } from '@/components/ui/access-denied';
import { ActionForm } from '@/components/ui/action-form';
import { CheckboxField, TextAreaField, TextField } from '@/components/ui/fields';
import { PageHeader } from '@/components/ui/page-header';
import { updateSettingsAction } from '@/server/actions/settings';
import { requireProfile } from '@/server/auth/guard';
import { getLibrarySettings } from '@/server/queries/settings';

const LEGEND = 'mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-500)]';

export default async function SettingsPage() {
  const profile = await requireProfile();
  if (profile.role !== 'admin') return <AccessDenied />;
  const settings = await getLibrarySettings();

  return (
    <>
      <PageHeader
        title="Konfigurasi"
        description="Aturan peminjaman dan isi struk. Perubahan berlaku untuk transaksi berikutnya."
      />
      <ActionForm action={updateSettingsAction} submitLabel="Simpan Konfigurasi">
        <fieldset className="space-y-4">
          <legend className={LEGEND}>Aturan peminjaman</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField
              name="maxActiveLoans"
              label="Batas pinjam per siswa"
              type="number"
              inputMode="numeric"
              required
              defaultValue={String(settings.maxActiveLoans)}
              hint="Eksemplar yang boleh dipinjam sekaligus."
            />
            <TextField
              name="loanDurationDays"
              label="Durasi pinjam (hari)"
              type="number"
              inputMode="numeric"
              required
              defaultValue={String(settings.loanDurationDays)}
              hint="Jatuh tempo pinjaman yang sudah berjalan tidak berubah."
            />
            <TextField
              name="finePerDay"
              label="Denda per hari (Rp)"
              inputMode="numeric"
              required
              defaultValue={String(settings.finePerDay)}
              hint="Per eksemplar. Berlaku untuk setiap pengembalian berikutnya."
            />
          </div>
          <CheckboxField
            name="blockWhenOverdue"
            label="Tolak peminjaman baru bila siswa punya pinjaman terlambat"
            defaultChecked={settings.blockWhenOverdue}
            hint="Aturan bawaan. Matikan hanya bila pengelola perpustakaan memutuskan demikian."
          />
          <CheckboxField
            name="blockWhenUnpaidFine"
            label="Tolak peminjaman baru bila siswa punya denda belum lunas"
            defaultChecked={settings.blockWhenUnpaidFine}
            hint="Mati secara bawaan: tunggakan tetap dicatat, tetapi tidak menghalangi peminjaman."
          />
        </fieldset>
        <fieldset className="space-y-4 pt-2">
          <legend className={LEGEND}>Struk peminjaman</legend>
          <TextField
            name="schoolName"
            label="Nama sekolah"
            required
            maxLength={150}
            defaultValue={settings.schoolName ?? ''}
          />
          <TextAreaField
            name="receiptFooter"
            label="Catatan kaki struk"
            defaultValue={settings.receiptFooter ?? ''}
            hint="Dicetak di bagian bawah struk, misalnya pengingat jatuh tempo."
          />
        </fieldset>
      </ActionForm>
    </>
  );
}
