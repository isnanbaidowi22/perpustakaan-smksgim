import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: [
            '@/server/*', '@/app/*', '@/components/*',
            'drizzle-orm', 'drizzle-orm/*',
            '@supabase/*', 'postgres', 'next/*',
          ],
          message:
            'Lapisan domain harus murni. Dilarang mengimpor database, jaringan, ' +
            'atau UI — itulah yang membuat aturan bisnis dapat diuji tanpa infrastruktur.',
        }],
      }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
