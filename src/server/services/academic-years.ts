import { and, eq, ne } from 'drizzle-orm';
import type { Actor } from '@/domain/shared/types';
import { writeAudit } from '@/server/audit';
import { db } from '@/server/db/client';
import { uniqueViolation } from '@/server/db/errors';
import type { Executor, Transaction } from '@/server/db/executor';
import { academicYears } from '@/server/db/schema';
import type { AcademicYearInput, NewAcademicYearInput } from '@/server/validation/academic-year';
import { isUuid } from '@/server/validation/common';
import { fail, ok, type ServiceResult } from './result';

const NOT_FOUND = 'Tahun ajaran tidak ditemukan. Muat ulang halaman daftar tahun ajaran.';

function duplicate(name: string): ServiceResult {
  return fail(`Tahun ajaran ${name} sudah ada. Ubah data yang lama bila tanggalnya perlu diperbaiki.`, 'name');
}

/**
 * Hanya terjadi bila dua admin menambah tahun aktif pertama pada saat yang
 * sama, ketika belum ada baris untuk dikunci. Selain itu kunci di
 * `lockAcademicYears` sudah mengurutkan keduanya.
 */
const ACTIVE_RACE = 'Tahun ajaran aktif baru saja diubah admin lain. Muat ulang halaman lalu periksa tahun ajaran aktif.';

function knownViolation(error: unknown, name: string): ServiceResult | null {
  const constraint = uniqueViolation(error);
  if (constraint === 'academic_years_name_unique') return duplicate(name);
  if (constraint === 'one_active_academic_year') return fail(ACTIVE_RACE);
  return null;
}

interface LockedYear {
  id: string;
  name: string;
  isActive: boolean;
}

/**
 * Mengunci seluruh baris `academic_years` dalam urutan tetap (`id`). Tanpa
 * kunci, dua admin yang mengaktifkan tahun berbeda bersamaan sama-sama lolos
 * pemeriksaan dan salah satunya ditolak index `one_active_academic_year`
 * belakangan, atau — bila mengaktifkan tahun yang sama — keduanya lolos dan
 * menulis audit dobel. Urutan tetap mencegah dua transaksi saling mengunci
 * baris yang berbeda lebih dulu lalu saling menunggu (deadlock). Tabelnya
 * kecil (satu baris per tahun), jadi mengunci semuanya murah. Baris target
 * TIDAK dikunci sendiri lebih dulu di luar kunci tabel ini — itu akan
 * membuat dua pengaktifan tahun yang berbeda saling deadlock.
 */
async function lockAcademicYears(tx: Transaction): Promise<LockedYear[]> {
  return tx
    .select({ id: academicYears.id, name: academicYears.name, isActive: academicYears.isActive })
    .from(academicYears)
    .orderBy(academicYears.id)
    .for('update');
}

/**
 * Memindahkan tanda aktif ke `id` dan mengembalikan nama tahun yang
 * sebelumnya aktif, menurut `rows` yang sudah dikunci oleh `lockAcademicYears`.
 *
 * Urutannya wajib: matikan yang lama dulu, baru nyalakan yang baru. Index
 * parsial itu tidak dapat ditunda sampai commit.
 */
async function flipActive(tx: Transaction, rows: LockedYear[], id: string): Promise<string | null> {
  const previous = rows.find((row) => row.isActive && row.id !== id);

  await tx
    .update(academicYears)
    .set({ isActive: false })
    .where(and(eq(academicYears.isActive, true), ne(academicYears.id, id)));
  await tx.update(academicYears).set({ isActive: true }).where(eq(academicYears.id, id));
  return previous?.name ?? null;
}

export async function createAcademicYear(
  input: NewAcademicYearInput,
  actor: Actor,
  executor: Executor = db,
): Promise<ServiceResult> {
  const values = { name: input.name, startDate: input.startDate, endDate: input.endDate };
  try {
    return await executor.transaction(async (tx) => {
      const [created] = await tx.insert(academicYears).values(values).returning({ id: academicYears.id });
      if (input.activate) await flipActive(tx, await lockAcademicYears(tx), created.id);

      await writeAudit(tx, {
        actorId: actor.id,
        action: 'academic_year.create',
        entity: 'academic_years',
        entityId: created.id,
        metadata: { ...values, activated: input.activate },
      });
      return ok(created.id);
    });
  } catch (error) {
    const known = knownViolation(error, input.name);
    if (known) return known;
    throw error;
  }
}

export async function updateAcademicYear(
  id: string,
  input: AcademicYearInput,
  actor: Actor,
  executor: Executor = db,
): Promise<ServiceResult> {
  if (!isUuid(id)) return fail(NOT_FOUND);
  try {
    return await executor.transaction(async (tx) => {
      const [current] = await tx
        .select({ name: academicYears.name, startDate: academicYears.startDate, endDate: academicYears.endDate })
        .from(academicYears)
        .where(eq(academicYears.id, id))
        .for('update');
      if (!current) return fail(NOT_FOUND);

      const after = { name: input.name, startDate: input.startDate, endDate: input.endDate };
      await tx.update(academicYears).set(after).where(eq(academicYears.id, id));

      await writeAudit(tx, {
        actorId: actor.id,
        action: 'academic_year.update',
        entity: 'academic_years',
        entityId: id,
        metadata: { before: current, after },
      });
      return ok(id);
    });
  } catch (error) {
    const known = knownViolation(error, input.name);
    if (known) return known;
    throw error;
  }
}

export async function activateAcademicYear(id: string, actor: Actor, executor: Executor = db): Promise<ServiceResult> {
  if (!isUuid(id)) return fail(NOT_FOUND);
  try {
    return await executor.transaction(async (tx) => {
      // Keputusan "sudah aktif atau belum" wajib diambil dari baris yang
      // sudah terkunci, bukan dari select tanpa kunci sebelumnya. Tanpa ini,
      // dua permintaan mengaktifkan tahun yang sama (dua admin, atau
      // klik ganda) sama-sama lolos pemeriksaan "belum aktif", lalu yang
      // kedua — begitu mendapat kunci tabel — menjalankan flip kosong dan
      // menulis audit `academic_year.activate` kedua dengan `previous: null`,
      // padahal tidak ada perubahan nyata.
      const rows = await lockAcademicYears(tx);
      const target = rows.find((row) => row.id === id);
      if (!target) return fail(NOT_FOUND);
      if (target.isActive) return ok(id);

      const previous = await flipActive(tx, rows, id);
      await writeAudit(tx, {
        actorId: actor.id,
        action: 'academic_year.activate',
        entity: 'academic_years',
        entityId: id,
        metadata: { name: target.name, previous },
      });
      return ok(id);
    });
  } catch (error) {
    if (uniqueViolation(error) === 'one_active_academic_year') return fail(ACTIVE_RACE);
    throw error;
  }
}
