import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Next.js 16 mengganti nama konvensi `middleware.js` menjadi `proxy.js`
 * (deprecated: lihat node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
 * Fungsinya tetap sama.
 *
 * Berkas ini tetap diperlukan meski dokumentasi menyarankan menghindari Proxy
 * bila memungkinkan: Server Component tidak bisa menulis cookie, jadi tanpa
 * lapisan ini petugas akan terlempar ke layar masuk di tengah jam kerja
 * ketika token sesinya kedaluwarsa.
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Memanggil getUser() menyegarkan token yang hampir kedaluwarsa
  // dan menuliskan cookie barunya ke response.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|woff2)$).*)'],
};
