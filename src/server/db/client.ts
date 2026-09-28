import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL belum diatur. Salin .env.example menjadi .env.local.');
}

/**
 * `prepare: false` WAJIB. Produksi terhubung melalui Supavisor dalam mode
 * transaksi, yang tidak mendukung prepared statement. Tanpa flag ini,
 * kueri gagal di produksi walau lolos di lokal.
 *
 * `idle_timeout` menutup koneksi yang menganggur 20 detik. Koneksi ke pooler
 * yang lama menganggur dapat putus diam-diam (tetap tampak terbuka), dan
 * kueri yang memakainya menggantung tanpa batas; pada 28 September 2026 hal
 * ini membuat seluruh halaman server dev macet sampai prosesnya dimulai ulang.
 */
const client = postgres(url, { prepare: false, idle_timeout: 20 });

export const db = drizzle(client, { schema });
export { schema };
