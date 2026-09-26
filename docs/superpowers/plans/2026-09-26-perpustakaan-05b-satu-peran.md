# Perpustakaan — Rencana 05b: Satu Peran (Admin)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplikasi hanya mengenal satu peran, `admin`. Setiap akun aktif dapat membuka seluruh menu dan menjalankan seluruh aksi, dan konsep "petugas" hilang dari kode, database, dan spec.

**Architecture:**
- Pembeda peran saat ini tertanam di empat tempat. Keempatnya dibongkar berurutan agar setiap task tetap terkompilasi dan teruji:
  - form dan service pengguna;
  - pembatasan di layar (panel "Akses ditolak", menu Pengaturan khusus admin, tombol status eksemplar khusus admin);
  - pengaman Server Action (`authorize(roles)`);
  - tipe `UserRole` beserta constraint database.
- Pengaman server tetap memastikan pengguna sudah masuk sebelum membaca isian apa pun, lewat `requireActor()` yang menggantikan `authorize(roles)`.
- Kolom `profiles.role` dipertahankan, dengan satu nilai sah (`admin`), agar perubahan database sekecil mungkin.

**Tech Stack:** Next.js 16 · React 19 · TypeScript strict · Drizzle ORM 0.45 + drizzle-kit 0.31 · Supabase Postgres · zod 4 · Vitest 5

**Spec:** `docs/superpowers/specs/2026-09-21-sistem-peminjaman-perpustakaan-design.md` — §1.1 (baris Peran), §1.2, §7. Task 3 merevisi spec ini.

**Keputusan pemilik produk (26 September 2026):** "intinya saya ingin hanya ada 1 peran saja". Opsi "bersih total" dipilih: konsep petugas dibuang dari kode, database, dan spec. Opsi ringan (menyembunyikan pilihan peran saja) tidak dipakai.

**Konsekuensi yang sudah disampaikan ke pemilik produk:** setiap akun dapat mengubah konfigurasi denda dan aturan pinjam, mengelola akun lain, memulihkan eksemplar rusak/hilang, dan membuka audit log. Audit log tetap mencatat siapa melakukan apa per akun.

## Global Constraints

- **Versi terpasang:** `next@16.3.5`, `react@19.2.8`, `drizzle-orm@0.45.3`, `drizzle-kit@0.31.x`, `vitest@5.0.1`, `zod@4.6.5`. **Tidak ada dependensi baru.**
- **Lingkungan Windows:** Node berada di `D:\nvm\nodejs` dan tidak ada di PATH. Awali perintah `npm`/`npx` dengan `export PATH="/d/nvm/nodejs:$PATH";`.
- **TypeScript mode `strict`.** `any` dilarang.
- **DATABASE_URL menunjuk ke database Supabase cloud berisi data sungguhan.**
  - Uji integrasi hanya di dalam `withRollback()`.
  - Migrasi database **hanya** diterapkan di Task 4, setelah pemilik produk menyetujuinya secara eksplisit.
  - Task 1–3 hanya membuat berkas migrasi, tidak menerapkannya.
