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
 */
const client = postgres(url, { prepare: false });

export const db = drizzle(client, { schema });
export { schema };
