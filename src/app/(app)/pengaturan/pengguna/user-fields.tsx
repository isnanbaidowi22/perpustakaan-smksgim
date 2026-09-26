import { TextField } from '@/components/ui/fields';
import type { User } from '@/server/queries/users';

/** Nama lengkap, dipakai bersama halaman tambah dan ubah pengguna. Setiap akun adalah admin. */
export function ProfileFields({ user }: { user?: User }) {
  return <TextField name="fullName" label="Nama lengkap" defaultValue={user?.fullName} required maxLength={100} />;
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
