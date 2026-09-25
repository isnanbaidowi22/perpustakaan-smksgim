import { config } from 'dotenv';

// Dijalankan Vitest sebelum setiap berkas uji integrasi mengimpor apa pun,
// sehingga `src/server/db/client.ts` sudah melihat DATABASE_URL.
config({ path: '.env.local', quiet: true });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL belum diatur di .env.local; uji integrasi tidak dapat berjalan.');
}
