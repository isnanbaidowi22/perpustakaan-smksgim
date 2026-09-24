'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/server/auth/session';
import { usernameToEmail } from '@/server/auth/username';

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
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Pesan sengaja tidak membedakan username salah dari kata sandi salah,
    // agar tidak membocorkan username mana yang terdaftar.
    return { error: 'Username atau kata sandi salah.' };
  }

  redirect('/dashboard');
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}
