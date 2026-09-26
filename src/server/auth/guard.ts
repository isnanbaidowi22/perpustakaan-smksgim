import { redirect } from 'next/navigation';
import type { Actor } from '@/domain/shared/types';
import { getCurrentProfile, type Profile } from './session';

export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  return profile;
}

/**
 * Pelaku Server Action: pengguna yang sedang masuk. Sejak revisi satu peran
 * (26 September 2026) setiap akun aktif boleh menjalankan setiap aksi, jadi
 * yang diperiksa hanya sesinya. Dipanggil sebelum isian form dibaca sama
 * sekali; tanpa sesi, `requireProfile()` mengalihkan ke /login.
 */
export async function requireActor(): Promise<Actor> {
  const profile = await requireProfile();
  return { id: profile.id, role: profile.role };
}