- **Server Action tetap memeriksa sesi sebelum membaca isian apa pun** (spec §7: setiap halaman dan Server Action memeriksa sesinya sendiri). Yang hilang hanya pembeda peran, bukan pemeriksaan masuk.
- **Setiap halaman tetap memanggil `requireProfile()` sendiri.** Layout bukan batas keamanan.
- **Seluruh teks antarmuka berbahasa Indonesia.** Kata "petugas" boleh tetap dipakai dalam arti umum ("petugas perpustakaan", "Selamat bertugas") tetapi tidak lagi sebagai nama peran.
- **Repo ini memasang hook tdd-guard.** Urutan uji gagal → implementasi → uji lulus wajib diikuti. Menghapus uji untuk perilaku yang memang dihapus (penolakan petugas) adalah bagian dari perubahan perilaku itu.
- **Setiap commit diakhiri baris** `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, ditulis lewat heredoc bash (`git commit -F - <<'EOF'`).

## Review Focus

1. **Akun `petugas` yang sudah ada.** Setelah migrasi (Task 4), akun itu masuk seperti biasa dan melihat seluruh menu. Migrasi tidak boleh gagal karena baris ber-`role = 'petugas'` masih ada, sehingga data diubah **sebelum** constraint baru dipasang. (Task 3: isi berkas migrasi; Task 4: verifikasi di database.)
2. **Halaman yang masih terbuka di peramban lama** mengirim `role=petugas` di form pengguna. Isian tak dikenal diabaikan, dan akun tetap tersimpan sebagai admin. (Task 1: uji `newUserSchema`/`userSchema` membuang kolom `role`.)
3. **Pengunjung tanpa sesi** memanggil Server Action langsung. Ia tetap dialihkan ke `/login` tanpa isian dibaca atau service dipanggil. (Task 3: uji `runFormAction`/`runCommand` saat `requireActor` melempar redirect.)
4. **Catatan audit lama** berisi `role: 'petugas'` (misalnya `user.create` untuk `qa_petugas`). Audit log tetap menampilkannya tanpa galat. (Task 3: uji `summarizeAudit` yang sudah ada tetap lulus apa adanya.)
5. **Admin yang menonaktifkan akunnya sendiri** tetap ditolak. Tanpa itu, perpustakaan dengan satu akun dapat terkunci sepenuhnya. (Task 1: uji integrasi yang sudah ada dipertahankan.)

---

## Struktur Berkas

| Berkas | Perubahan |
|---|---|
| `src/server/validation/user.ts`, `src/server/services/users.ts` | Tanpa kolom peran; akun baru selalu `admin` |
| `src/app/(app)/pengaturan/pengguna/**` | Form dan daftar pengguna tanpa peran |
| 8 halaman Pengaturan + audit log | Tanpa cabang `<AccessDenied />` |
| `src/components/ui/access-denied.tsx` (+ uji) | Dihapus |
| `src/components/layout/sidebar.tsx`, `src/app/(app)/layout.tsx` | Tanpa penyaring peran |
| `src/app/(app)/master/buku/[id]/{page,copies-section}.tsx` | Aksi status eksemplar untuk semua akun |
| `src/server/auth/guard.ts` | `requireActor()` menggantikan `authorize(roles)` dan `requireRole(roles)` |
| `src/server/forms/run-action.ts`, `src/server/actions/*.ts` | Tanpa opsi `roles` |
| `src/domain/shared/types.ts` | `UserRole = 'admin'` |
| `src/server/db/schema.ts`, `drizzle/0002_satu_peran.sql` | Constraint `role = 'admin'`, bawaan `'admin'`, konversi data |
| `src/server/db/seed.ts` | Hanya akun `admin` |
| Spec §1.1, §1.2, §7 | Revisi satu peran |

---

## Task 1: Pengguna Tanpa Pilihan Peran

**Files:**
- Modify: `src/server/validation/user.ts`, `src/server/validation/user.test.ts`
- Modify: `src/server/services/users.ts`, `tests/integration/users.test.ts`
- Modify: `src/server/actions/users.test.ts` (isian form tanpa `role`)
- Modify: `src/app/(app)/pengaturan/pengguna/user-fields.tsx`
- Modify: `src/app/(app)/pengaturan/pengguna/page.tsx`, `page.test.tsx`
- Modify: `src/app/(app)/pengaturan/pengguna/baru/page.test.tsx`
- Modify: `src/app/(app)/pengaturan/pengguna/[id]/page.tsx`, `page.test.tsx`

**Interfaces:**
- Produces:
  - `newUserSchema` → `{ username, fullName, password, passwordConfirm? }` (tanpa `role`)
  - `userSchema` → `{ fullName }`
  - `createUser` selalu menyimpan `role: 'admin'`; `updateUser` hanya mengubah `fullName`
  - `ProfileFields({ user? })` hanya berisi nama lengkap (prop `isSelf` dihapus)

- [ ] **Step 1: Tulis uji validasi yang gagal**

Di `src/server/validation/user.test.ts`, lakukan tiga perubahan:
- Ganti uji `'menolak username terlalu pendek dan peran yang tidak dikenal'`: hapus bagian yang mengharapkan pesan "Peran harus admin atau petugas.", dan pertahankan bagian username terlalu pendek.
- Ganti uji `'hanya menerima nama lengkap dan peran'` dengan uji di bawah.
- Hapus `role` dari setiap objek masukan valid lain di berkas itu.

```ts
  it('hanya menerima nama lengkap; kolom peran dari form lama diabaikan', () => {
    expect(userSchema.parse({ fullName: '  Siti Aminah ', role: 'petugas' })).toEqual({ fullName: 'Siti Aminah' });
  });

  it('akun baru tidak membawa kolom peran walau form lama mengirimnya', () => {
    const parsed = newUserSchema.parse({
      username: 'siti.aminah', fullName: 'Siti Aminah', role: 'petugas', password: 'rahasia123', passwordConfirm: 'rahasia123',
    });
    expect(parsed).not.toHaveProperty('role');
  });
```

- [ ] **Step 2: Jalankan uji dan pastikan gagal**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test -- src/server/validation/user.test.ts
```

Harapan: FAIL. `userSchema` masih mewajibkan dan mengembalikan `role`.

- [ ] **Step 3: Hapus peran dari skema**

Di `src/server/validation/user.ts`:
- hapus baris `const role = z.enum(['admin', 'petugas'], 'Peran harus admin atau petugas.');`;
- hapus `role,` dari `newUserSchema`;
- ubah `userSchema` menjadi:

```ts
/** Username tidak dapat diubah: ia menjadi surel internal akun Supabase. Sejak revisi satu peran, hanya nama yang dapat diubah. */
export const userSchema = z.object({ fullName });
```

- [ ] **Step 4: Jalankan uji dan pastikan lulus**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test -- src/server/validation/user.test.ts
```

Harapan: PASS. `npx tsc --noEmit` kini melaporkan galat di `services/users.ts`, karena `input.role` tidak ada lagi. Itu diselesaikan di Step 5–7.

- [ ] **Step 5: Tulis uji integrasi service pengguna yang gagal**

Di `tests/integration/users.test.ts`:
- Hapus `role` dari setiap masukan `createUser(...)`/`updateUser(...)`.
- Hapus uji `'menolak admin mengubah perannya sendiri, tetapi mengizinkan mengubah namanya'`.
- Ganti uji `'mengubah nama dan peran, dan mencatat nilai sebelum dan sesudah'` dengan:

```ts
  it('mengubah nama dan mencatat nilai sebelum dan sesudah', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const auth = fakeAuthAdmin(tx);
      const created = await createUser(
        { username: 'uji.nama', fullName: 'UJI Nama Lama', password: 'rahasia123', passwordConfirm: 'rahasia123' },
        actor, auth, tx,
      );
      if (!created.ok) throw new Error(JSON.stringify(created));

      expect(await updateUser(created.id, { fullName: 'UJI Nama Baru' }, actor, tx)).toEqual({ ok: true, id: created.id });

      const [row] = await tx.select({ fullName: profiles.fullName, role: profiles.role }).from(profiles).where(eq(profiles.id, created.id));
      expect(row).toEqual({ fullName: 'UJI Nama Baru', role: 'admin' });
      const [log] = await tx.select({ metadata: auditLogs.metadata }).from(auditLogs)
        .where(and(eq(auditLogs.action, 'user.update'), eq(auditLogs.entityId, created.id)));
      expect(log?.metadata).toEqual({ username: 'uji.nama', before: { fullName: 'UJI Nama Lama' }, after: { fullName: 'UJI Nama Baru' } });
    });
  });

  it('menyimpan setiap akun baru sebagai admin', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const created = await createUser(
        { username: 'uji.admin', fullName: 'UJI Admin', password: 'rahasia123', passwordConfirm: 'rahasia123' },
        actor, fakeAuthAdmin(tx), tx,
      );
      if (!created.ok) throw new Error(JSON.stringify(created));
      const [row] = await tx.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, created.id));
      expect(row?.role).toBe('admin');
    });
  });
```

