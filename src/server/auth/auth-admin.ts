import { createClient } from '@supabase/supabase-js';

export type AuthAdminResult =
  | { ok: true; id: string }
  | { ok: false; code: string | null; message: string };

/**
 * Operasi Supabase Auth yang dibutuhkan manajemen pengguna. Service
 * menerimanya sebagai parameter, sehingga uji integrasi dapat memakai tiruan
 * yang tidak membuat akun sungguhan di Supabase cloud.
 */
export interface AuthAdmin {
  createUser(email: string, password: string): Promise<AuthAdminResult>;
  setPassword(userId: string, password: string): Promise<AuthAdminResult>;
  /** Dipakai untuk membersihkan akun bila profilnya gagal disimpan. Tidak pernah melempar. */
  deleteUser(userId: string): Promise<void>;
}

function failure(error: { code?: string; message: string } | null): AuthAdminResult {
  return { ok: false, code: error?.code ?? null, message: error?.message ?? 'Supabase tidak mengembalikan data akun' };
}

/** Hanya untuk kode server: kunci service role melewati seluruh RLS. */
export function supabaseAuthAdmin(): AuthAdmin {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  return {
    async createUser(email, password) {
      const { data, error } = await client.auth.admin.createUser({ email, password, email_confirm: true });
      if (error || !data.user) return failure(error);
      return { ok: true, id: data.user.id };
    },
    async setPassword(userId, password) {
      const { data, error } = await client.auth.admin.updateUserById(userId, { password });
      if (error || !data.user) return failure(error);
      return { ok: true, id: data.user.id };
    },
    async deleteUser(userId) {
      const { error } = await client.auth.admin.deleteUser(userId);
      if (error) {
        console.error(
          `Akun autentikasi ${userId} gagal dihapus setelah profilnya gagal disimpan: ${error.message}. ` +
          'Hapus akun itu lewat dasbor Supabase agar username-nya dapat dipakai lagi.',
        );
      }
    },
  };
}
