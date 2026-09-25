import { requireProfile } from '@/server/auth/guard';

/**
 * Kerangka halaman cetak: tanpa sidebar dan topbar, sehingga yang tercetak
 * hanya isi cetakannya. Setiap halaman tetap memanggil `requireProfile()`
 * sendiri; layout bukan batas keamanan (spec §7).
 */
export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  await requireProfile();
  return <div className="min-h-screen bg-white text-black">{children}</div>;
}