Sesuaikan impor (`and`, `eq`, `auditLogs`, `profiles`) dengan yang sudah ada di berkas. Pertahankan uji `'menolak admin menonaktifkan akunnya sendiri'` apa adanya (Review Focus 5).

- [ ] **Step 6: Jalankan uji dan pastikan gagal**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm run test:integration -- tests/integration/users.test.ts
```

Harapan: FAIL. Service masih membaca `input.role` dan menulis `role` di metadata audit.

- [ ] **Step 7: Sederhanakan service pengguna**

Di `src/server/services/users.ts`:
- hapus konstanta `SELF_ROLE`;
- di `createUser`, ganti pembentukan profil menjadi:

```ts
  // Satu peran sejak revisi 26 September 2026: setiap akun adalah admin.
  const profile = { username: input.username, fullName: input.fullName, role: 'admin' as const };
```

Di `updateUser`, ganti isi transaksi mulai dari `const [current]` sampai sebelum `return ok(id);` dengan:

```ts
    const [current] = await tx
      .select({ username: profiles.username, fullName: profiles.fullName })
      .from(profiles)
      .where(eq(profiles.id, id))
      .for('update');
    if (!current) return fail(NOT_FOUND);

    const after = { fullName: input.fullName };
    await tx.update(profiles).set({ ...after, updatedAt: new Date() }).where(eq(profiles.id, id));

    await writeAudit(tx, {
      actorId: actor.id,
      action: 'user.update',
      entity: 'profiles',
      entityId: id,
      metadata: { username: current.username, before: { fullName: current.fullName }, after },
    });
```

- [ ] **Step 8: Jalankan uji dan pastikan lulus**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm run test:integration -- tests/integration/users.test.ts
```

Harapan: PASS.

- [ ] **Step 9: Tulis uji halaman pengguna yang gagal**

Ubah ketiga berkas uji halaman berikut. Pertahankan uji "Akses ditolak" di ketiganya untuk saat ini; uji itu dihapus di Task 2.
- **`src/app/(app)/pengaturan/pengguna/page.test.tsx`**, uji `'menampilkan peran dan tidak menawarkan menonaktifkan akun sendiri'`:
  - ganti namanya menjadi `'tidak menampilkan kolom peran dan tidak menawarkan menonaktifkan akun sendiri'`;
  - ganti harapan tentang teks peran ("Admin"/"Petugas" di kolom Peran) menjadi `expect(html).not.toContain('>Peran<')`.
- **`src/app/(app)/pengaturan/pengguna/baru/page.test.tsx`**, uji `'menampilkan kolom akun baru dengan peran petugas terpilih'`:
  - ganti namanya menjadi `'menampilkan kolom akun baru tanpa pilihan peran'`;
  - harapannya `expect(html).not.toContain('name="role"')`, dan tetap memeriksa kolom username, nama lengkap, dan kata sandi.
- **`src/app/(app)/pengaturan/pengguna/[id]/page.test.tsx`**:
  - hapus uji `'memberi tahu admin bahwa perannya sendiri tidak dapat diubah'`;
  - di uji `'mengisi nama dan peran, …'`, ganti namanya menjadi `'mengisi nama, dan menyediakan form kata sandi terpisah yang kosong'`, lalu ganti harapan peran menjadi `expect(html).not.toContain('name="role"')`.

- [ ] **Step 10: Jalankan uji dan pastikan gagal**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test -- pengaturan/pengguna
```

Harapan: FAIL. Form masih menampilkan `name="role"`, dan daftar masih punya kolom Peran.

- [ ] **Step 11: Hapus peran dari form dan daftar pengguna**

Ganti `ProfileFields` di `src/app/(app)/pengaturan/pengguna/user-fields.tsx`, dan hapus `ROLE_LABELS`, `ROLE_OPTIONS`, serta impor `SelectField`, `UserRole`, `Option` yang tak terpakai:

```tsx
/** Nama lengkap, dipakai bersama halaman tambah dan ubah pengguna. Setiap akun adalah admin. */
export function ProfileFields({ user }: { user?: User }) {
  return <TextField name="fullName" label="Nama lengkap" defaultValue={user?.fullName} required maxLength={100} />;
}
```

Di `src/app/(app)/pengaturan/pengguna/[id]/page.tsx`, ganti `<ProfileFields user={user} isSelf={user.id === profile.id} />` dengan `<ProfileFields user={user} />`.

Di `src/app/(app)/pengaturan/pengguna/page.tsx`:
- hapus impor `ROLE_LABELS`;
- hapus `<th className={TH}>Peran</th>` dan `<td className={TD}>{ROLE_LABELS[user.role]}</td>`;
- ubah deskripsi `PageHeader` menjadi `"Akun yang dapat masuk ke aplikasi. Setiap akun dapat mengelola seluruh data dan pengaturan. Username tidak dapat diubah setelah dibuat."`.

Di `src/server/actions/users.test.ts`, hapus `role` dari setiap isian `FormData` dan dari harapan data yang diteruskan ke service.

- [ ] **Step 12: Jalankan pemeriksaan lalu commit**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test && npm run test:integration -- tests/integration/users.test.ts && npm run lint && npx tsc --noEmit
```

