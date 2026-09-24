import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/server/db/client';

export type Profile = typeof schema.profiles.$inferSelect;

// `cookies()` bersifat asinkron di Next.js 16 — harus di-`await` di sini
// dan oleh setiap pemanggil fungsi ini.
export async function createSupabaseServerClient() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            // Dipanggil dari Server Component; proxy yang menyegarkan sesi.
          }
        },
      },
    },
  );
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  const [profile] = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.id, data.user.id))
    .limit(1);

  // Akun yang dinonaktifkan tidak boleh lolos hanya karena sesinya masih hidup.
  if (!profile || profile.status !== 'active') return null;
  return profile;
}
