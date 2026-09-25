import { z } from 'zod';
import { VALID_USERNAME } from '@/server/auth/username';
import { requiredText } from './common';

const PASSWORD_MIN = 'Kata sandi minimal 8 karakter.';
const CONFIRM = 'Ulangi kata sandi yang sama persis.';

// Kata sandi tidak di-trim: spasi di ujung adalah bagian sah dari kata sandi.
// 72 adalah batas bcrypt yang dipakai Supabase Auth.
const password = z.string({ error: PASSWORD_MIN }).min(8, PASSWORD_MIN).max(72, 'Kata sandi maksimal 72 karakter.');
const passwordConfirm = z.string().optional();

function sameConfirmation(value: { password: string; passwordConfirm?: string }): boolean {
  return value.password === value.passwordConfirm;
}

const fullName = requiredText('Nama lengkap wajib diisi.', 100);
const role = z.enum(['admin', 'petugas'], 'Peran harus admin atau petugas.');

const USERNAME_SHAPE = 'Username harus diawali dan diakhiri huruf atau angka, tanpa titik berurutan, misalnya siti.aminah.';

/**
 * Supabase memakai username sebagai local-part surel internal (lihat
 * `usernameToEmail`), yang menolak local-part berawal/berakhir titik atau
 * berisi titik berurutan. `VALID_USERNAME` (login) TIDAK diubah agar
 * username lama yang sudah terlanjur dibuat tetap bisa masuk.
 */
function hasValidUsernameShape(value: string): boolean {
  return /^[a-z0-9]/.test(value) && /[a-z0-9]$/.test(value) && !value.includes('..');
}

export const newUserSchema = z
  .object({
    username: requiredText('Username wajib diisi.', 30)
      .transform((value) => value.toLowerCase())
      .pipe(
        z.string()
          .min(3, 'Username minimal 3 karakter.')
          .regex(VALID_USERNAME, 'Username hanya boleh berisi huruf kecil, angka, titik, dan garis bawah, misalnya siti.aminah.')
          .pipe(z.string().refine(hasValidUsernameShape, USERNAME_SHAPE)),
      ),
    fullName,
    role,
    password,
    passwordConfirm,
  })
  .refine(sameConfirmation, { path: ['passwordConfirm'], error: CONFIRM });

/** Username tidak dapat diubah: ia menjadi surel internal akun Supabase. */
export const userSchema = z.object({ fullName, role });

export const passwordSchema = z
  .object({ password, passwordConfirm })
  .refine(sameConfirmation, { path: ['passwordConfirm'], error: CONFIRM });

export type NewUserInput = z.output<typeof newUserSchema>;
export type UserInput = z.output<typeof userSchema>;
export type PasswordInput = z.output<typeof passwordSchema>;