Harapan: seluruhnya lulus.

```bash
git add src/server/validation/user.ts src/server/validation/user.test.ts src/server/services/users.ts \
  tests/integration/users.test.ts src/server/actions/users.test.ts "src/app/(app)/pengaturan/pengguna"
git commit -F - <<'EOF'
refactor(pengguna): akun tanpa pilihan peran, setiap akun baru adalah admin

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

## Task 2: Layar Tanpa Pembatasan Peran

**Files:**
- Modify (hapus cabang `AccessDenied`): `src/app/(app)/pengaturan/audit-log/page.tsx`, `konfigurasi/page.tsx`, `pengguna/page.tsx`, `pengguna/baru/page.tsx`, `pengguna/[id]/page.tsx`, `tahun-ajaran/page.tsx`, `tahun-ajaran/baru/page.tsx`, `tahun-ajaran/[id]/page.tsx`, serta `page.test.tsx` masing-masing
- Delete: `src/components/ui/access-denied.tsx`, `src/components/ui/access-denied.test.tsx`
- Modify: `src/components/layout/sidebar.tsx`, `sidebar.test.tsx`
- Modify: `src/app/(app)/layout.tsx`, `layout.test.tsx`
- Modify: `src/app/(app)/master/buku/[id]/page.tsx`, `page.test.tsx`, `copies-section.tsx`, `copies-section.test.tsx`

**Interfaces:**
- Produces: `Sidebar()` tanpa prop; `CopiesSection({ bookId, bookActive, copies })` tanpa `canManageStatus`

- [ ] **Step 1: Ubah uji layar agar menggambarkan satu peran (gagal)**

1. **Uji "Akses ditolak" per halaman.** Hapus uji-uji berikut:
   - `audit-log/page.test.tsx`: `'menolak petugas tanpa membaca audit log'`
   - `konfigurasi/page.test.tsx`: `'menampilkan Akses ditolak untuk petugas tanpa membaca konfigurasi'`
   - `pengguna/baru/page.test.tsx`: `'menampilkan Akses ditolak untuk petugas'`
   - `pengguna/page.test.tsx`: `'menampilkan Akses ditolak untuk petugas tanpa membaca data'`
   - `pengguna/[id]/page.test.tsx`: `'menampilkan Akses ditolak untuk petugas tanpa membaca data'`
   - `tahun-ajaran/baru/page.test.tsx`: `'menampilkan Akses ditolak untuk petugas'`
   - `tahun-ajaran/page.test.tsx`: `'menampilkan Akses ditolak untuk petugas tanpa membaca data'`
   - `tahun-ajaran/[id]/page.test.tsx`: `'menampilkan Akses ditolak untuk petugas tanpa membaca data'`

   Perilaku itu dihapus. Hapus juga `src/components/ui/access-denied.test.tsx`.
2. **`sidebar.test.tsx`.** Hapus uji `'menyembunyikan grup Pengaturan dari petugas'`. Ganti uji admin menjadi:

```tsx
  it('menampilkan seluruh menu, termasuk Pengaturan, untuk setiap akun', () => {
    const html = renderToStaticMarkup(<Sidebar />);
    for (const href of [...COMMON, ...ADMIN_ONLY]) {
      expect(html).toContain(`href="${href}"`);
    }
    expect(html).toContain('Pengaturan');
  });
```

3. **`layout.test.tsx`.** Ganti uji `'meneruskan peran ke sidebar sehingga petugas tidak melihat Pengaturan'` dengan:

```tsx
  it('menampilkan menu Pengaturan untuk setiap akun yang masuk', async () => {
    mockRequireProfile.mockResolvedValueOnce({ fullName: 'Siti Aminah', role: 'admin' });
    mockLimit.mockResolvedValueOnce([{ name: '2026/2027' }]);

    const html = renderToStaticMarkup(await AppLayout({ children: <div>isi</div> }));

    expect(html).toContain('href="/pengaturan/pengguna"');
    expect(html).toContain('href="/pengaturan/audit-log"');
  });
```

4. **`copies-section.test.tsx`.** Hapus uji `'menyembunyikan aksi status dari petugas'`. Hapus prop `canManageStatus` dari render di uji yang tersisa, dan ubah nama uji pertama menjadi `'menampilkan eksemplar, ringkasan ketersediaan, dan aksi status'`.
5. **`master/buku/[id]/page.test.tsx`.** Ganti uji `'menampilkan eksemplar, dengan aksi status hanya untuk admin'` menjadi `'menampilkan eksemplar beserta aksi statusnya'`. Uji itu merender satu kali dengan profil ber-`role: 'admin'` dan menegaskan tombol aksi status (misalnya "Nonaktifkan") tampil. Hapus bagian yang merender sebagai petugas dan menegaskan tombolnya hilang.

- [ ] **Step 2: Jalankan uji dan pastikan gagal**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test -- src/components/layout "src/app/(app)/layout" copies-section
```

Harapan: FAIL. `Sidebar` masih mewajibkan prop `role`, dan `CopiesSection` masih mewajibkan `canManageStatus`.

- [ ] **Step 3: Hapus pembatasan di layar**

1. **Delapan halaman.** Di tiap halaman, hapus impor `AccessDenied` dan baris `if (profile.role !== 'admin') return <AccessDenied />;`. Bila `profile` tidak dipakai lagi, ganti `const profile = await requireProfile();` menjadi `await requireProfile();`. Halaman `pengguna/page.tsx` dan `pengguna/[id]/page.tsx` masih memakai `profile.id`, jadi biarkan variabelnya di sana.
2. **Hapus komponen.** Hapus `src/components/ui/access-denied.tsx`.
3. **`src/components/layout/sidebar.tsx`.** Hapus properti `roles` dari antarmuka `NavSection` dan dari grup Pengaturan, hapus impor `UserRole`, lalu ubah komponennya:

