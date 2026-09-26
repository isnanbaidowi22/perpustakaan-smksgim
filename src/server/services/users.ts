import { eq } from 'drizzle-orm';
import type { Actor, RecordStatus } from '@/domain/shared/types';
import { writeAudit } from '@/server/audit';
import type { AuthAdmin } from '@/server/auth/auth-admin';
import { usernameToEmail } from '@/server/auth/username';
import { db } from '@/server/db/client';
import { uniqueViolation } from '@/server/db/errors';
import type { Executor } from '@/server/db/executor';
import { profiles } from '@/server/db/schema';
import { isUuid } from '@/server/validation/common';
import type { NewUserInput, PasswordInput, UserInput } from '@/server/validation/user';
import { fail, ok, type ServiceResult } from './result';

const NOT_FOUND = 'Pengguna tidak ditemukan. Muat ulang halaman daftar pengguna.';
const SELF_STATUS = 'Anda tidak dapat menonaktifkan akun Anda sendiri. Minta admin lain melakukannya bila perlu.';

function duplicate(username: string): ServiceResult {
  return fail(`Username ${username} sudah dipakai. Pilih username lain.`, 'username');
}

/**
 * Urutannya: periksa username → buat akun Supabase → simpan profil.
 * Supabase dan Postgres tidak berbagi transaksi, jadi bila profil gagal
 * disimpan, akun Supabase-nya dihapus lagi. Tanpa pembersihan itu username
 * terkunci selamanya: Supabase menolak surel yang sama, sedangkan daftar
 * pengguna tidak menampilkannya.
 */
export async function createUser(
  input: NewUserInput,
  actor: Actor,
  auth: AuthAdmin,
  executor: Executor = db,
): Promise<ServiceResult> {
  const [taken] = await executor
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.username, input.username))
    .limit(1);
  if (taken) return duplicate(input.username);

  const account = await auth.createUser(usernameToEmail(input.username), input.password);
  if (!account.ok) {
    if (account.code === 'email_exists') {
      return fail(
        `Username ${input.username} sudah terdaftar di layanan autentikasi, tetapi tidak ada di daftar pengguna. `
          + 'Pilih username lain, atau minta pengembang menghapus akun lama itu di dasbor Supabase.',
        'username',
      );
    }
    return fail(`Akun ${input.username} belum dapat dibuat di layanan autentikasi (${account.message}). Coba lagi beberapa saat lagi.`);
  }

  // Satu peran sejak revisi 26 September 2026: setiap akun adalah admin.
  const profile = { username: input.username, fullName: input.fullName, role: 'admin' as const };
  try {
    return await executor.transaction(async (tx) => {
      await tx.insert(profiles).values({ id: account.id, ...profile });
      await writeAudit(tx, {
        actorId: actor.id,
        action: 'user.create',
        entity: 'profiles',
        entityId: account.id,
        metadata: profile,
      });
      return ok(account.id);
    });
  } catch (error) {
    await auth.deleteUser(account.id);
    if (uniqueViolation(error) === 'profiles_username_unique') return duplicate(input.username);
    throw error;
  }
}

export async function updateUser(
  id: string,
  input: UserInput,
  actor: Actor,
  executor: Executor = db,
): Promise<ServiceResult> {
  if (!isUuid(id)) return fail(NOT_FOUND);
  return executor.transaction(async (tx) => {
    const [current] = await tx
      .select({ username: profiles.username, fullName: profiles.fullName })
      .from(profiles)
      .where(eq(profiles.id, id))
      .for('update');
    if (!current) return fail(NOT_FOUND);

    const after = { fullName: input.fullName };
    await tx.update(profiles).set({ ...after, updatedAt: new Date() }).where(eq(profiles.id, id));

    await writeAudit(tx, {
      actorId: actor.id,
      action: 'user.update',
      entity: 'profiles',
      entityId: id,
      metadata: { username: current.username, before: { fullName: current.fullName }, after },
    });
    return ok(id);
  });
}

/**
 * Profil nonaktif ditolak `getCurrentProfile()` di setiap request, jadi
 * sesinya yang masih hidup langsung tidak berguna tanpa perlu dicabut.
 */
export async function setUserStatus(
  id: string,
  status: RecordStatus,
  actor: Actor,
  executor: Executor = db,
): Promise<ServiceResult> {
  if (!isUuid(id)) return fail(NOT_FOUND);
  if (id === actor.id) return fail(SELF_STATUS);
  return executor.transaction(async (tx) => {
    const [updated] = await tx
      .update(profiles)
      .set({ status, updatedAt: new Date() })
      .where(eq(profiles.id, id))
      .returning({ username: profiles.username });
    if (!updated) return fail(NOT_FOUND);

    await writeAudit(tx, {
      actorId: actor.id,
      action: status === 'active' ? 'user.activate' : 'user.deactivate',
      entity: 'profiles',
      entityId: id,
      metadata: { username: updated.username },
    });
    return ok(id);
  });
}

/**
 * Spec Section 7: tanpa surel sungguhan, admin-lah yang mengatur ulang kata
 * sandi. Kata sandinya tidak pernah masuk audit log.
 */
export async function resetUserPassword(
  id: string,
  input: PasswordInput,
  actor: Actor,
  auth: AuthAdmin,
  executor: Executor = db,
): Promise<ServiceResult> {
  if (!isUuid(id)) return fail(NOT_FOUND);
  return executor.transaction(async (tx) => {
    const [user] = await tx
      .select({ username: profiles.username })
      .from(profiles)
      .where(eq(profiles.id, id))
      .for('update');
    if (!user) return fail(NOT_FOUND);

    const result = await auth.setPassword(id, input.password);
    if (!result.ok) {
      return fail(`Kata sandi ${user.username} belum dapat diganti (${result.message}). Coba lagi beberapa saat lagi.`);
    }

    await writeAudit(tx, {
      actorId: actor.id,
      action: 'user.reset_password',
      entity: 'profiles',
      entityId: id,
      metadata: { username: user.username },
    });
    return ok(id);
  });
}
