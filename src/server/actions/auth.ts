'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/server/auth/session';
import { usernameToEmail } from '@/server/auth/username';
import { getUser } from '@/server/queries/users';

export async function signIn(_prev: unknown, formData: FormData) {
  const username = String(formData.get('username') ?? '');
  const password = String(formData.get('password') ?? '');

  let email: string;
  try {
    email = usernameToEmail(username);
  } catch (error) {
    return { error: (error as Error).message };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    // Pesan sengaja tidak membedakan username salah dari kata sandi salah,
    // agar tidak membocorkan username mana yang terdaftar.
    return { error: 'Username atau kata sandi salah.' };
  }

  // Kata sandinya benar, jadi aman menjelaskan alasannya. Tanpa pemeriksaan
  // ini, akun nonaktif hanya terlempar kembali ke layar masuk tanpa
  // penjelasan, karena setiap halaman menolak profil nonaktif.
  const account = await getUser(data.user.id);
  if (!account || account.status !== 'active') {
    await supabase.auth.signOut();
    return {
      error: account
        ? 'Akun ini dinonaktifkan. Hubungi admin perpustakaan untuk mengaktifkannya kembali.'
        : 'Akun ini belum terdaftar sebagai pengguna perpustakaan. Hubungi admin perpustakaan.',
    };
  }

  redirect('/dashboard');
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}
