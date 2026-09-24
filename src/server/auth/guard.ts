import { redirect } from 'next/navigation';
import type { UserRole } from '@/domain/shared/types';
import { getCurrentProfile, type Profile } from './session';

export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  return profile;
}

/**
 * Dipanggil di awal setiap Server Action yang mengubah data.
 * Otorisasi ditegakkan di server, bukan dengan menyembunyikan tombol.
 */
export async function requireRole(roles: UserRole[]): Promise<Profile> {
  const profile = await requireProfile();
  if (!roles.includes(profile.role as UserRole)) {
    throw new Error(
      `Akses ditolak. Aksi ini hanya untuk peran: ${roles.join(', ')}. ` +
      `Akun Anda berperan ${profile.role}.`,
    );
  }
  return profile;
}
