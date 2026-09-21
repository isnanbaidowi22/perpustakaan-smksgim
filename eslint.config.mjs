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
            // Alias form: matches the resolved-looking specifier directly.
            '@/server/*', '@/app/*', '@/components/*',
            // Relative form: '**' crosses path segments (including '..'),
            // so this catches the same directories reached by a relative
            // import (e.g. '../../server/db/client') that the alias-only
            // patterns above would silently miss.
            '**/server/*', '**/app/*', '**/components/*',
            // Bare specifier and subpath both listed, since a pattern
            // covering only one form leaves the other unenforced.
            'drizzle-orm', 'drizzle-orm/*',
            '@supabase/*', 'postgres', 'next', 'next/*',
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
