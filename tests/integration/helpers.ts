import { expect } from 'vitest';
import { eq, sql, TransactionRollbackError } from 'drizzle-orm';
import type { Actor } from '@/domain/shared/types';
import type { AuthAdmin, AuthAdminResult } from '@/server/auth/auth-admin';
import { db } from '@/server/db/client';
import type { Transaction } from '@/server/db/executor';
import { profiles } from '@/server/db/schema';

/**
 * Menjalankan `fn` di dalam transaksi yang SELALU di-rollback.
 *
 * DATABASE_URL menunjuk ke database pengembangan di Supabase cloud yang
 * berisi data seed. Uji integrasi tidak boleh meninggalkan jejak di sana:
 * tidak ada `truncate`, tidak ada commit. Setiap uji hidup dan mati di dalam
 * satu transaksi. Service yang membuka transaksi sendiri akan mendapat
 * savepoint, sehingga galat di dalam service tidak merusak transaksi uji.
 */
export async function withRollback(fn: (tx: Transaction) => Promise<void>): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      await fn(tx);
      tx.rollback();
    });
  } catch (error) {
    if (error instanceof TransactionRollbackError) return;
    throw error;
  }
}

/**
 * Profil sungguhan untuk kolom yang mereferensikan `profiles`
 * (audit_logs.user_id, loans.created_by). Profil tidak dapat dibuat di dalam
 * uji karena `profiles.id` mereferensikan `auth.users` milik Supabase.
 */
export async function testActor(tx: Transaction): Promise<Actor> {
  const [profile] = await tx
    .select({ id: profiles.id, role: profiles.role })
    .from(profiles)
    .where(eq(profiles.status, 'active'))
    .limit(1);

  if (!profile) {
    throw new Error('Tidak ada profil aktif. Jalankan "npm run db:seed" sebelum uji integrasi.');
  }
  return profile;
}

/**
 * Memastikan sebuah kueri ditolak oleh constraint tertentu.
 * Pesan galat Drizzle hanya berisi SQL; nama constraint ada di `cause`.
 * Pernyataan yang gagal membatalkan transaksi, jadi panggil ini paling akhir.
 */
export async function expectConstraint(promise: Promise<unknown>, constraint: string): Promise<void> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  expect(error, `kueri seharusnya ditolak ${constraint}`).not.toBeNull();
  const cause = (error as { cause?: { constraint_name?: string } }).cause;
  expect(cause?.constraint_name).toBe(constraint);
}

export interface FakeAuthAdmin extends AuthAdmin {
  created: { id: string; email: string; password: string }[];
  passwords: { userId: string; password: string }[];
  deleted: string[];
}

interface FakeOptions {
  /** Meniru akun Supabase yang terbuat tetapi tanpa baris auth.users, agar penyimpanan profil ditolak foreign key. */
  withoutAuthRow?: boolean;
  createError?: { code: string | null; message: string };
  passwordError?: { code: string | null; message: string };
}

/**
 * Tiruan Supabase Auth untuk uji integrasi. Uji tidak boleh membuat akun
 * sungguhan di Supabase cloud, tetapi `profiles.id` mereferensikan
 * `auth.users`. Karena itu `createUser` menyisipkan baris `auth.users` di
 * transaksi uji yang sama, sehingga ikut di-rollback bersama profilnya.
 */
export function fakeAuthAdmin(tx: Transaction, options: FakeOptions = {}): FakeAuthAdmin {
  const fake: FakeAuthAdmin = {
    created: [],
    passwords: [],
    deleted: [],
    async createUser(email, password): Promise<AuthAdminResult> {
      if (options.createError) return { ok: false, ...options.createError };
      const id = crypto.randomUUID();
      if (!options.withoutAuthRow) {
        await tx.execute(sql`
          insert into auth.users (instance_id, id, aud, role, email)
          values ('00000000-0000-0000-0000-000000000000', ${id}, 'authenticated', 'authenticated', ${email})
        `);
      }
      fake.created.push({ id, email, password });
      return { ok: true, id };
    },
    async setPassword(userId, password): Promise<AuthAdminResult> {
      if (options.passwordError) return { ok: false, ...options.passwordError };
      fake.passwords.push({ userId, password });
      return { ok: true, id: userId };
    },
    async deleteUser(userId) {
      fake.deleted.push(userId);
    },
  };
  return fake;
}
