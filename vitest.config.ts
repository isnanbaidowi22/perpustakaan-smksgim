import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import { VitestReporter } from 'tdd-guard-vitest';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    // Menulis hasil tes ke .claude/tdd-guard/data agar hook tdd-guard
    // menilai perubahan dari hasil tes sungguhan, bukan dari diff mentah.
    reporters: ['default', new VitestReporter({ projectRoot: resolve(__dirname) })],
  },
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
});