```tsx
export function Sidebar() {
  return (
    <nav
      aria-label="Menu utama"
      className="h-full w-60 overflow-y-auto border-r border-[var(--color-ink-100)] bg-white px-3 py-5"
    >
      <div className="px-3 pb-6 text-lg font-semibold">Perpustakaan</div>
      {NAV.map((section) => (
```

   Isi render berikutnya tidak berubah, kecuali `sections.map` menjadi `NAV.map`.
4. **`src/app/(app)/layout.tsx`.** Ganti `sidebar={<Sidebar role={profile.role} />}` dengan `sidebar={<Sidebar />}`.
5. **`copies-section.tsx`.** Hapus prop `canManageStatus` beserta komentarnya, lalu ganti `{canManageStatus && (` … `)}` dengan isinya langsung:

```tsx
              <td className={TD}>
                <div className="flex items-start justify-end gap-2">
                  {availableManualActions(copy.status).map((action) => (
                    <ActionButton
                      key={action}
                      action={changeCopyStatusAction.bind(null, bookId, copy.id, action)}
                      label={MANUAL_ACTION_LABELS[action]}
                      confirmText={`${MANUAL_ACTION_LABELS[action]}: eksemplar ${copy.barcode}?`}
                      variant={action === 'DEACTIVATE' ? 'danger' : 'secondary'}
                    />
                  ))}
                </div>
              </td>
```

6. **`master/buku/[id]/page.tsx`.** Hapus `canManageStatus={profile.role === 'admin'}`. Bila `profile` tidak dipakai lagi, panggil `requireProfile()` tanpa menyimpan hasilnya: `const [book] = await Promise.all([getBook(id), requireProfile()]);`.

- [ ] **Step 4: Jalankan uji dan pastikan lulus**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test && npm run lint && npx tsc --noEmit
```

Harapan: PASS. `grep -rn "AccessDenied\|canManageStatus" src` tidak menemukan apa pun.

- [ ] **Step 5: Commit**

```bash
git add -A src/app src/components
git commit -F - <<'EOF'
refactor(akses): setiap akun melihat seluruh menu dan aksi, tanpa panel Akses ditolak

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

## Task 3: Pengaman Server, Tipe, Database, dan Spec Satu Peran

**Files:**
- Modify: `src/server/auth/guard.ts`, `guard.test.ts`
- Modify: `src/server/forms/run-action.ts`, `run-action.test.ts`
- Modify: `src/server/actions/{academic-years,books,categories,copies,fines,loans,racks,returns,settings,students,users}.ts` beserta `*.test.ts`
- Modify: `src/domain/shared/types.ts`
- Modify: `src/server/db/schema.ts`, `src/server/db/seed.ts`, `src/server/db/seed.test.ts`
- Create: `drizzle/0002_satu_peran.sql` (lewat `drizzle-kit generate`, lalu disunting), plus snapshot/journal yang dibuat drizzle-kit
- Modify: seluruh berkas uji yang masih memakai `role: 'petugas'` (daftar di Step 9)
- Modify: `docs/superpowers/specs/2026-09-21-sistem-peminjaman-perpustakaan-design.md`

**Interfaces:**
- Produces:
  - `requireActor(): Promise<Actor>` di `src/server/auth/guard.ts`, yang menggantikan `authorize(roles)` dan `requireRole(roles)`. Tipe `Authorization` dihapus. `requireProfile()` tetap ada.
  - `runFormAction`/`runCommand` tanpa opsi `roles`
  - `type UserRole = 'admin'`
  - Constraint `profiles_role_valid`: `role = 'admin'`, bawaan kolom `'admin'`

- [ ] **Step 1: Tulis uji pengaman yang gagal**

Ganti isi `describe('requireRole')` dan `describe('authorize')` di `src/server/auth/guard.test.ts` dengan satu blok baru, dan ubah impornya menjadi `import { requireActor, requireProfile } from './guard';`:

```ts
describe('requireActor', () => {
  it('mengembalikan pelaku dari profil yang masuk', async () => {
    mockGetCurrentProfile.mockResolvedValueOnce({ id: 'u1', role: 'admin', status: 'active' });
    await expect(requireActor()).resolves.toEqual({ id: 'u1', role: 'admin' });
  });

  it('mengarahkan ke /login ketika tidak ada profil yang masuk', async () => {
    mockGetCurrentProfile.mockResolvedValueOnce(null);
    await expect(requireActor()).rejects.toThrow('NEXT_REDIRECT');
    expect(mockRedirect).toHaveBeenCalledWith('/login');
  });
});
```

Di `src/server/forms/run-action.test.ts`:
- ganti mock menjadi `vi.mock('@/server/auth/guard', () => ({ requireActor: mockRequireActor }));`;
- ganti nama `mockAuthorize` menjadi `mockRequireActor` di `vi.hoisted`;
- ubah `beforeEach` menjadi `mockRequireActor.mockResolvedValue(actor);`;
- ubah `const actor = { id: 'u1', role: 'admin' as const };`;
- hapus `roles` dari `options()`, hapus impor `UserRole`, dan hapus `roles: …` dari setiap panggilan `runCommand`.

Lalu ganti kedua uji penolakan peran:

```ts
  it('tidak membaca isian bila pengunjung belum masuk', async () => {
    mockRequireActor.mockRejectedValueOnce(new Error('NEXT_REDIRECT'));
    const execute = vi.fn();
    const formData = form({ name: 'Fiksi' });
    const get = vi.spyOn(formData, 'entries');

    await expect(runFormAction(options({ execute, formData }))).rejects.toThrow('NEXT_REDIRECT');
    expect(get).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });
```

