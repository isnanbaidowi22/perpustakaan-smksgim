import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

/**
 * Konfigurasi terpisah, bukan mergeConfig dari vitest.config.ts:
 * mergeConfig menggabungkan array `include`, sehingga uji unit ikut berjalan.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    setupFiles: ['tests/integration/load-env.ts'],
    // Satu berkas pada satu waktu: seluruh berkas berbagi satu database cloud.
    fileParallelism: false,
    // Setiap kueri menempuh perjalanan pulang-pergi ke Singapura.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
});
