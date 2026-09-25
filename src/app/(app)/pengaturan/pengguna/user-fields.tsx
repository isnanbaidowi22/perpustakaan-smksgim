import { SelectField, TextField } from '@/components/ui/fields';
import type { UserRole } from '@/domain/shared/types';
import type { Option } from '@/lib/options';
import type { User } from '@/server/queries/users';

export const ROLE_LABELS: Record<UserRole, string> = { admin: 'Admin', petugas: 'Petugas' };

const ROLE_OPTIONS: Option[] = [
  { value: 'petugas', label: ROLE_LABELS.petugas },
  { value: 'admin', label: ROLE_LABELS.admin },
];

/** Nama dan peran, dipakai bersama halaman tambah dan ubah pengguna. */
export function ProfileFields({ user, isSelf = false }: { user?: User; isSelf?: boolean }) {
  return (
    <>
      <TextField name="fullName" label="Nama lengkap" defaultValue={user?.fullName} required maxLength={100} />
      <SelectField
        name="role"
        label="Peran"
        required
        defaultValue={user?.role ?? 'petugas'}
        options={ROLE_OPTIONS}
        hint={
          isSelf
            ? 'Peran akun Anda sendiri tidak dapat diubah. Minta admin lain bila perlu.'
            : 'Admin juga dapat mengelola pengguna, tahun ajaran, dan konfigurasi.'
        }
      />
    </>
  );
}

/** Kolom kata sandi. Isinya tidak pernah dikirim balik setelah galat. */
export function PasswordFields() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField
        name="password"
        label="Kata sandi"
        type="password"
        autoComplete="new-password"
        required
        hint="Minimal 8 karakter."
      />
      <TextField
        name="passwordConfirm"
        label="Ulangi kata sandi"
        type="password"
        autoComplete="new-password"
        required
      />
    </div>
  );
}