```ts
  it('tidak memanggil service bila pengunjung belum masuk', async () => {
    mockRequireActor.mockRejectedValueOnce(new Error('NEXT_REDIRECT'));
    const execute = vi.fn();

    await expect(runCommand({ execute, successMessage: 'Selesai.', revalidate: [] })).rejects.toThrow('NEXT_REDIRECT');
    expect(execute).not.toHaveBeenCalled();
  });
```

Bila `formToObject` tidak membaca lewat `formData.entries()`, periksa implementasinya di `src/lib/form-state.ts` dan mata-matai metode yang benar-benar dipakainya. Tujuannya menegaskan bahwa isian tidak dibaca sama sekali.

- [ ] **Step 2: Jalankan uji dan pastikan gagal**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test -- src/server/auth/guard.test.ts src/server/forms/run-action.test.ts
```

Harapan: FAIL. `requireActor` belum diekspor.

- [ ] **Step 3: Ganti pengaman server**

Di `src/server/auth/guard.ts`, hapus `deniedMessage`, `requireRole`, `Authorization`, dan `authorize`, lalu tambahkan:

```ts
/**
 * Pelaku Server Action: pengguna yang sedang masuk. Sejak revisi satu peran
 * (26 September 2026) setiap akun aktif boleh menjalankan setiap aksi, jadi
 * yang diperiksa hanya sesinya. Dipanggil sebelum isian form dibaca sama
 * sekali; tanpa sesi, `requireProfile()` mengalihkan ke /login.
 */
export async function requireActor(): Promise<Actor> {
  const profile = await requireProfile();
  return { id: profile.id, role: profile.role };
}
```

Hapus impor `UserRole` bila tidak terpakai lagi.

Di `src/server/forms/run-action.ts`:
- ganti impor `authorize` dengan `requireActor`;
- hapus `roles: UserRole[];` dari kedua antarmuka opsi, dan hapus impor `UserRole`;
- ganti isi awal kedua fungsi:

```ts
export async function runFormAction<S extends z.ZodType>(options: FormActionOptions<S>): Promise<FormState> {
  const actor = await requireActor();

  const values = formToObject(options.formData);
  const echoed = withoutFields(values, options.secretFields ?? []);
  const parsed = options.schema.safeParse(values);
  if (!parsed.success) {
    return formError(options.invalidMessage, fieldErrorsOf(parsed.error), echoed);
  }

  const result = await options.execute(parsed.data, actor);
  return complete(result, options, echoed);
}

/** Untuk aksi tanpa isian form, misalnya menonaktifkan data. */
export async function runCommand(options: CommandOptions): Promise<FormState> {
  const actor = await requireActor();
  const result = await options.execute(actor);
  return complete(result, options, {});
}
```

Ubah komentar urutan baku menjadi "sesi → validasi → service → revalidasi → (pindah halaman). Sesi selalu pertama, sebelum isian form dibaca sama sekali."

- [ ] **Step 4: Jalankan uji dan pastikan lulus**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test -- src/server/auth/guard.test.ts src/server/forms/run-action.test.ts
```

Harapan: PASS.

- [ ] **Step 5: Ubah uji Server Action (gagal)**

Terapkan aturan berikut di setiap `src/server/actions/*.test.ts` yang memakai mock `authorize`:
- **Mock.** Ganti `vi.mock('@/server/auth/guard', () => ({ authorize: mockAuthorize }))` dengan `vi.mock('@/server/auth/guard', () => ({ requireActor: mockRequireActor }))`. Ganti nama variabel mock yang sesuai.
- **Nilai kembali.** Ganti `mockAuthorize.mockResolvedValue({ ok: true, actor })` dengan `mockRequireActor.mockResolvedValue(actor)`.
- **Harapan pemanggilan.** Ganti setiap `expect(mockAuthorize).toHaveBeenCalledWith([...])` dengan `expect(mockRequireActor).toHaveBeenCalled()`.
- **Uji penolakan.** Hapus setiap uji yang me-mock `{ ok: false, message: 'Akses ditolak.' }`, misalnya `loans.test.ts` `'menolak tanpa membaca data bila peran tidak diizinkan'` dan `returns.test.ts` `'menolak sebelum membaca isian bila peran tidak diizinkan'`. Gantikan masing-masing dengan satu uji yang menegaskan bahwa penolakan sesi (`mockRequireActor.mockRejectedValueOnce(new Error('NEXT_REDIRECT'))`) membuat aksi melempar redirect **tanpa** memanggil query/service-nya.
- **Nama uji.** Ubah nama uji yang menyebut "hanya untuk admin" atau "terbuka untuk admin dan petugas" menjadi uraian perilakunya tanpa menyebut peran, misalnya `'createAcademicYearAction kembali ke daftar setelah berhasil'`.
- **Aktor.** Ubah `const actor = { id: 'u1', role: 'petugas' as const }` menjadi `role: 'admin' as const`.

Jalankan `npm test -- src/server/actions`. Harapan: FAIL, karena action masih mengimpor `authorize` dan mengirim `roles`.

- [ ] **Step 6: Ubah Server Action**

Di setiap `src/server/actions/*.ts`:
- hapus konstanta `ROLES` dan impor `UserRole`;
- hapus baris `roles: ROLES,` atau `roles: [...]` dari setiap panggilan `runFormAction`/`runCommand`.

Untuk action yang memanggil pengaman langsung (`loans.ts`, `returns.ts`, dan action lain yang ditemukan lewat `grep -rn "authorize(" src/server/actions`), ganti:

