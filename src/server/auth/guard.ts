import { redirect } from 'next/navigation';
import type { Actor, UserRole } from '@/domain/shared/types';
import { getCurrentProfile, type Profile } from './session';

export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  return profile;
}

function deniedMessage(roles: UserRole[], role: UserRole): string {
  return `Akses ditolak. Aksi ini hanya untuk peran: ${roles.join(', ')}. Akun Anda berperan ${role}.`;
}

/**
 * Dipanggil di awal setiap Server Action yang mengubah data.
 * Otorisasi ditegakkan di server, bukan dengan menyembunyikan tombol.
 */
export async function requireRole(roles: UserRole[]): Promise<Profile> {
  const profile = await requireProfile();
  if (!roles.includes(profile.role)) {
    throw new Error(deniedMessage(roles, profile.role));
  }
  return profile;
}

export type Authorization =
  | { ok: true; actor: Actor }
  | { ok: false; message: string };

/**
 * Seperti requireRole, tetapi mengembalikan hasil alih-alih melempar galat.
 * Next.js menyamarkan galat yang dilempar Server Action di produksi menjadi
 * pesan generik; hasil yang dikembalikan tetap terbaca utuh oleh petugas.
 */
export async function authorize(roles: UserRole[]): Promise<Authorization> {
  const profile = await requireProfile();
  if (!roles.includes(profile.role)) {
    return { ok: false, message: deniedMessage(roles, profile.role) };
  }
  return { ok: true, actor: { id: profile.id, role: profile.role } };
}
