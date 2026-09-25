import { expect } from 'vitest';
import { and, eq, TransactionRollbackError } from 'drizzle-orm';
import type { Actor, UserRole } from '@/domain/shared/types';
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
export async function testActor(tx: Transaction, role: UserRole = 'admin'): Promise<Actor> {
  const [profile] = await tx
    .select({ id: profiles.id, role: profiles.role })
    .from(profiles)
    .where(and(eq(profiles.role, role), eq(profiles.status, 'active')))
    .limit(1);

  if (!profile) {
    throw new Error(`Tidak ada profil ${role} aktif. Jalankan "npm run db:seed" sebelum uji integrasi.`);
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