```ts
  const auth = await authorize(ROLES);
  if (!auth.ok) return { ok: false, message: auth.message };
```

dengan `const actor = await requireActor();`, lalu pakai `actor` di tempat `auth.actor`. Bentuk nilai kembali penolakan untuk setiap jenis action:
- `LookupResult`: `{ ok: false, message }`
- `CreateLoanState`: `{ status: 'error', message }`
- `FormState`: `formError(...)`

Semuanya ikut dihapus, karena penolakan sesi kini berupa redirect.

Jalankan `npm test -- src/server/actions`. Harapan: PASS.

- [ ] **Step 7: Satu nilai peran di tipe, skema, dan seed**

1. **`src/domain/shared/types.ts`.**

```ts
/** Satu peran sejak revisi 26 September 2026 (spec §7): setiap akun adalah admin. */
export type UserRole = 'admin';
```

2. **`src/server/db/schema.ts`.** Pada tabel `profiles`, ubah kolom `role` menjadi `text('role').$type<UserRole>().notNull().default('admin')`, dan ubah constraint menjadi `check('profiles_role_valid', sql\`${t.role} = 'admin'\`)`.
3. **`src/server/db/seed.ts`.** Hapus akun `petugas` dari larik `accounts`, sehingga hanya `{ username: 'admin', fullName: 'Administrator', role: 'admin' as const }` yang tersisa.
4. **`src/server/db/seed.test.ts`.** Ganti nama uji kedua menjadi `'seedUsers membuat akun admin lewat Supabase Admin API'`, lalu tambahkan `expect(source).not.toContain("role: 'petugas'");`.

- [ ] **Step 8: Buat berkas migrasi (jangan diterapkan)**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npx drizzle-kit generate --name satu_peran
```

Harapan: `drizzle/0002_satu_peran.sql` dibuat, berisi penghapusan constraint lama, penambahan constraint `role = 'admin'`, dan `SET DEFAULT 'admin'`; `drizzle/meta/` ikut diperbarui. Sunting berkas SQL itu dan **sisipkan di baris paling atas**:

```sql
-- Revisi satu peran (26 September 2026): akun petugas yang ada menjadi admin
-- SEBELUM constraint baru dipasang, agar migrasi tidak gagal pada data lama.
UPDATE "profiles" SET "role" = 'admin' WHERE "role" <> 'admin';--> statement-breakpoint
```

Pastikan urutannya: `UPDATE` → `DROP CONSTRAINT` lama → `ADD CONSTRAINT` baru → `SET DEFAULT`. **Jangan** menjalankan `npm run db:migrate`; itu Task 4. Bila drizzle-kit tidak mendeteksi perubahan constraint, buat berkas kustom dengan `npx drizzle-kit generate --custom --name satu_peran` dan tulis keempat pernyataan itu sendiri:

```sql
UPDATE "profiles" SET "role" = 'admin' WHERE "role" <> 'admin';--> statement-breakpoint
ALTER TABLE "profiles" DROP CONSTRAINT "profiles_role_valid";--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_role_valid" CHECK ("profiles"."role" = 'admin');--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "role" SET DEFAULT 'admin';
```

- [ ] **Step 9: Bereskan sisa peran petugas di uji**

`npx tsc --noEmit` kini menandai setiap literal `'petugas'` yang bertipe `UserRole`. Di berkas uji berikut, ganti `role: 'petugas'` dengan `role: 'admin'`. Jangan mengubah teks lain yang mengandung kata "petugas" (nama lengkap, username `petugas`, nama uji tentang biaya yang ditimpa petugas):
- `dashboard`, `master/buku`, `master/buku/baru`, `master/buku/[id]`, `master/kategori`, `master/kategori/baru`, `master/kategori/[id]`, `master/rak`, `master/rak/baru`, `master/rak/[id]`, `master/siswa`, `master/siswa/baru`, `master/siswa/[id]`
- `pengaturan/audit-log`, `pengaturan/konfigurasi`, `pengaturan/pengguna`, `pengaturan/pengguna/baru`, `pengaturan/pengguna/[id]`, `pengaturan/tahun-ajaran`, `pengaturan/tahun-ajaran/baru`, `pengaturan/tahun-ajaran/[id]`
- `transaksi/peminjaman`, `transaksi/pengembalian`, `transaksi/riwayat`, `transaksi/riwayat/[id]`
- `(cetak)/cetak/label-barcode`, `(cetak)/cetak/struk/[id]`

Semua di atas adalah `page.test.tsx` di bawah `src/app/(app)/` atau `src/app/`.

**Pengecualian:** `src/lib/audit-labels.test.ts` baris `summarizeAudit('user.create', { … role: 'petugas' })` **tidak** diubah. Ia menguji catatan audit lama (Review Focus 4), dan nilainya bertipe `unknown`, bukan `UserRole`.

Jalankan `npx tsc --noEmit` dan `grep -rn "role: 'petugas'" src tests`. Harapan: tsc bersih; grep hanya menemukan baris audit-labels itu.

- [ ] **Step 10: Revisi spec**

Di `docs/superpowers/specs/2026-09-21-sistem-peminjaman-perpustakaan-design.md`:

1. **§1.1.** Ubah baris tabel `| Peran | `admin` dan `petugas` |` menjadi:

```markdown
| Peran | Satu peran, `admin`: setiap akun dapat melakukan seluruh aksi *(revisi 26 September 2026)* |
```

2. **§1.2.** Tambahkan paragraf di akhir:

```markdown
**Satu peran, bukan admin dan petugas (revisi 26 September 2026).** Pemilik produk menyatukan peran menjadi `admin`. Setiap akun dapat mengubah konfigurasi, mengelola pengguna, memulihkan eksemplar, dan membuka audit log. Pertanggungjawaban tetap terjaga karena audit log mencatat pelaku setiap perubahan per akun.
```

3. **§7.** Ganti tabel Aksi/Admin/Petugas dengan:

```markdown
Sejak revisi 26 September 2026 hanya ada satu peran, `admin`. Setiap akun aktif yang masuk dapat menjalankan seluruh aksi: peminjaman, pengembalian, riwayat, pengelolaan data master, pelunasan denda, pemulihan eksemplar rusak/hilang, pengelolaan pengguna, konfigurasi, tahun ajaran, dan audit log. Setiap halaman dan Server Action tetap memeriksa sesinya sendiri (`requireProfile()`/`requireActor()`).
```

Pada paragraf sebelum tabel, ganti rujukan `requireRole()` dengan `requireActor()`.

- [ ] **Step 11: Jalankan seluruh pemeriksaan lalu commit**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm test && npm run test:integration && npm run lint && npx tsc --noEmit && npm run build
```

