import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// `seed.ts` menjalankan `seed().catch(...)` di level modul dan memanggil
// `process.exit()` — mengimpornya langsung di sini akan menjalankan skrip
// sungguhan (dan mematikan proses uji). Pengujian ini memeriksa sumbernya
// sebagai teks, bukan mengimpor modulnya, agar tetap aman.
describe('seed script', () => {
  it('memanggil seedUsers() sebelum selesai mengisi data awal', () => {
    const source = readFileSync(new URL('./seed.ts', import.meta.url), 'utf-8');
    expect(source).toContain('await seedUsers();');
  });

  it('seedUsers membuat akun admin lewat Supabase Admin API', () => {
    const source = readFileSync(new URL('./seed.ts', import.meta.url), 'utf-8');
    expect(source).toContain('admin.auth.admin.createUser');
    expect(source).not.toContain("role: 'petugas'");
  });
});