Harapan: seluruhnya lulus. Uji integrasi tetap lulus walau migrasi belum diterapkan: kode hanya menulis `'admin'`, yang sah di bawah constraint lama maupun baru. `grep -rn "'petugas'" src --include=*.ts --include=*.tsx | grep -v test` tidak menemukan apa pun.

```bash
git add -A src drizzle docs/superpowers/specs
git commit -F - <<'EOF'
refactor(akses): satu peran admin — requireActor, tipe, constraint, seed, dan spec

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

## Task 4: Terapkan Migrasi dan Verifikasi

**Hanya dijalankan setelah pemilik produk menyetujui penerapan migrasi ke database cloud.** Migrasi mengubah akun `petugas` dan `qa_petugas` menjadi admin, lalu memasang constraint satu peran. Perubahan data ini tercatat dan tidak dibatalkan otomatis.

**Files:** tidak ada berkas kode; pencentangan rencana di Step 5.

- [ ] **Step 1: Periksa keadaan sebelum migrasi (baca-saja)**

Buat `tmp-peran.ts` dengan impor statis, jalankan dengan `npx tsx --env-file=.env.local tmp-peran.ts`, lalu hapus berkasnya. Kueri:

```sql
select role, count(*) from profiles group by role
```

Catat hasilnya di laporan.

- [ ] **Step 2: Terapkan migrasi**

```bash
export PATH="/d/nvm/nodejs:$PATH"; npm run db:migrate
```

Harapan: migrasi `0002_satu_peran` diterapkan tanpa galat.

- [ ] **Step 3: Verifikasi database (baca-saja)**

Jalankan ulang kueri Step 1. Harapan: hanya `admin`. Periksa juga constraint-nya:

```sql
select pg_get_constraintdef(oid) from pg_constraint where conname = 'profiles_role_valid'
```

Harapan: `CHECK ((role = 'admin'::text))`. Hapus berkas sementaranya.

- [ ] **Step 4: Pemeriksaan otomatis dan peramban**

Jalankan `npm test`, `npm run test:integration`, `npm run lint`, dan `npm run build`. Harapan: seluruhnya lulus.

Uji di peramban lewat skill `/browse` (bukan `mcp__claude-in-chrome__*`), dengan `npm run dev`:
1. Masuk sebagai `petugas` / `perpus123`. Sidebar menampilkan grup Pengaturan, termasuk Audit Log, dan halaman Pengaturan → Konfigurasi terbuka tanpa "Akses ditolak".
2. Pengaturan → Pengguna: tidak ada kolom Peran. Tombol Tambah Pengguna membuka form tanpa pilihan Peran. **Jangan menyimpan akun baru**, karena akun baru adalah akun Supabase sungguhan.
3. Master Data → Buku → "Pemrograman Web": tombol aksi status eksemplar (misalnya "Nonaktifkan") tampil. **Jangan menekannya.**
4. Pengaturan → Audit Log: catatan lama `user.create` untuk `qa_petugas` tetap tampil tanpa galat.

Hentikan server dev setelah selesai.

- [ ] **Step 5: Tandai rencana selesai**

Ubah seluruh `- [ ]` di berkas ini menjadi `- [x]`, lalu commit:

```bash
git add docs/superpowers/plans/2026-09-26-perpustakaan-05b-satu-peran.md
git commit -F - <<'EOF'
docs: tandai Rencana 05b (Satu Peran) selesai

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

## Hasil Akhir Rencana 05b

- Hanya ada satu peran, `admin`. Setiap akun yang masuk melihat seluruh menu dan dapat menjalankan seluruh aksi.
- Form pengguna tidak lagi menanyakan peran. Akun baru selalu admin.
- Panel "Akses ditolak" dihapus. Pengaman server tetap mewajibkan sesi sebelum membaca isian apa pun.
- Database hanya menerima `role = 'admin'`. Akun `petugas` dan `qa_petugas` yang ada kini admin.
- Spec §1.1, §1.2, dan §7 mencatat keputusan ini.

## Yang Sengaja Tidak Dilakukan

| Hal | Alasan |
|---|---|
| Menghapus kolom `profiles.role` | Satu nilai sah cukup. Menghapus kolom menambah migrasi dan perubahan kueri tanpa manfaat bagi pengguna, dan kolom ini memudahkan bila suatu hari peran terbatas dibutuhkan lagi. |
| Mengganti nama akun `petugas` | Username menjadi surel internal Supabase dan tidak dapat diubah (Rencana 03). Akun itu tetap dapat dipakai sebagai admin kedua, atau dinonaktifkan lewat Pengaturan → Pengguna. |
| Menyunting ulang Rencana 01–05 | Dokumen rencana adalah catatan sejarah; spec yang direvisi menjadi acuan. |
