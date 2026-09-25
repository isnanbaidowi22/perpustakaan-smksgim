# Perpustakaan — Rencana 03: Pengaturan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin dapat mengelola Tahun Ajaran (termasuk memindahkan tahun aktif), Konfigurasi aturan perpustakaan, dan akun Pengguna dari layar sungguhan, tanpa membuka dasbor Supabase atau menyentuh kode.

**Architecture:** Mengikuti pola lima lapis Rencana 02: validasi (zod) → service (transaksi + audit log) → query → Server Action (`runFormAction`/`runCommand`) → halaman. Seluruh layar Pengaturan khusus admin: Server Action menolak lewat `authorize(['admin'])`, dan halaman menampilkan panel "Akses ditolak" bila dibuka petugas lewat URL langsung. Manajemen pengguna menyentuh dua sistem (Supabase Auth dan tabel `profiles`), sehingga service-nya menerima port `AuthAdmin` yang dapat ditiru di uji integrasi, dan membersihkan akun Supabase bila penyimpanan profil gagal.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS 4 · Drizzle ORM 0.45 · Supabase Postgres + Auth (`@supabase/supabase-js` admin API) · zod 4 · Vitest 5

**Spec:** `docs/superpowers/specs/2026-09-21-sistem-peminjaman-perpustakaan-design.md`
**Rencana sebelumnya:** `docs/superpowers/plans/2026-09-25-perpustakaan-02-master-data.md` (selesai, digabung ke `master` di `973d533`)

| Rencana | Isi |
|---|---|
| 02 | Master Data: Kategori, Rak, Siswa, Buku, Eksemplar (selesai) |
| 03 (ini) | Pengaturan: Tahun Ajaran, Konfigurasi, Pengguna |
| 04 | Transaksi: Peminjaman, Pengembalian, Pelunasan Denda, Riwayat |
| 05 | Dashboard, Cetak struk dan label barcode, Tampilan audit log |
| 06 | Laporan |

**Kewajiban bawaan dari Rencana 02** yang diselesaikan di sini: form tambah siswa saat tidak ada tahun ajaran aktif (Task 2).

**Yang disediakan untuk Rencana 04:** `getLibrarySettings()` (Task 3) mengembalikan aturan peminjaman dalam bentuk `LibrarySettings` domain, lengkap dengan nilai bawaan bila baris konfigurasi belum ada.

## Global Constraints

- **Versi terpasang:** `next@16.3.5`, `react@19.2.8`, `drizzle-orm@0.45.3`, `vitest@5.0.1`, `zod@4.6.5`, `@supabase/supabase-js@^2.116.0`. Node.js 24. Tidak ada dependensi baru.
- **Lingkungan Windows:** Node berada di `D:\nvm\nodejs` dan **tidak** ada di PATH shell agen. Awali setiap perintah `npm`/`npx` dengan `export PATH="/d/nvm/nodejs:$PATH";` (Git Bash) atau `$env:Path = "D:\nvm\nodejs;" + $env:Path;` (PowerShell).
- **TypeScript mode `strict`.** `any` implisit maupun eksplisit dilarang.
- **Tanggal kalender direpresentasikan sebagai untai `'YYYY-MM-DD'`,** bukan objek `Date`.
- **`src/domain/**` tetap murni** (aturan ESLint Rencana 01). Rencana ini tidak menambah berkas domain.
- **Nilai persis seperti tertulis:** peran `admin` `petugas`; status `active` `inactive`.
- **Seluruh teks antarmuka berbahasa Indonesia.** Nama variabel, fungsi, dan tabel berbahasa Inggris.
- **Setiap pesan galat menyebut entitas dan tindakan yang harus diambil.** "Terjadi kesalahan" tidak diterima.
- **Otorisasi (spec Section 7):** kelola pengguna, ubah konfigurasi, dan kelola tahun ajaran → **hanya `admin`**. Setiap Server Action di rencana ini memakai `roles: ['admin']`. Setiap halaman di bawah `/pengaturan` memanggil `requireProfile()` sendiri lalu menampilkan `<AccessDenied />` bila perannya bukan admin.
- **DATABASE_URL menunjuk ke database pengembangan di Supabase cloud yang berisi data seed.** Uji integrasi **dilarang** memakai `truncate`, `delete` tanpa `where`, atau commit apa pun; semuanya berjalan di dalam `withRollback()`. Nilai unik buatan uji: kategori/rak/dsb. berawalan `UJI-`; **username uji berawalan `uji_`** (format username tidak mengizinkan huruf besar atau tanda hubung); **tahun ajaran uji memakai tahun 2090 ke atas** (format nama `2026/2027` tidak mengizinkan awalan).
- **Uji integrasi tidak pernah membuat akun sungguhan di Supabase Auth.** Service pengguna menerima `AuthAdmin`; uji memakai `fakeAuthAdmin(tx)` yang menyisipkan baris `auth.users` di transaksi uji yang sama (ikut di-rollback).
- **Kata sandi tidak pernah ditulis ke `audit_logs`, ke log, maupun dikirim balik ke peramban.** Server Action yang menerima kata sandi mengisi `secretFields` (Task 1).
- **Setiap Server Action penulis data memakai `runFormAction` atau `runCommand`.** Berkas `'use server'` hanya berisi Server Action.
- **Setiap perubahan data menulis satu baris `audit_logs` di transaksi yang sama.**
- **Data tidak pernah dihapus permanen** (BR-08): pengguna dinonaktifkan, tahun ajaran lama tetap tersimpan.
- **Next.js 16:** `params` dan `searchParams` adalah `Promise` dan wajib di-`await`. `forbidden()` masih eksperimental; jangan menyalakan `experimental.authInterrupts`.
- **Desktop dan tablet (PRD bab 9):** tabel daftar dibungkus `<ScrollTable>`; kolom ganda hanya dari breakpoint `sm`.
- **Repo ini memasang hook tdd-guard.** Urutan langkah (uji gagal → implementasi → uji lulus) wajib diikuti.
- **Setiap commit diakhiri baris:** `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## Review Focus

Lima kondisi yang tersirat dari spec tetapi paling mungkin lolos dari uji biasa, masing-masing sudah diberi uji di task pemiliknya:

1. **Admin mengubah akunnya sendiri.** Admin yang menurunkan perannya atau menonaktifkan dirinya sendiri dapat mengunci seluruh perpustakaan dari Pengaturan. Service menolak keduanya dengan pesan yang menyarankan meminta admin lain. (Task 4: `updateUser` dan `setUserStatus` dengan `id === actor.id`.)
2. **Pengguna nonaktif memasukkan kata sandi yang benar.** Tanpa penanganan, ia terlempar kembali ke layar masuk tanpa penjelasan, karena setiap halaman menolak profil nonaktif. Layar masuk harus berkata "Akun ini dinonaktifkan". (Task 5: uji `signIn`.)
3. **Akun Supabase terbuat, tetapi profilnya gagal disimpan.** Tanpa pembersihan, username itu terkunci selamanya: Supabase menolak surel yang sama, sedangkan daftar pengguna tidak menampilkannya. (Task 4: uji kompensasi dengan `fakeAuthAdmin(tx, { withoutAuthRow: true })`.)
4. **Petugas membuka `/pengaturan/...` lewat URL langsung.** Harus melihat panel "Akses ditolak" yang jelas, bukan halaman galat atau data admin. (Task 2, 3, 5: uji halaman dengan profil petugas.)
5. **Kotak centang yang dilepas lalu validasi kolom lain gagal.** Kotak yang tidak dicentang tidak terkirim di FormData, sehingga tanpa penanganan ia kembali tercentang dan admin tanpa sadar menyimpan aturan blokir yang ingin dimatikannya. (Task 1: uji `CheckboxField` dengan state galat.)

---

## Struktur Berkas

| Berkas | Tanggung jawab |
|---|---|
| `src/server/validation/common.ts` | + `requiredInteger`, `isoDate`, `checkbox` |
| `src/components/ui/fields.tsx` | + `CheckboxField`; `TextField` menerima `type="password"` dan `autoComplete` |
| `src/components/ui/access-denied.tsx` | Panel untuk petugas yang membuka halaman khusus admin |
| `src/server/forms/run-action.ts` | + `secretFields`: kolom yang tidak dikirim balik ke peramban |
| `src/server/audit.ts` | `entityId` opsional, untuk tabel tanpa id UUID (`library_settings`) |
| `src/server/validation/academic-year.ts` | Skema form tahun ajaran |
| `src/server/services/academic-years.ts` | Tambah, ubah, dan pindahkan tanda aktif tahun ajaran |
| `src/server/queries/academic-years.ts` | + `listAcademicYears`, `getAcademicYear` |
| `src/server/actions/academic-years.ts` | Server Action tahun ajaran |
| `src/app/(app)/pengaturan/tahun-ajaran/**` | Layar tahun ajaran |
| `src/app/(app)/master/siswa/student-fields.tsx` | Pilihan "tanpa tahun ajaran" bila tidak ada tahun aktif |
| `src/server/validation/settings.ts` | Skema form konfigurasi |
| `src/server/queries/settings.ts` | `getLibrarySettings` — dipakai juga Rencana 04 |
| `src/server/services/settings.ts` | Simpan konfigurasi |
| `src/server/actions/settings.ts` | Server Action konfigurasi |
| `src/app/(app)/pengaturan/konfigurasi/page.tsx` | Layar konfigurasi |
| `src/server/auth/auth-admin.ts` | Port `AuthAdmin` dan implementasi Supabase-nya |
| `src/server/auth/username.ts` | Ekspor pola username untuk validasi form |
| `src/server/validation/user.ts` | Skema form pengguna dan kata sandi |
| `src/server/queries/users.ts` | Daftar dan detail pengguna |
| `src/server/services/users.ts` | Buat, ubah, (non)aktifkan, dan atur ulang kata sandi pengguna |
| `src/server/actions/users.ts` | Server Action pengguna |
| `src/server/actions/auth.ts` | `signIn` menolak akun nonaktif dengan pesan jelas |
| `src/app/(app)/pengaturan/pengguna/**` | Layar pengguna |
| `tests/integration/helpers.ts` | + `fakeAuthAdmin` |
| `tests/integration/{academic-years,settings,users}.test.ts` | Uji integrasi service dan query |

---

## Task 1: Blok Bangunan Form Pengaturan

Tiga layar di rencana ini butuh hal yang belum dimiliki Rencana 02: kotak centang (konfigurasi, tahun ajaran), kolom tanggal dan bilangan wajib, kolom kata sandi yang tidak pernah dikirim balik, audit untuk tabel tanpa id UUID, dan panel "Akses ditolak". Task ini menyediakannya sekaligus agar task berikutnya hanya merangkai.

**Files:**
- Modify: `src/server/validation/common.ts`, `src/server/validation/common.test.ts`
- Modify: `src/lib/form-state.test.ts`
- Modify: `src/components/ui/fields.tsx`, `src/components/ui/action-form.test.tsx`
- Modify: `src/server/forms/run-action.ts`, `src/server/forms/run-action.test.ts`
- Modify: `src/server/audit.ts`, `tests/integration/audit.test.ts`
- Create: `src/components/ui/access-denied.tsx`, `src/components/ui/access-denied.test.tsx`

**Interfaces:**
- Consumes: `requiredText`, `rupiah` (common.ts), `useField` (action-form.tsx), `formToObject`, `formError` (form-state.ts)
- Produces:
  - `requiredInteger(message: string, min: number, max: number)` — skema zod `string → number`
  - `isoDate(message: string)` — skema zod `string → 'YYYY-MM-DD'`
  - `checkbox()` — skema zod `'on' | 'off' | undefined → boolean`
  - `<CheckboxField name label hint? defaultChecked? />`
  - `<TextField type="password" autoComplete="new-password" … />`
  - `runFormAction({ …, secretFields?: string[] })`
  - `AuditEntry.entityId?: string` (kosong → `null`)
  - `<AccessDenied />`

- [ ] **Step 1: Tulis uji pembangun skema yang gagal**

Di `src/server/validation/common.test.ts`, ubah baris impor menjadi:

```ts
import {
  checkbox, isoDate, isRecordStatus, isUuid, optionalInteger, optionalText, optionalUuid,
  requiredInteger, requiredText, rupiah,
} from './common';
```

Lalu tambahkan di akhir berkas:

```ts
describe('requiredInteger', () => {
  const message = 'Batas pinjam harus bilangan bulat 1 sampai 20.';
  const schema = requiredInteger(message, 1, 20);

  it('mengubah isian menjadi bilangan', () => {
    expect(schema.parse(' 3 ')).toBe(3);
  });

  it('menolak isian kosong, pecahan, huruf, dan di luar rentang dengan pesan yang sama', () => {
    for (const value of ['', '2.5', 'tiga', '0', '21', undefined]) {
      expect(messageOf(schema.safeParse(value))).toBe(message);
    }
  });
});

describe('isoDate', () => {
  const message = 'Tanggal mulai wajib diisi dengan tanggal yang valid.';
  const schema = isoDate(message);

  it('menerima tanggal dari <input type="date">', () => {
    expect(schema.parse('2026-07-01')).toBe('2026-07-01');
  });

  it('menolak isian kosong dan format lain dengan pesan yang diberikan', () => {
    for (const value of ['', '2026-13-01', '01/07/2026', undefined]) {
      expect(messageOf(schema.safeParse(value))).toBe(message);
    }
  });
});

describe('checkbox', () => {
  it('bernilai true hanya bila kotak dicentang', () => {
    expect(checkbox().parse('on')).toBe(true);
    expect(checkbox().parse('off')).toBe(false);
    expect(checkbox().parse(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Jalankan uji dan pastikan gagal**

Run: `npx vitest run src/server/validation/common.test.ts`
Expected: FAIL — `requiredInteger is not a function` (dan dua lainnya).

- [ ] **Step 3: Implementasikan pembangun skema**

Tambahkan di `src/server/validation/common.ts`, tepat setelah `optionalInteger`:

```ts
/** Bilangan bulat wajib dalam rentang tertutup, dengan satu pesan untuk semua kesalahan. */
export function requiredInteger(message: string, min: number, max: number) {
  return z
    .string({ error: message })
    .trim()
    .min(1, message)
    .transform(Number)
    .pipe(z.number({ error: message }).int(message).min(min, message).max(max, message));
}

/** Tanggal dari `<input type="date">`, yang selalu mengirim 'YYYY-MM-DD'. */
export function isoDate(message: string) {
  return z.string({ error: message }).trim().pipe(z.iso.date({ error: message }));
}

/**
 * Nilai `CheckboxField`. Kolom tersembunyinya mengirim 'off' dan kotaknya
 * mengirim 'on' bila dicentang; `formToObject` menyimpan nilai terakhir.
 * Isian yang tidak dikirim sama sekali berarti tidak dicentang.
 */
export function checkbox() {
  return z.string().optional().transform((value) => value === 'on');
}
```

- [ ] **Step 4: Jalankan uji dan pastikan lulus**

Run: `npx vitest run src/server/validation/common.test.ts`
Expected: PASS.

- [ ] **Step 5: Kunci perilaku `formToObject` yang diandalkan kotak centang**

Tambahkan di dalam `describe('formToObject', …)` pada `src/lib/form-state.test.ts`:

```ts
  it('menyimpan nilai terakhir bila beberapa isian bernama sama', () => {
    // CheckboxField bergantung pada ini: kolom tersembunyi 'off' lalu kotak 'on'.
    const data = new FormData();
    data.append('blockWhenOverdue', 'off');
    data.append('blockWhenOverdue', 'on');
    expect(formToObject(data)).toEqual({ blockWhenOverdue: 'on' });
  });
```

Run: `npx vitest run src/lib/form-state.test.ts`
Expected: PASS tanpa perubahan kode — uji ini mengunci kontrak yang sudah ada agar tidak berubah diam-diam.

- [ ] **Step 6: Tulis uji `CheckboxField` dan kolom kata sandi yang gagal**

Di `src/components/ui/action-form.test.tsx`, ubah impor fields menjadi:

```ts
import { CheckboxField, SelectField, TextAreaField, TextField } from './fields';
```

Lalu tambahkan di dalam `describe('ActionForm', …)`:

```tsx
  it('CheckboxField mengirim "off" lewat kolom tersembunyi dan mengikuti nilai bawaan', () => {
    const html = renderToStaticMarkup(
      <ActionForm action={vi.fn()} submitLabel="Simpan">
        <CheckboxField name="blockWhenOverdue" label="Tolak bila terlambat" defaultChecked />
      </ActionForm>,
    );
    expect(html).toContain('<input type="hidden" name="blockWhenOverdue" value="off"/>');
    expect(html).toMatch(/type="checkbox"[^>]*checked=""/);
  });

  it('CheckboxField tetap tidak dicentang setelah validasi kolom lain gagal', () => {
    const state = formError(
      'Konfigurasi belum dapat disimpan. Periksa kolom yang ditandai.',
      { loanDurationDays: ['Durasi pinjam harus bilangan bulat 1 sampai 90 hari.'] },
      { blockWhenOverdue: 'off', loanDurationDays: '0' },
    );
    const html = renderToStaticMarkup(
      <ActionForm action={vi.fn()} submitLabel="Simpan" initialState={state}>
        <CheckboxField name="blockWhenOverdue" label="Tolak bila terlambat" defaultChecked />
      </ActionForm>,
    );
    expect(html).not.toMatch(/checked=""/);
  });

  it('TextField kata sandi memakai type password dan petunjuk isi otomatis', () => {
    const html = renderToStaticMarkup(
      <ActionForm action={vi.fn()} submitLabel="Simpan">
        <TextField name="password" label="Kata sandi" type="password" autoComplete="new-password" />
      </ActionForm>,
    );
    expect(html).toContain('type="password"');
    expect(html).toContain('autocomplete="new-password"');
  });
```

- [ ] **Step 7: Jalankan uji dan pastikan gagal**

Run: `npx vitest run src/components/ui/action-form.test.tsx`
Expected: FAIL — `CheckboxField` tidak diekspor, dan `autocomplete` tidak dirender.

- [ ] **Step 8: Implementasikan `CheckboxField` dan kolom kata sandi**

Di `src/components/ui/fields.tsx`, ganti deklarasi `TextField` seluruhnya dengan:

```tsx
export function TextField({
  name, label, hint, required, defaultValue = '', type = 'text', inputMode, autoFocus, maxLength, autoComplete,
}: BaseProps & {
  type?: 'text' | 'number' | 'date' | 'tel' | 'password';
  inputMode?: 'text' | 'numeric' | 'tel';
  autoFocus?: boolean;
  maxLength?: number;
  autoComplete?: string;
}) {
  const { value, error } = useField(name, defaultValue);
  return (
    <FieldShell name={name} label={label} hint={hint} required={required} error={error}>
      <input
        id={name}
        name={name}
        type={type}
        inputMode={inputMode}
        autoFocus={autoFocus}
        maxLength={maxLength}
        autoComplete={autoComplete}
        required={required}
        defaultValue={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, error, hint)}
        className={CONTROL}
      />
    </FieldShell>
  );
}
```

Lalu tambahkan di akhir berkas:

```tsx
/**
 * Kotak centang. Kolom tersembunyi bernilai "off" mendahului kotaknya, dan
 * `formToObject` menyimpan nilai terakhir: "on" bila dicentang, "off" bila
 * tidak. Tanpa kolom tersembunyi, kotak yang dilepas tidak terkirim sama
 * sekali dan kembali tercentang setelah validasi kolom lain gagal.
 */
export function CheckboxField({
  name, label, hint, defaultChecked = false,
}: { name: string; label: string; hint?: string; defaultChecked?: boolean }) {
  const { value, error } = useField(name, defaultChecked ? 'on' : 'off');
  return (
    <div>
      <div className="flex items-start gap-2">
        <input type="hidden" name={name} value="off" />
        {/* `key` untuk alasan yang sama dengan SelectField: reset form React 19
            tidak memperbarui defaultChecked yang berubah. */}
        <input
          key={value}
          id={name}
          name={name}
          type="checkbox"
          value="on"
          defaultChecked={value === 'on'}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(name, error, hint)}
          className="mt-0.5 size-4 accent-[var(--color-accent-600)]"
        />
        <label htmlFor={name} className="text-sm font-medium">{label}</label>
      </div>
      {hint && !error && (
        <p id={`${name}-hint`} className="ml-6 mt-1 text-xs text-[var(--color-ink-500)]">{hint}</p>
      )}
      {error && (
        <p id={`${name}-error`} className="ml-6 mt-1 text-xs font-medium text-[var(--color-status-terlambat)]">{error}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 9: Jalankan uji dan pastikan lulus**

Run: `npx vitest run src/components/ui/action-form.test.tsx`
Expected: PASS.

- [ ] **Step 10: Tulis uji kolom rahasia yang gagal**

Tambahkan di dalam `describe('runFormAction', …)` pada `src/server/forms/run-action.test.ts`:

```ts
  it('tidak mengirim balik kolom rahasia bila validasi gagal', async () => {
    const state = await runFormAction(options({
      formData: form({ name: '', password: 'rahasia123' }),
      secretFields: ['password'],
    }));

    expect(state).toEqual(formError(
      'Kategori belum dapat disimpan. Periksa kolom yang ditandai.',
      { name: ['Nama kategori wajib diisi.'] },
      { name: '' },
    ));
  });

  it('tidak mengirim balik kolom rahasia bila service menolak', async () => {
    const execute = vi.fn(async (): Promise<ServiceResult> => ({
      ok: false, message: 'Username siti sudah dipakai. Pilih username lain.', field: 'name',
    }));

    const state = await runFormAction(options({
      execute,
      formData: form({ name: 'Fiksi', password: 'rahasia123' }),
      secretFields: ['password'],
    }));

    expect(state).toEqual(formError(
      'Username siti sudah dipakai. Pilih username lain.',
      { name: ['Username siti sudah dipakai. Pilih username lain.'] },
      { name: 'Fiksi' },
    ));
  });
```

- [ ] **Step 11: Jalankan uji dan pastikan gagal**

Run: `npx vitest run src/server/forms/run-action.test.ts`
Expected: FAIL — `values` masih berisi `password: 'rahasia123'`.

- [ ] **Step 12: Implementasikan `secretFields`**

Di `src/server/forms/run-action.ts`, tambahkan properti ini ke `interface FormActionOptions`, tepat setelah `invalidMessage`:

```ts
  /**
   * Kolom yang tidak boleh dikirim balik ke peramban bersama isian terakhir,
   * misalnya kata sandi. Kolom ini kosong kembali setelah galat.
   */
  secretFields?: string[];
```

Ganti isi `runFormAction` dengan:

```ts
export async function runFormAction<S extends z.ZodType>(options: FormActionOptions<S>): Promise<FormState> {
  const auth = await authorize(options.roles);
  if (!auth.ok) return formError(auth.message);

  const values = formToObject(options.formData);
  const echoed = withoutFields(values, options.secretFields ?? []);
  const parsed = options.schema.safeParse(values);
  if (!parsed.success) {
    return formError(options.invalidMessage, fieldErrorsOf(parsed.error), echoed);
  }

  const result = await options.execute(parsed.data, auth.actor);
  return complete(result, options, echoed);
}
```

Dan tambahkan fungsi ini tepat sebelum `fieldErrorsOf`:

```ts
function withoutFields(values: Record<string, string>, fields: string[]): Record<string, string> {
  return Object.fromEntries(Object.entries(values).filter(([key]) => !fields.includes(key)));
}
```

- [ ] **Step 13: Jalankan uji dan pastikan lulus**

Run: `npx vitest run src/server/forms/run-action.test.ts`
Expected: PASS.

- [ ] **Step 14: Tulis uji audit tanpa id entitas**

Ubah impor `drizzle-orm` di `tests/integration/audit.test.ts` menjadi `import { and, eq, sql } from 'drizzle-orm';`, lalu tambahkan di dalam `describe('writeAudit', …)`:

```ts
  it('menyimpan entity_id kosong untuk tabel tanpa id UUID', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);

      await writeAudit(tx, {
        actorId: actor.id,
        action: 'settings.update',
        entity: 'library_settings',
        metadata: { marker: 'UJI-audit-tanpa-id' },
      });

      const [row] = await tx
        .select()
        .from(auditLogs)
        .where(sql`${auditLogs.metadata} ->> 'marker' = 'UJI-audit-tanpa-id'`);
      expect(row?.entityId).toBeNull();
    });
  });
```

- [ ] **Step 15: Pastikan uji gagal di pemeriksa tipe**

Run: `npx tsc --noEmit`
Expected: FAIL — `Property 'entityId' is missing in type … but required in type 'AuditEntry'`. (Saat runtime Drizzle sudah mengisi `null` untuk `undefined`; yang salah adalah kontrak tipenya.)

- [ ] **Step 16: Jadikan `entityId` opsional**

Di `src/server/audit.ts`, ganti baris `entityId: string;` pada `AuditEntry` dengan:

```ts
  /** Kosong untuk tabel tanpa id UUID, misalnya `library_settings` yang hanya satu baris. */
  entityId?: string;
```

Dan di `writeAudit`, ganti `entityId: entry.entityId,` dengan `entityId: entry.entityId ?? null,`.

- [ ] **Step 17: Jalankan pemeriksa tipe dan uji audit**

Run: `npx tsc --noEmit && npx vitest run --config vitest.integration.config.ts tests/integration/audit.test.ts`
Expected: tsc bersih; 2 uji PASS.

- [ ] **Step 18: Tulis uji panel "Akses ditolak" yang gagal**

Buat `src/components/ui/access-denied.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AccessDenied } from './access-denied';

describe('AccessDenied', () => {
  it('menjelaskan bahwa halaman khusus admin dan menawarkan jalan kembali', () => {
    const html = renderToStaticMarkup(<AccessDenied />);
    expect(html).toContain('Akses ditolak');
    expect(html).toContain('Halaman ini hanya untuk admin');
    expect(html).toContain('href="/dashboard"');
  });
});
```

Run: `npx vitest run src/components/ui/access-denied.test.tsx`
Expected: FAIL — modul `./access-denied` tidak ditemukan.

- [ ] **Step 19: Implementasikan panel**

Buat `src/components/ui/access-denied.tsx`:

```tsx
import Link from 'next/link';
import { buttonClass } from './button-styles';

/**
 * Ditampilkan halaman khusus admin saat dibuka petugas lewat URL langsung.
 * `forbidden()` Next.js 16 masih eksperimental, jadi halaman menampilkan
 * panel ini sendiri. Server Action-nya tetap menolak lewat `authorize`.
 */
export function AccessDenied() {
  return (
    <div role="alert" className="max-w-xl rounded-lg border border-[var(--color-ink-100)] bg-white p-6">
      <h1 className="page-title text-xl font-semibold">Akses ditolak</h1>
      <p className="mt-2 text-sm text-[var(--color-ink-500)]">
        Halaman ini hanya untuk admin. Minta admin perpustakaan bila pengaturan ini perlu diubah.
      </p>
      <Link href="/dashboard" className={`${buttonClass('secondary')} mt-4`}>Kembali ke Dashboard</Link>
    </div>
  );
}
```

- [ ] **Step 20: Jalankan seluruh uji unit dan lint**

Run: `npm test && npm run lint`
Expected: seluruhnya PASS, lint bersih.

- [ ] **Step 21: Commit**

```bash
git add src/server/validation/common.ts src/server/validation/common.test.ts src/lib/form-state.test.ts \
  src/components/ui/fields.tsx src/components/ui/action-form.test.tsx \
  src/server/forms/run-action.ts src/server/forms/run-action.test.ts \
  src/server/audit.ts tests/integration/audit.test.ts \
  src/components/ui/access-denied.tsx src/components/ui/access-denied.test.tsx
git commit -m "$(cat <<'EOF'
feat(form): kotak centang, tanggal, kolom rahasia, dan panel akses ditolak

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Tahun Ajaran

Admin menambah tahun ajaran, memperbaiki tanggalnya, dan memindahkan tanda aktif. Database sudah menjamin paling banyak satu tahun aktif (`one_active_academic_year`); service menjamin pemindahan tanda aktif tidak pernah melanggar index itu, termasuk saat dua admin menekannya bersamaan. Tahun ajaran tidak dapat dinonaktifkan tanpa mengaktifkan yang lain, dan tidak pernah dihapus.

Task ini juga menutup kewajiban dari Rencana 02: form tambah siswa saat tidak ada tahun ajaran aktif.

**Files:**
- Create: `src/server/validation/academic-year.ts`, `src/server/validation/academic-year.test.ts`
- Create: `src/server/services/academic-years.ts`
- Modify: `src/server/queries/academic-years.ts`, `tests/integration/academic-years.test.ts`
- Create: `src/server/actions/academic-years.ts`, `src/server/actions/academic-years.test.ts`
- Create: `src/app/(app)/pengaturan/tahun-ajaran/page.tsx`, `page.test.tsx`
- Create: `src/app/(app)/pengaturan/tahun-ajaran/academic-year-fields.tsx`
- Create: `src/app/(app)/pengaturan/tahun-ajaran/baru/page.tsx`, `baru/page.test.tsx`
- Create: `src/app/(app)/pengaturan/tahun-ajaran/[id]/page.tsx`, `[id]/page.test.tsx`
- Modify: `src/app/(app)/master/siswa/student-fields.tsx`, `src/app/(app)/master/siswa/baru/page.test.tsx`

**Interfaces:**
- Consumes: `requiredText`, `isoDate`, `checkbox`, `isUuid` (common.ts); `writeAudit`; `uniqueViolation`; `ok`/`fail`/`ServiceResult`; `runFormAction`/`runCommand`; `CheckboxField`, `TextField`; `AccessDenied`; `getActiveAcademicYear` (sudah ada)
- Produces:
  - `academicYearSchema`, `newAcademicYearSchema`; `type AcademicYearInput = { name: string; startDate: string; endDate: string }`; `type NewAcademicYearInput = AcademicYearInput & { activate: boolean }`
  - `interface AcademicYear { id: string; name: string; startDate: string; endDate: string; isActive: boolean }`
  - `listAcademicYears(executor?): Promise<AcademicYear[]>` — terbaru lebih dulu
  - `getAcademicYear(id: string, executor?): Promise<AcademicYear | null>`
  - `createAcademicYear(input: NewAcademicYearInput, actor: Actor, executor?): Promise<ServiceResult>`
  - `updateAcademicYear(id: string, input: AcademicYearInput, actor: Actor, executor?): Promise<ServiceResult>`
  - `activateAcademicYear(id: string, actor: Actor, executor?): Promise<ServiceResult>`
  - Server Action: `createAcademicYearAction`, `updateAcademicYearAction(id, …)`, `activateAcademicYearAction(id, …)`
  - Audit: `academic_year.create`, `academic_year.update`, `academic_year.activate` (entity `academic_years`)

- [ ] **Step 1: Tulis uji validasi yang gagal**

Buat `src/server/validation/academic-year.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { academicYearSchema, newAcademicYearSchema } from './academic-year';

const NAME_FORMAT = 'Nama tahun ajaran ditulis seperti 2026/2027: dua tahun berurutan.';
const valid = { name: '2026/2027', startDate: '2026-07-01', endDate: '2027-06-30' };

function messagesOf(result: z.ZodSafeParseResult<unknown>): string[] {
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe('academicYearSchema', () => {
  it('menerima tahun ajaran yang tanggalnya sesuai nama', () => {
    expect(academicYearSchema.parse({ ...valid, name: ' 2026/2027 ' })).toEqual(valid);
  });

  it('menolak nama yang bukan dua tahun berurutan, tanpa galat tanggal tambahan', () => {
    for (const name of ['2026/2028', '2026-2027', '26/27']) {
      expect(messagesOf(academicYearSchema.safeParse({ ...valid, name }))).toEqual([NAME_FORMAT]);
    }
  });

  it('menolak tanggal mulai di luar tahun pertama', () => {
    expect(messagesOf(academicYearSchema.safeParse({ ...valid, startDate: '2025-07-01' }))).toEqual([
      'Tanggal mulai harus jatuh pada tahun 2026, sesuai nama tahun ajaran.',
    ]);
  });

  it('menolak tanggal selesai di luar tahun kedua', () => {
    expect(messagesOf(academicYearSchema.safeParse({ ...valid, endDate: '2026-12-31' }))).toEqual([
      'Tanggal selesai harus jatuh pada tahun 2027, sesuai nama tahun ajaran.',
    ]);
  });

  it('mewajibkan kedua tanggal', () => {
    expect(messagesOf(academicYearSchema.safeParse({ ...valid, startDate: '', endDate: '' }))).toEqual([
      'Tanggal mulai wajib diisi dengan tanggal yang valid.',
      'Tanggal selesai wajib diisi dengan tanggal yang valid.',
    ]);
  });
});

describe('newAcademicYearSchema', () => {
  it('membaca kotak centang "jadikan aktif"', () => {
    expect(newAcademicYearSchema.parse({ ...valid, activate: 'on' })).toEqual({ ...valid, activate: true });
    expect(newAcademicYearSchema.parse(valid)).toEqual({ ...valid, activate: false });
  });
});
```

- [ ] **Step 2: Jalankan uji dan pastikan gagal**

Run: `npx vitest run src/server/validation/academic-year.test.ts`
Expected: FAIL — modul `./academic-year` tidak ditemukan.

- [ ] **Step 3: Implementasikan validasi**

Buat `src/server/validation/academic-year.ts`:

```ts
import { z } from 'zod';
import { checkbox, isoDate, requiredText } from './common';

const NAME_PATTERN = /^(\d{4})\/(\d{4})$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const NAME_FORMAT = 'Nama tahun ajaran ditulis seperti 2026/2027: dua tahun berurutan.';

function isConsecutive(name: string): boolean {
  const match = NAME_PATTERN.exec(name);
  return match !== null && Number(match[2]) === Number(match[1]) + 1;
}

const fields = {
  // Satu pemeriksaan di dalam `.pipe()`, bukan `.regex()` lalu `.refine()`:
  // zod 4 tetap menjalankan `.refine()` walau `.regex()` gagal, sehingga
  // pesan yang sama muncul dua kali. `.pipe()` berhenti di kegagalan pertama.
  name: requiredText('Nama tahun ajaran wajib diisi, misalnya 2026/2027.', 20)
    .pipe(z.string().refine(isConsecutive, NAME_FORMAT)),
  startDate: isoDate('Tanggal mulai wajib diisi dengan tanggal yang valid.'),
  endDate: isoDate('Tanggal selesai wajib diisi dengan tanggal yang valid.'),
};

interface YearDates {
  name: string;
  startDate: string;
  endDate: string;
}

/**
 * Tanggal yang tidak cocok dengan namanya hampir selalu salah ketik tahun,
 * dan tahun ajaran yang keliru membuat transaksi setahun penuh tercatat di
 * tahun yang salah. Karena tahun kedua = tahun pertama + 1, tanggal selesai
 * otomatis setelah tanggal mulai bila keduanya lolos pemeriksaan ini.
 *
 * Zod 4 tetap menjalankan refinement objek walau kolomnya punya galat
 * format; pemeriksaan dilewati bila nama atau tanggal belum sah, agar tidak
 * menumpuk pesan yang menyesatkan.
 */
function dateIssues({ name, startDate, endDate }: YearDates): { path: keyof YearDates; message: string }[] {
  if (!isConsecutive(name)) return [];
  const [firstYear, secondYear] = name.split('/');
  const issues: { path: keyof YearDates; message: string }[] = [];
  if (ISO_DATE.test(startDate) && !startDate.startsWith(`${firstYear}-`)) {
    issues.push({ path: 'startDate', message: `Tanggal mulai harus jatuh pada tahun ${firstYear}, sesuai nama tahun ajaran.` });
  }
  if (ISO_DATE.test(endDate) && !endDate.startsWith(`${secondYear}-`)) {
    issues.push({ path: 'endDate', message: `Tanggal selesai harus jatuh pada tahun ${secondYear}, sesuai nama tahun ajaran.` });
  }
  return issues;
}

export const academicYearSchema = z.object(fields).superRefine((value, ctx) => {
  for (const issue of dateIssues(value)) ctx.addIssue({ code: 'custom', path: [issue.path], message: issue.message });
});

export const newAcademicYearSchema = z.object({ ...fields, activate: checkbox() }).superRefine((value, ctx) => {
  for (const issue of dateIssues(value)) ctx.addIssue({ code: 'custom', path: [issue.path], message: issue.message });
});

export type AcademicYearInput = z.output<typeof academicYearSchema>;
export type NewAcademicYearInput = z.output<typeof newAcademicYearSchema>;
```

- [ ] **Step 4: Jalankan uji dan pastikan lulus**

Run: `npx vitest run src/server/validation/academic-year.test.ts`
Expected: PASS.

- [ ] **Step 5: Tulis uji integrasi service dan query yang gagal**

Di `tests/integration/academic-years.test.ts`, ganti blok impor dengan:

```ts
import { describe, expect, it } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import { academicYears, auditLogs } from '@/server/db/schema';
import {
  getAcademicYear, getActiveAcademicYear, listAcademicYearOptions, listAcademicYears,
} from '@/server/queries/academic-years';
import { activateAcademicYear, createAcademicYear, updateAcademicYear } from '@/server/services/academic-years';
import { testActor, withRollback } from './helpers';
```

Lalu tambahkan di akhir berkas:

```ts
const input = { name: '2091/2092', startDate: '2091-07-01', endDate: '2092-06-30' };

async function activeIds(tx: Parameters<Parameters<typeof withRollback>[0]>[0]): Promise<string[]> {
  const rows = await tx.select({ id: academicYears.id }).from(academicYears).where(eq(academicYears.isActive, true));
  return rows.map((row) => row.id);
}

describe('createAcademicYear', () => {
  it('menyimpan tahun ajaran tanpa menyentuh tahun aktif bila tidak diminta', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const before = await activeIds(tx);

      const result = await createAcademicYear({ ...input, activate: false }, actor, tx);

      if (!result.ok) throw new Error(result.message);
      expect(await getAcademicYear(result.id, tx)).toEqual({ id: result.id, ...input, isActive: false });
      expect(await activeIds(tx)).toEqual(before);
      const [audit] = await tx
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.entityId, result.id), eq(auditLogs.action, 'academic_year.create')));
      expect(audit?.metadata).toEqual({ ...input, activated: false });
    });
  });

  it('menjadikan tahun baru satu-satunya yang aktif bila diminta', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);

      const result = await createAcademicYear({ ...input, activate: true }, actor, tx);

      if (!result.ok) throw new Error(result.message);
      expect(await activeIds(tx)).toEqual([result.id]);
    });
  });

  it('menolak nama ganda dengan pesan pada kolom nama', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      await createAcademicYear({ ...input, activate: false }, actor, tx);

      expect(await createAcademicYear({ ...input, activate: false }, actor, tx)).toEqual({
        ok: false,
        field: 'name',
        message: 'Tahun ajaran 2091/2092 sudah ada. Ubah data yang lama bila tanggalnya perlu diperbaiki.',
      });
    });
  });
});

describe('updateAcademicYear', () => {
  it('mengubah tanggal dan mencatat nilai sebelum dan sesudah', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const created = await createAcademicYear({ ...input, activate: false }, actor, tx);
      if (!created.ok) throw new Error(created.message);
      const changed = { ...input, startDate: '2091-07-15' };

      expect(await updateAcademicYear(created.id, changed, actor, tx)).toEqual({ ok: true, id: created.id });

      expect((await getAcademicYear(created.id, tx))?.startDate).toBe('2091-07-15');
      const [audit] = await tx
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.entityId, created.id), eq(auditLogs.action, 'academic_year.update')));
      expect(audit?.metadata).toEqual({ before: input, after: changed });
    });
  });

  it('melaporkan tahun ajaran yang tidak ada', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      expect(await updateAcademicYear(crypto.randomUUID(), input, actor, tx)).toEqual({
        ok: false,
        message: 'Tahun ajaran tidak ditemukan. Muat ulang halaman daftar tahun ajaran.',
      });
    });
  });
});

describe('activateAcademicYear', () => {
  it('memindahkan tanda aktif dan mencatat tahun aktif sebelumnya', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const previous = await getActiveAcademicYear(tx);
      const created = await createAcademicYear({ ...input, activate: false }, actor, tx);
      if (!created.ok) throw new Error(created.message);

      expect(await activateAcademicYear(created.id, actor, tx)).toEqual({ ok: true, id: created.id });

      expect(await activeIds(tx)).toEqual([created.id]);
      const [audit] = await tx
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.entityId, created.id), eq(auditLogs.action, 'academic_year.activate')));
      expect(audit?.metadata).toEqual({ name: '2091/2092', previous: previous?.name ?? null });
    });
  });

  it('tidak menulis audit bila tahun itu sudah aktif', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const created = await createAcademicYear({ ...input, activate: true }, actor, tx);
      if (!created.ok) throw new Error(created.message);

      expect(await activateAcademicYear(created.id, actor, tx)).toEqual({ ok: true, id: created.id });

      const audit = await tx
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.entityId, created.id), eq(auditLogs.action, 'academic_year.activate')));
      expect(audit).toHaveLength(0);
    });
  });

  it('dapat mengaktifkan tahun ajaran saat belum ada yang aktif', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const created = await createAcademicYear({ ...input, activate: false }, actor, tx);
      if (!created.ok) throw new Error(created.message);
      await tx.execute(sql`update academic_years set is_active = false`);

      expect(await activateAcademicYear(created.id, actor, tx)).toEqual({ ok: true, id: created.id });
      expect(await activeIds(tx)).toEqual([created.id]);
    });
  });
});

describe('listAcademicYears dan getAcademicYear', () => {
  it('mengembalikan tanggal sebagai untai dan menolak id bukan UUID', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const created = await createAcademicYear({ ...input, activate: false }, actor, tx);
      if (!created.ok) throw new Error(created.message);

      expect(await listAcademicYears(tx)).toContainEqual({ id: created.id, ...input, isActive: false });
      expect(await getAcademicYear('bukan-uuid', tx)).toBeNull();
    });
  });
});
```

- [ ] **Step 6: Jalankan uji dan pastikan gagal**

Run: `npx vitest run --config vitest.integration.config.ts tests/integration/academic-years.test.ts`
Expected: FAIL — modul `@/server/services/academic-years` tidak ditemukan.

- [ ] **Step 7: Tambahkan query**

Di `src/server/queries/academic-years.ts`, tambahkan `import { isUuid } from '@/server/validation/common';` ke blok impor, lalu tambahkan di akhir berkas:

```ts
export interface AcademicYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

const yearColumns = {
  id: academicYears.id,
  name: academicYears.name,
  startDate: academicYears.startDate,
  endDate: academicYears.endDate,
  isActive: academicYears.isActive,
};

/** Terbaru lebih dulu. Jumlahnya satu baris per tahun, jadi tanpa paginasi. */
export async function listAcademicYears(executor: Executor = db): Promise<AcademicYear[]> {
  return executor.select(yearColumns).from(academicYears).orderBy(desc(academicYears.startDate));
}

export async function getAcademicYear(id: string, executor: Executor = db): Promise<AcademicYear | null> {
  if (!isUuid(id)) return null;
  const [year] = await executor.select(yearColumns).from(academicYears).where(eq(academicYears.id, id)).limit(1);
  return year ?? null;
}
```

- [ ] **Step 8: Implementasikan service**

Buat `src/server/services/academic-years.ts`:

```ts
import { and, eq, ne } from 'drizzle-orm';
import type { Actor } from '@/domain/shared/types';
import { writeAudit } from '@/server/audit';
import { db } from '@/server/db/client';
import { uniqueViolation } from '@/server/db/errors';
import type { Executor, Transaction } from '@/server/db/executor';
import { academicYears } from '@/server/db/schema';
import type { AcademicYearInput, NewAcademicYearInput } from '@/server/validation/academic-year';
import { isUuid } from '@/server/validation/common';
import { fail, ok, type ServiceResult } from './result';

const NOT_FOUND = 'Tahun ajaran tidak ditemukan. Muat ulang halaman daftar tahun ajaran.';

function duplicate(name: string): ServiceResult {
  return fail(`Tahun ajaran ${name} sudah ada. Ubah data yang lama bila tanggalnya perlu diperbaiki.`, 'name');
}

/**
 * Hanya terjadi bila dua admin menambah tahun aktif pertama pada saat yang
 * sama, ketika belum ada baris untuk dikunci. Selain itu kunci di
 * `moveActiveFlag` sudah mengurutkan keduanya.
 */
const ACTIVE_RACE = 'Tahun ajaran aktif baru saja diubah admin lain. Muat ulang halaman lalu periksa tahun ajaran aktif.';

function knownViolation(error: unknown, name: string): ServiceResult | null {
  const constraint = uniqueViolation(error);
  if (constraint === 'academic_years_name_unique') return duplicate(name);
  if (constraint === 'one_active_academic_year') return fail(ACTIVE_RACE);
  return null;
}

/**
 * Memindahkan tanda aktif ke `id` dan mengembalikan nama tahun yang
 * sebelumnya aktif. Seluruh baris dikunci lebih dulu: tanpa kunci, dua admin
 * yang mengaktifkan tahun berbeda bersamaan sama-sama lolos dan salah satunya
 * ditolak index `one_active_academic_year`. Tabelnya kecil (satu baris per
 * tahun), jadi mengunci semuanya murah.
 *
 * Urutannya wajib: matikan yang lama dulu, baru nyalakan yang baru. Index
 * parsial itu tidak dapat ditunda sampai commit.
 */
async function moveActiveFlag(tx: Transaction, id: string): Promise<string | null> {
  const rows = await tx
    .select({ id: academicYears.id, name: academicYears.name, isActive: academicYears.isActive })
    .from(academicYears)
    .for('update');
  const previous = rows.find((row) => row.isActive && row.id !== id);

  await tx
    .update(academicYears)
    .set({ isActive: false })
    .where(and(eq(academicYears.isActive, true), ne(academicYears.id, id)));
  await tx.update(academicYears).set({ isActive: true }).where(eq(academicYears.id, id));
  return previous?.name ?? null;
}

export async function createAcademicYear(
  input: NewAcademicYearInput,
  actor: Actor,
  executor: Executor = db,
): Promise<ServiceResult> {
  const values = { name: input.name, startDate: input.startDate, endDate: input.endDate };
  try {
    return await executor.transaction(async (tx) => {
      const [created] = await tx.insert(academicYears).values(values).returning({ id: academicYears.id });
      if (input.activate) await moveActiveFlag(tx, created.id);

      await writeAudit(tx, {
        actorId: actor.id,
        action: 'academic_year.create',
        entity: 'academic_years',
        entityId: created.id,
        metadata: { ...values, activated: input.activate },
      });
      return ok(created.id);
    });
  } catch (error) {
    const known = knownViolation(error, input.name);
    if (known) return known;
    throw error;
  }
}

export async function updateAcademicYear(
  id: string,
  input: AcademicYearInput,
  actor: Actor,
  executor: Executor = db,
): Promise<ServiceResult> {
  if (!isUuid(id)) return fail(NOT_FOUND);
  try {
    return await executor.transaction(async (tx) => {
      const [current] = await tx
        .select({ name: academicYears.name, startDate: academicYears.startDate, endDate: academicYears.endDate })
        .from(academicYears)
        .where(eq(academicYears.id, id))
        .for('update');
      if (!current) return fail(NOT_FOUND);

      const after = { name: input.name, startDate: input.startDate, endDate: input.endDate };
      await tx.update(academicYears).set(after).where(eq(academicYears.id, id));

      await writeAudit(tx, {
        actorId: actor.id,
        action: 'academic_year.update',
        entity: 'academic_years',
        entityId: id,
        metadata: { before: current, after },
      });
      return ok(id);
    });
  } catch (error) {
    const known = knownViolation(error, input.name);
    if (known) return known;
    throw error;
  }
}

export async function activateAcademicYear(id: string, actor: Actor, executor: Executor = db): Promise<ServiceResult> {
  if (!isUuid(id)) return fail(NOT_FOUND);
  try {
    return await executor.transaction(async (tx) => {
      const [target] = await tx
        .select({ name: academicYears.name, isActive: academicYears.isActive })
        .from(academicYears)
        .where(eq(academicYears.id, id));
      if (!target) return fail(NOT_FOUND);
      if (target.isActive) return ok(id);

      const previous = await moveActiveFlag(tx, id);
      await writeAudit(tx, {
        actorId: actor.id,
        action: 'academic_year.activate',
        entity: 'academic_years',
        entityId: id,
        metadata: { name: target.name, previous },
      });
      return ok(id);
    });
  } catch (error) {
    if (uniqueViolation(error) === 'one_active_academic_year') return fail(ACTIVE_RACE);
    throw error;
  }
}
```

- [ ] **Step 9: Jalankan uji dan pastikan lulus**

Run: `npx vitest run --config vitest.integration.config.ts tests/integration/academic-years.test.ts`
Expected: seluruh uji PASS, termasuk dua uji lama.

- [ ] **Step 10: Tulis uji Server Action yang gagal**

Buat `src/server/actions/academic-years.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDLE } from '@/lib/form-state';

const { mockRunFormAction, mockRunCommand, mockCreate, mockUpdate, mockActivate } = vi.hoisted(() => ({
  mockRunFormAction: vi.fn(),
  mockRunCommand: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockActivate: vi.fn(),
}));

vi.mock('@/server/forms/run-action', () => ({ runFormAction: mockRunFormAction, runCommand: mockRunCommand }));
vi.mock('@/server/services/academic-years', () => ({
  createAcademicYear: mockCreate,
  updateAcademicYear: mockUpdate,
  activateAcademicYear: mockActivate,
}));

import {
  activateAcademicYearAction, createAcademicYearAction, updateAcademicYearAction,
} from './academic-years';

const actor = { id: 'u1', role: 'admin' as const };
const data = { name: '2027/2028', startDate: '2027-07-01', endDate: '2028-06-30' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Server Action tahun ajaran', () => {
  it('createAcademicYearAction hanya untuk admin, lalu kembali ke daftar', async () => {
    await createAcademicYearAction(IDLE, new FormData());

    const options = mockRunFormAction.mock.calls[0]?.[0];
    expect(options.roles).toEqual(['admin']);
    expect(options.redirectTo).toBe('/pengaturan/tahun-ajaran');
    await options.execute({ ...data, activate: true }, actor);
    expect(mockCreate).toHaveBeenCalledWith({ ...data, activate: true }, actor);
  });

  it('updateAcademicYearAction meneruskan id ke service', async () => {
    await updateAcademicYearAction('y1', IDLE, new FormData());

    const options = mockRunFormAction.mock.calls[0]?.[0];
    expect(options.roles).toEqual(['admin']);
    await options.execute(data, actor);
    expect(mockUpdate).toHaveBeenCalledWith('y1', data, actor);
  });

  it('activateAcademicYearAction hanya untuk admin dan meneruskan id', async () => {
    await activateAcademicYearAction('y1', IDLE, new FormData());

    const options = mockRunCommand.mock.calls[0]?.[0];
    expect(options.roles).toEqual(['admin']);
    expect(options.revalidate).toEqual(['/pengaturan/tahun-ajaran']);
    await options.execute(actor);
    expect(mockActivate).toHaveBeenCalledWith('y1', actor);
  });
});
```

Run: `npx vitest run src/server/actions/academic-years.test.ts`
Expected: FAIL — modul `./academic-years` tidak ditemukan.

- [ ] **Step 11: Implementasikan Server Action**

Buat `src/server/actions/academic-years.ts`:

```ts
'use server';

import type { UserRole } from '@/domain/shared/types';
import type { FormState } from '@/lib/form-state';
import { runCommand, runFormAction } from '@/server/forms/run-action';
import {
  activateAcademicYear, createAcademicYear, updateAcademicYear,
} from '@/server/services/academic-years';
import { academicYearSchema, newAcademicYearSchema } from '@/server/validation/academic-year';

const ROLES: UserRole[] = ['admin'];
const LIST = '/pengaturan/tahun-ajaran';
const INVALID = 'Tahun ajaran belum dapat disimpan. Periksa kolom yang ditandai.';

export async function createAcademicYearAction(_state: FormState, formData: FormData): Promise<FormState> {
  return runFormAction({
    roles: ROLES,
    schema: newAcademicYearSchema,
    formData,
    invalidMessage: INVALID,
    execute: (data, actor) => createAcademicYear(data, actor),
    successMessage: 'Tahun ajaran berhasil ditambahkan.',
    revalidate: [LIST],
    redirectTo: LIST,
  });
}

export async function updateAcademicYearAction(id: string, _state: FormState, formData: FormData): Promise<FormState> {
  return runFormAction({
    roles: ROLES,
    schema: academicYearSchema,
    formData,
    invalidMessage: INVALID,
    execute: (data, actor) => updateAcademicYear(id, data, actor),
    successMessage: 'Perubahan tahun ajaran tersimpan.',
    revalidate: [LIST],
    redirectTo: LIST,
  });
}

/**
 * Top bar menampilkan tahun aktif di setiap halaman. revalidatePath dari
 * Server Action menyegarkan halaman yang sedang dibuka sekaligus halaman
 * lain saat dikunjungi lagi (revalidatePath.md § Good to know).
 */
export async function activateAcademicYearAction(
  id: string,
  _state: FormState,
  _formData: FormData,
): Promise<FormState> {
  return runCommand({
    roles: ROLES,
    execute: (actor) => activateAcademicYear(id, actor),
    successMessage: 'Tahun ajaran aktif diganti. Peminjaman baru tercatat di tahun ini.',
    revalidate: [LIST],
  });
}
```

Run: `npx vitest run src/server/actions/academic-years.test.ts`
Expected: PASS.

- [ ] **Step 12: Tulis uji halaman yang gagal**

Buat `src/app/(app)/pengaturan/tahun-ajaran/page.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockList, mockRequireProfile } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockRequireProfile: vi.fn(),
}));

vi.mock('@/server/queries/academic-years', () => ({ listAcademicYears: mockList }));
vi.mock('@/server/actions/academic-years', () => ({ activateAcademicYearAction: vi.fn() }));
vi.mock('@/server/auth/guard', () => ({ requireProfile: mockRequireProfile }));

import AcademicYearsPage from './page';

async function render(params: Record<string, string> = {}) {
  return renderToStaticMarkup(await AcademicYearsPage({ searchParams: Promise.resolve(params) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireProfile.mockResolvedValue({ id: 'u1', role: 'admin', fullName: 'Administrator', status: 'active' });
});

describe('AcademicYearsPage', () => {
  it('menampilkan tanggal dan menawarkan "Jadikan Aktif" hanya untuk tahun yang tidak aktif', async () => {
    mockList.mockResolvedValueOnce([
      { id: 'y2', name: '2027/2028', startDate: '2027-07-01', endDate: '2028-06-30', isActive: false },
      { id: 'y1', name: '2026/2027', startDate: '2026-07-01', endDate: '2027-06-30', isActive: true },
    ]);

    const html = await render({ pesan: 'Tahun ajaran berhasil ditambahkan.' });

    expect(html).toContain('01/07/2027');
    expect(html).toContain('30/06/2028');
    expect(html.split('Jadikan Aktif').length - 1).toBe(1);
    expect(html).toContain('href="/pengaturan/tahun-ajaran/y1"');
    expect(html).toContain('Tahun ajaran berhasil ditambahkan.');
  });

  it('menjelaskan langkah pertama bila belum ada tahun ajaran', async () => {
    mockList.mockResolvedValueOnce([]);
    expect(await render()).toContain('Belum ada tahun ajaran.');
  });

  it('menampilkan Akses ditolak untuk petugas tanpa membaca data', async () => {
    mockRequireProfile.mockResolvedValueOnce({ id: 'u2', role: 'petugas', fullName: 'Petugas', status: 'active' });

    const html = await render();

    expect(html).toContain('Akses ditolak');
    expect(mockList).not.toHaveBeenCalled();
  });
});
```

Buat `src/app/(app)/pengaturan/tahun-ajaran/baru/page.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockGetActive, mockRequireProfile } = vi.hoisted(() => ({
  mockGetActive: vi.fn(),
  mockRequireProfile: vi.fn(),
}));

vi.mock('@/server/queries/academic-years', () => ({ getActiveAcademicYear: mockGetActive }));
vi.mock('@/server/actions/academic-years', () => ({ createAcademicYearAction: vi.fn() }));
vi.mock('@/server/auth/guard', () => ({ requireProfile: mockRequireProfile }));

import NewAcademicYearPage from './page';

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireProfile.mockResolvedValue({ id: 'u1', role: 'admin', fullName: 'Administrator', status: 'active' });
});

describe('NewAcademicYearPage', () => {
  it('menyebut tahun aktif saat ini dan tidak mencentang "jadikan aktif"', async () => {
    mockGetActive.mockResolvedValueOnce({ id: 'y1', name: '2026/2027' });

    const html = renderToStaticMarkup(await NewAcademicYearPage());

    for (const name of ['name', 'startDate', 'endDate', 'activate']) expect(html).toContain(`name="${name}"`);
    expect(html).toContain('type="date"');
    expect(html).toContain('Tahun ajaran aktif saat ini 2026/2027');
    expect(html).not.toMatch(/type="checkbox"[^>]*checked=""/);
  });

  it('mencentang "jadikan aktif" bila belum ada tahun ajaran aktif', async () => {
    mockGetActive.mockResolvedValueOnce(null);

    const html = renderToStaticMarkup(await NewAcademicYearPage());

    expect(html).toMatch(/type="checkbox"[^>]*checked=""/);
    expect(html).toContain('Belum ada tahun ajaran aktif');
  });

  it('menampilkan Akses ditolak untuk petugas', async () => {
    mockRequireProfile.mockResolvedValueOnce({ id: 'u2', role: 'petugas', fullName: 'Petugas', status: 'active' });
    expect(renderToStaticMarkup(await NewAcademicYearPage())).toContain('Akses ditolak');
  });
});
```

Buat `src/app/(app)/pengaturan/tahun-ajaran/[id]/page.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockGet, mockRequireProfile, mockNotFound } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockRequireProfile: vi.fn(),
  mockNotFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('@/server/queries/academic-years', () => ({ getAcademicYear: mockGet }));
vi.mock('@/server/actions/academic-years', () => ({ updateAcademicYearAction: vi.fn() }));
vi.mock('@/server/auth/guard', () => ({ requireProfile: mockRequireProfile }));
vi.mock('next/navigation', () => ({ notFound: mockNotFound }));

import EditAcademicYearPage from './page';

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireProfile.mockResolvedValue({ id: 'u1', role: 'admin', fullName: 'Administrator', status: 'active' });
});

describe('EditAcademicYearPage', () => {
  it('mengisi form dengan data tahun ajaran dan menandai yang aktif', async () => {
    mockGet.mockResolvedValueOnce({
      id: 'y1', name: '2026/2027', startDate: '2026-07-01', endDate: '2027-06-30', isActive: true,
    });

    const html = renderToStaticMarkup(await EditAcademicYearPage({ params: Promise.resolve({ id: 'y1' }) }));

    expect(html).toContain('value="2026/2027"');
    expect(html).toContain('value="2026-07-01"');
    expect(html).toContain('tahun ajaran aktif');
  });

  it('menampilkan halaman tidak ditemukan untuk id yang tidak ada', async () => {
    mockGet.mockResolvedValueOnce(null);
    await expect(EditAcademicYearPage({ params: Promise.resolve({ id: 'x' }) })).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('menampilkan Akses ditolak untuk petugas tanpa membaca data', async () => {
    mockRequireProfile.mockResolvedValueOnce({ id: 'u2', role: 'petugas', fullName: 'Petugas', status: 'active' });

    const html = renderToStaticMarkup(await EditAcademicYearPage({ params: Promise.resolve({ id: 'y1' }) }));

    expect(html).toContain('Akses ditolak');
    expect(mockGet).not.toHaveBeenCalled();
  });
});
```

Run: `npx vitest run "src/app/(app)/pengaturan/tahun-ajaran"`
Expected: FAIL — modul halaman tidak ditemukan.

- [ ] **Step 13: Implementasikan halaman**

Buat `src/app/(app)/pengaturan/tahun-ajaran/academic-year-fields.tsx`:

```tsx
import { TextField } from '@/components/ui/fields';
import type { AcademicYear } from '@/server/queries/academic-years';

/** Kolom form tahun ajaran, dipakai bersama halaman tambah dan ubah. */
export function AcademicYearFields({ year }: { year?: AcademicYear }) {
  return (
    <>
      <TextField
        name="name"
        label="Nama tahun ajaran"
        defaultValue={year?.name}
        required
        autoFocus={!year}
        maxLength={20}
        hint="Dua tahun berurutan, misalnya 2026/2027."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="startDate" label="Tanggal mulai" type="date" defaultValue={year?.startDate} required />
        <TextField name="endDate" label="Tanggal selesai" type="date" defaultValue={year?.endDate} required />
      </div>
    </>
  );
}
```

Buat `src/app/(app)/pengaturan/tahun-ajaran/page.tsx`:

```tsx
import Link from 'next/link';
import { AccessDenied } from '@/components/ui/access-denied';
import { ActionButton } from '@/components/ui/action-button';
import { buttonClass } from '@/components/ui/button-styles';
import { Flash } from '@/components/ui/flash';
import { PageHeader } from '@/components/ui/page-header';
import { RecordStatusBadge } from '@/components/ui/record-status-badge';
import { ScrollTable } from '@/components/ui/scroll-table';
import { TD, TH } from '@/components/ui/table-styles';
import { formatDate } from '@/lib/format';
import { firstValue, type SearchParams } from '@/lib/search-params';
import { activateAcademicYearAction } from '@/server/actions/academic-years';
import { requireProfile } from '@/server/auth/guard';
import { listAcademicYears } from '@/server/queries/academic-years';

export default async function AcademicYearsPage({ searchParams }: { searchParams: SearchParams }) {
  const profile = await requireProfile();
  if (profile.role !== 'admin') return <AccessDenied />;
  const params = await searchParams;
  const years = await listAcademicYears();

  return (
    <>
      <PageHeader
        title="Tahun Ajaran"
        description="Tepat satu tahun ajaran aktif. Setiap peminjaman tercatat di tahun ajaran yang aktif saat itu."
        actions={<Link href="/pengaturan/tahun-ajaran/baru" className={buttonClass('primary')}>Tambah Tahun Ajaran</Link>}
      />
      <Flash message={firstValue(params.pesan)} />

      <ScrollTable>
        <thead>
          <tr>
            <th className={TH}>Nama</th>
            <th className={TH}>Mulai</th>
            <th className={TH}>Selesai</th>
            <th className={TH}>Status</th>
            <th className={TH}><span className="sr-only">Aksi</span></th>
          </tr>
        </thead>
        <tbody>
          {years.length === 0 && (
            <tr>
              <td colSpan={5} className={`${TD} text-center text-[var(--color-ink-500)]`}>
                Belum ada tahun ajaran. Tambahkan satu dan jadikan aktif agar peminjaman dapat dibuat.
              </td>
            </tr>
          )}
          {years.map((year) => (
            <tr key={year.id}>
              <td className={`${TD} font-medium`}>{year.name}</td>
              <td className={`${TD} tabular-nums`}>{formatDate(year.startDate)}</td>
              <td className={`${TD} tabular-nums`}>{formatDate(year.endDate)}</td>
              <td className={TD}><RecordStatusBadge status={year.isActive ? 'active' : 'inactive'} /></td>
              <td className={TD}>
                <div className="flex items-start justify-end gap-2">
                  <Link href={`/pengaturan/tahun-ajaran/${year.id}`} className={buttonClass('secondary', 'sm')}>Ubah</Link>
                  {!year.isActive && (
                    <ActionButton
                      action={activateAcademicYearAction.bind(null, year.id)}
                      label="Jadikan Aktif"
                      confirmText={`Jadikan ${year.name} tahun ajaran aktif? Peminjaman baru akan tercatat di tahun ini.`}
                    />
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </ScrollTable>
    </>
  );
}
```

Buat `src/app/(app)/pengaturan/tahun-ajaran/baru/page.tsx`:

```tsx
import { AccessDenied } from '@/components/ui/access-denied';
import { ActionForm } from '@/components/ui/action-form';
import { CheckboxField } from '@/components/ui/fields';
import { PageHeader } from '@/components/ui/page-header';
import { createAcademicYearAction } from '@/server/actions/academic-years';
import { requireProfile } from '@/server/auth/guard';
import { getActiveAcademicYear } from '@/server/queries/academic-years';
import { AcademicYearFields } from '../academic-year-fields';

export default async function NewAcademicYearPage() {
  const profile = await requireProfile();
  if (profile.role !== 'admin') return <AccessDenied />;
  const active = await getActiveAcademicYear();

  return (
    <>
      <PageHeader title="Tambah Tahun Ajaran" />
      <ActionForm action={createAcademicYearAction} submitLabel="Simpan Tahun Ajaran" cancelHref="/pengaturan/tahun-ajaran">
        <AcademicYearFields />
        <CheckboxField
          name="activate"
          label="Jadikan tahun ajaran aktif sekarang"
          defaultChecked={!active}
          hint={
            active
              ? `Tahun ajaran aktif saat ini ${active.name}. Bila dicentang, peminjaman baru tercatat di tahun yang baru.`
              : 'Belum ada tahun ajaran aktif. Tanpa tahun aktif, peminjaman tidak dapat dibuat.'
          }
        />
      </ActionForm>
    </>
  );
}
```

Buat `src/app/(app)/pengaturan/tahun-ajaran/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { AccessDenied } from '@/components/ui/access-denied';
import { ActionForm } from '@/components/ui/action-form';
import { PageHeader } from '@/components/ui/page-header';
import { updateAcademicYearAction } from '@/server/actions/academic-years';
import { requireProfile } from '@/server/auth/guard';
import { getAcademicYear } from '@/server/queries/academic-years';
import { AcademicYearFields } from '../academic-year-fields';

export default async function EditAcademicYearPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile();
  if (profile.role !== 'admin') return <AccessDenied />;
  const { id } = await params;
  const year = await getAcademicYear(id);
  if (!year) notFound();

  return (
    <>
      <PageHeader
        title="Ubah Tahun Ajaran"
        description={year.isActive ? `${year.name} · tahun ajaran aktif` : year.name}
      />
      <ActionForm
        action={updateAcademicYearAction.bind(null, year.id)}
        submitLabel="Simpan Perubahan"
        cancelHref="/pengaturan/tahun-ajaran"
      >
        <AcademicYearFields year={year} />
      </ActionForm>
    </>
  );
}
```

- [ ] **Step 14: Jalankan uji halaman dan pastikan lulus**

Run: `npx vitest run "src/app/(app)/pengaturan/tahun-ajaran"`
Expected: PASS.

- [ ] **Step 15: Tulis uji form siswa tanpa tahun ajaran aktif yang gagal**

Ganti seluruh isi `src/app/(app)/master/siswa/baru/page.test.tsx` dengan:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockGetActive } = vi.hoisted(() => ({ mockGetActive: vi.fn() }));

vi.mock('@/server/actions/students', () => ({ createStudentAction: vi.fn() }));
vi.mock('@/server/queries/academic-years', () => ({
  listAcademicYearOptions: vi.fn(async () => [
    { value: 'y1', label: '2026/2027 (aktif)' },
    { value: 'y0', label: '2025/2026' },
  ]),
  getActiveAcademicYear: mockGetActive,
}));
vi.mock('@/server/auth/guard', () => ({
  requireProfile: vi.fn(async () => ({ id: 'u1', role: 'petugas', fullName: 'Petugas', status: 'active' })),
}));

import NewStudentPage from './page';

beforeEach(() => {
  mockGetActive.mockResolvedValue({ id: 'y1', name: '2026/2027' });
});

describe('NewStudentPage', () => {
  it('menampilkan seluruh kolom siswa dengan tahun ajaran aktif terpilih', async () => {
    const html = renderToStaticMarkup(await NewStudentPage());
    for (const name of ['nis', 'name', 'className', 'major', 'gender', 'phone', 'academicYearId']) {
      expect(html).toContain(`name="${name}"`);
    }
    expect(html).toMatch(/<option value="y1" selected="">2026\/2027 \(aktif\)<\/option>/);
  });

  it('tidak menawarkan opsi "tanpa tahun ajaran" karena tahun aktif sudah terpilih', async () => {
    const html = renderToStaticMarkup(await NewStudentPage());
    expect(html).not.toContain('Tanpa tahun ajaran');
  });

  it('tidak diam-diam memilih tahun lama bila belum ada tahun ajaran aktif', async () => {
    mockGetActive.mockResolvedValueOnce(null);

    const html = renderToStaticMarkup(await NewStudentPage());

    expect(html).toMatch(/<option value="" selected="">— Tanpa tahun ajaran —<\/option>/);
    expect(html).toContain('Belum ada tahun ajaran aktif. Admin dapat mengaktifkannya di Pengaturan → Tahun Ajaran.');
  });
});
```

Run: `npx vitest run "src/app/(app)/master/siswa/baru"`
Expected: FAIL pada uji ketiga — tanpa opsi kosong, peramban memilih opsi pertama (tahun lama) secara diam-diam.

- [ ] **Step 16: Perbaiki kolom tahun ajaran di form siswa**

Di `src/app/(app)/master/siswa/student-fields.tsx`, ganti `SelectField` tahun ajaran (elemen terakhir) dengan:

```tsx
      <SelectField
        name="academicYearId"
        label="Tahun ajaran"
        placeholder={student || noActiveYear ? '— Tanpa tahun ajaran —' : undefined}
        hint={noActiveYear ? 'Belum ada tahun ajaran aktif. Admin dapat mengaktifkannya di Pengaturan → Tahun Ajaran.' : undefined}
        defaultValue={student?.academicYearId ?? defaultYearId ?? ''}
        options={yearOptions}
      />
```

Dan tambahkan baris ini tepat sebelum `return (` di fungsi `StudentFields`:

```tsx
  // Tanpa opsi kosong, peramban memilih opsi pertama — tahun ajaran lama —
  // dan siswa baru tercatat di tahun yang salah tanpa ada yang menyadarinya.
  const noActiveYear = !student && !defaultYearId;
```

- [ ] **Step 17: Jalankan seluruh uji unit, uji integrasi tahun ajaran, dan lint**

Run: `npm test && npx vitest run --config vitest.integration.config.ts tests/integration/academic-years.test.ts tests/integration/students.test.ts && npm run lint`
Expected: seluruhnya PASS, lint bersih.

- [ ] **Step 18: Commit**

```bash
git add src/server/validation/academic-year.ts src/server/validation/academic-year.test.ts \
  src/server/services/academic-years.ts src/server/queries/academic-years.ts tests/integration/academic-years.test.ts \
  src/server/actions/academic-years.ts src/server/actions/academic-years.test.ts \
  "src/app/(app)/pengaturan/tahun-ajaran" \
  "src/app/(app)/master/siswa/student-fields.tsx" "src/app/(app)/master/siswa/baru/page.test.tsx"
git commit -m "$(cat <<'EOF'
feat(pengaturan): kelola tahun ajaran dan pindahkan tahun aktif

Form tambah siswa kini menawarkan "tanpa tahun ajaran" bila belum ada
tahun aktif, alih-alih diam-diam memilih tahun lama.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Konfigurasi Perpustakaan

Admin mengubah aturan peminjaman (BR-09: tanpa menyentuh kode) dan isi struk. Konfigurasi hanya satu baris (`library_settings.id = 1`). `getLibrarySettings()` di task ini adalah satu-satunya pintu baca konfigurasi, dan Rencana 04 memakainya untuk `validateLoanRequest()` dan `calculateItemFine()`.

**Files:**
- Create: `src/server/validation/settings.ts`, `src/server/validation/settings.test.ts`
- Create: `src/server/queries/settings.ts`, `src/server/services/settings.ts`, `tests/integration/settings.test.ts`
- Create: `src/server/actions/settings.ts`, `src/server/actions/settings.test.ts`
- Create: `src/app/(app)/pengaturan/konfigurasi/page.tsx`, `page.test.tsx`

**Interfaces:**
- Consumes: `requiredInteger`, `requiredText`, `optionalText`, `rupiah`, `checkbox`; `DEFAULT_SETTINGS` dan `LibrarySettings` dari domain; `writeAudit` (tanpa `entityId`); `CheckboxField`, `TextField`, `TextAreaField`; `AccessDenied`
- Produces:
  - `settingsSchema`; `type SettingsInput = Settings` (bentuk keluarannya sama persis)
  - `interface Settings extends LibrarySettings { schoolName: string | null; receiptFooter: string | null }`
  - `getLibrarySettings(executor?): Promise<Settings>` — `finePerDay` bertipe `number`; nilai bawaan domain bila baris belum ada
  - `updateLibrarySettings(input: SettingsInput, actor: Actor, executor?): Promise<ServiceResult>`
  - Server Action `updateSettingsAction(state, formData)`
  - Audit: `settings.update` (entity `library_settings`, `entity_id` kosong, metadata `{ before, after }`)

- [ ] **Step 1: Tulis uji validasi yang gagal**

Buat `src/server/validation/settings.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { settingsSchema } from './settings';

const valid = {
  maxActiveLoans: '3',
  loanDurationDays: '3',
  finePerDay: '1.000',
  blockWhenOverdue: 'on',
  blockWhenUnpaidFine: 'off',
  schoolName: ' SMK Negeri 1 Contoh ',
  receiptFooter: '',
};

function messagesOf(result: z.ZodSafeParseResult<unknown>): string[] {
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe('settingsSchema', () => {
  it('mengubah isian form menjadi konfigurasi bertipe', () => {
    expect(settingsSchema.parse(valid)).toEqual({
      maxActiveLoans: 3,
      loanDurationDays: 3,
      finePerDay: 1000,
      blockWhenOverdue: true,
      blockWhenUnpaidFine: false,
      schoolName: 'SMK Negeri 1 Contoh',
      receiptFooter: null,
    });
  });

  it('menerima denda nol, tetapi tidak menerima denda kosong', () => {
    expect(settingsSchema.parse({ ...valid, finePerDay: '0' }).finePerDay).toBe(0);
    expect(messagesOf(settingsSchema.safeParse({ ...valid, finePerDay: '' }))).toEqual([
      'Denda per hari wajib diisi. Tulis 0 bila tidak ada denda.',
    ]);
  });

  it('menolak denda di atas satu juta dan batas di luar rentang', () => {
    expect(messagesOf(settingsSchema.safeParse({
      ...valid, finePerDay: '2.000.000', maxActiveLoans: '0', loanDurationDays: '91',
    }))).toEqual([
      'Batas pinjam harus bilangan bulat 1 sampai 20.',
      'Durasi pinjam harus bilangan bulat 1 sampai 90 hari.',
      'Denda per hari harus nominal rupiah 0 sampai 1.000.000.',
    ]);
  });

  it('mewajibkan nama sekolah karena dicetak di struk', () => {
    expect(messagesOf(settingsSchema.safeParse({ ...valid, schoolName: ' ' }))).toEqual([
      'Nama sekolah wajib diisi; dicetak di struk peminjaman.',
    ]);
  });
});
```

Run: `npx vitest run src/server/validation/settings.test.ts`
Expected: FAIL — modul `./settings` tidak ditemukan.

- [ ] **Step 2: Implementasikan validasi**

Buat `src/server/validation/settings.ts`:

```ts
import { z } from 'zod';
import { checkbox, optionalText, requiredInteger, requiredText, rupiah } from './common';

const FINE = 'Denda per hari harus nominal rupiah 0 sampai 1.000.000.';

export const settingsSchema = z.object({
  maxActiveLoans: requiredInteger('Batas pinjam harus bilangan bulat 1 sampai 20.', 1, 20),
  loanDurationDays: requiredInteger('Durasi pinjam harus bilangan bulat 1 sampai 90 hari.', 1, 90),
  // Wajib diisi, tidak seperti harga buku: denda kosong yang diam-diam
  // menjadi nol akan mematikan denda tanpa ada yang menyadarinya.
  finePerDay: requiredText('Denda per hari wajib diisi. Tulis 0 bila tidak ada denda.', 20)
    .pipe(rupiah(FINE))
    .pipe(z.number().max(1_000_000, FINE)),
  blockWhenOverdue: checkbox(),
  blockWhenUnpaidFine: checkbox(),
  schoolName: requiredText('Nama sekolah wajib diisi; dicetak di struk peminjaman.', 150),
  receiptFooter: optionalText(300),
});

export type SettingsInput = z.output<typeof settingsSchema>;
```

Run: `npx vitest run src/server/validation/settings.test.ts`
Expected: PASS.

- [ ] **Step 3: Tulis uji integrasi yang gagal**

Buat `tests/integration/settings.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { desc, eq } from 'drizzle-orm';
import { DEFAULT_SETTINGS } from '@/domain/loan/rules';
import { auditLogs, librarySettings } from '@/server/db/schema';
import { getLibrarySettings } from '@/server/queries/settings';
import { updateLibrarySettings } from '@/server/services/settings';
import { testActor, withRollback } from './helpers';

const input = {
  maxActiveLoans: 2,
  loanDurationDays: 7,
  finePerDay: 1500,
  blockWhenOverdue: false,
  blockWhenUnpaidFine: true,
  schoolName: 'UJI-SMK Negeri 1 Contoh',
  receiptFooter: 'UJI-Terima kasih.',
};

describe('getLibrarySettings', () => {
  it('memakai nilai bawaan domain bila baris konfigurasi belum ada', async () => {
    await withRollback(async (tx) => {
      await tx.delete(librarySettings).where(eq(librarySettings.id, 1));

      expect(await getLibrarySettings(tx)).toEqual({ ...DEFAULT_SETTINGS, schoolName: null, receiptFooter: null });
    });
  });
});

describe('updateLibrarySettings', () => {
  it('menyimpan konfigurasi, mencatat pengubahnya, dan menulis audit sebelum-sesudah', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const before = await getLibrarySettings(tx);

      expect((await updateLibrarySettings(input, actor, tx)).ok).toBe(true);

      expect(await getLibrarySettings(tx)).toEqual(input);
      const [row] = await tx.select({ updatedBy: librarySettings.updatedBy }).from(librarySettings);
      expect(row?.updatedBy).toBe(actor.id);

      const [audit] = await tx
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.action, 'settings.update'))
        .orderBy(desc(auditLogs.createdAt))
        .limit(1);
      expect(audit).toMatchObject({ userId: actor.id, entity: 'library_settings', entityId: null });
      expect(audit?.metadata).toEqual({ before, after: input });
    });
  });

  it('membuat baris konfigurasi bila belum ada', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      await tx.delete(librarySettings).where(eq(librarySettings.id, 1));

      expect((await updateLibrarySettings(input, actor, tx)).ok).toBe(true);

      expect(await getLibrarySettings(tx)).toEqual(input);
      const [audit] = await tx
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.action, 'settings.update'))
        .orderBy(desc(auditLogs.createdAt))
        .limit(1);
      expect(audit?.metadata).toEqual({ before: null, after: input });
    });
  });
});
```

Run: `npx vitest run --config vitest.integration.config.ts tests/integration/settings.test.ts`
Expected: FAIL — modul `@/server/queries/settings` tidak ditemukan.

- [ ] **Step 4: Implementasikan query dan service**

Buat `src/server/queries/settings.ts`:

```ts
import { eq } from 'drizzle-orm';
import { DEFAULT_SETTINGS } from '@/domain/loan/rules';
import type { LibrarySettings } from '@/domain/shared/types';
import { db } from '@/server/db/client';
import type { Executor } from '@/server/db/executor';
import { librarySettings } from '@/server/db/schema';

/** Aturan peminjaman ditambah isi struk. */
export interface Settings extends LibrarySettings {
  schoolName: string | null;
  receiptFooter: string | null;
}

export const settingsColumns = {
  maxActiveLoans: librarySettings.maxActiveLoans,
  loanDurationDays: librarySettings.loanDurationDays,
  finePerDay: librarySettings.finePerDay,
  blockWhenOverdue: librarySettings.blockWhenOverdue,
  blockWhenUnpaidFine: librarySettings.blockWhenUnpaidFine,
  schoolName: librarySettings.schoolName,
  receiptFooter: librarySettings.receiptFooter,
};

/** Bentuk baris hasil `select(settingsColumns)`: sama dengan Settings, kecuali `numeric` yang dibaca sebagai untai. */
type SettingsRow = Omit<Settings, 'finePerDay'> & { finePerDay: string };

/** `numeric` dibaca Postgres sebagai untai ('1000.00'); aturan domain butuh bilangan. */
export function toSettings(row: SettingsRow): Settings {
  return { ...row, finePerDay: Number(row.finePerDay) };
}

/**
 * Satu-satunya pintu baca konfigurasi. Bila skrip seed belum pernah
 * dijalankan, aturan bawaan domain (spec 1.1) tetap berlaku, sehingga
 * peminjaman tidak gagal hanya karena barisnya belum ada.
 */
export async function getLibrarySettings(executor: Executor = db): Promise<Settings> {
  const [row] = await executor.select(settingsColumns).from(librarySettings).where(eq(librarySettings.id, 1)).limit(1);
  if (!row) return { ...DEFAULT_SETTINGS, schoolName: null, receiptFooter: null };
  return toSettings(row);
}
```

Buat `src/server/services/settings.ts`:

```ts
import { eq } from 'drizzle-orm';
import type { Actor } from '@/domain/shared/types';
import { writeAudit } from '@/server/audit';
import { db } from '@/server/db/client';
import type { Executor } from '@/server/db/executor';
import { librarySettings } from '@/server/db/schema';
import { settingsColumns, toSettings } from '@/server/queries/settings';
import type { SettingsInput } from '@/server/validation/settings';
import { ok, type ServiceResult } from './result';

/** Konfigurasi hanya satu baris; `id` hasilnya tidak dipakai pemanggil. */
const SETTINGS_ID = 1;

export async function updateLibrarySettings(
  input: SettingsInput,
  actor: Actor,
  executor: Executor = db,
): Promise<ServiceResult> {
  return executor.transaction(async (tx) => {
    const [current] = await tx
      .select(settingsColumns)
      .from(librarySettings)
      .where(eq(librarySettings.id, SETTINGS_ID))
      .for('update');

    const values = {
      ...input,
      finePerDay: String(input.finePerDay),
      updatedBy: actor.id,
      updatedAt: new Date(),
    };
    // Upsert: baris dibuat bila skrip seed belum pernah dijalankan.
    await tx
      .insert(librarySettings)
      .values({ id: SETTINGS_ID, ...values })
      .onConflictDoUpdate({ target: librarySettings.id, set: values });

    await writeAudit(tx, {
      actorId: actor.id,
      action: 'settings.update',
      entity: 'library_settings',
      // Nilai sebelum dibaca lewat toSettings agar denda tercatat sebagai
      // bilangan di kedua sisi, bukan '1000.00' di satu sisi dan 1000 di sisi lain.
      metadata: { before: current ? toSettings(current) : null, after: { ...input } },
    });
    return ok(String(SETTINGS_ID));
  });
}
```

- [ ] **Step 5: Jalankan uji integrasi dan pastikan lulus**

Run: `npx vitest run --config vitest.integration.config.ts tests/integration/settings.test.ts`
Expected: PASS.

- [ ] **Step 6: Tulis uji Server Action dan halaman yang gagal**

Buat `src/server/actions/settings.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDLE } from '@/lib/form-state';

const { mockRunFormAction, mockUpdate } = vi.hoisted(() => ({
  mockRunFormAction: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock('@/server/forms/run-action', () => ({ runFormAction: mockRunFormAction }));
vi.mock('@/server/services/settings', () => ({ updateLibrarySettings: mockUpdate }));

import { updateSettingsAction } from './settings';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('updateSettingsAction', () => {
  it('hanya untuk admin, tetap di halaman yang sama, dan meneruskan data ke service', async () => {
    await updateSettingsAction(IDLE, new FormData());

    const options = mockRunFormAction.mock.calls[0]?.[0];
    expect(options.roles).toEqual(['admin']);
    expect(options.redirectTo).toBeUndefined();
    expect(options.revalidate).toEqual(['/pengaturan/konfigurasi']);

    const actor = { id: 'u1', role: 'admin' as const };
    const data = { maxActiveLoans: 3 };
    await options.execute(data, actor);
    expect(mockUpdate).toHaveBeenCalledWith(data, actor);
  });
});
```

Buat `src/app/(app)/pengaturan/konfigurasi/page.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockGet, mockRequireProfile } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockRequireProfile: vi.fn(),
}));

vi.mock('@/server/queries/settings', () => ({ getLibrarySettings: mockGet }));
vi.mock('@/server/actions/settings', () => ({ updateSettingsAction: vi.fn() }));
vi.mock('@/server/auth/guard', () => ({ requireProfile: mockRequireProfile }));

import SettingsPage from './page';

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireProfile.mockResolvedValue({ id: 'u1', role: 'admin', fullName: 'Administrator', status: 'active' });
});

describe('SettingsPage', () => {
  it('mengisi form dengan konfigurasi saat ini', async () => {
    mockGet.mockResolvedValueOnce({
      maxActiveLoans: 3,
      loanDurationDays: 7,
      finePerDay: 1500,
      blockWhenOverdue: false,
      blockWhenUnpaidFine: false,
      schoolName: 'SMK Negeri 1 Contoh',
      receiptFooter: 'Terima kasih.',
    });

    const html = renderToStaticMarkup(await SettingsPage());

    expect(html).toContain('value="7"');
    expect(html).toContain('value="1500"');
    expect(html).toContain('value="SMK Negeri 1 Contoh"');
    expect(html).toContain('Terima kasih.');
    expect(html).not.toMatch(/checked=""/);
    for (const name of ['blockWhenOverdue', 'blockWhenUnpaidFine']) {
      expect(html).toContain(`<input type="hidden" name="${name}" value="off"/>`);
    }
  });

  it('menampilkan Akses ditolak untuk petugas tanpa membaca konfigurasi', async () => {
    mockRequireProfile.mockResolvedValueOnce({ id: 'u2', role: 'petugas', fullName: 'Petugas', status: 'active' });

    const html = renderToStaticMarkup(await SettingsPage());

    expect(html).toContain('Akses ditolak');
    expect(mockGet).not.toHaveBeenCalled();
  });
});
```

Run: `npx vitest run src/server/actions/settings.test.ts "src/app/(app)/pengaturan/konfigurasi"`
Expected: FAIL — modul tidak ditemukan.

- [ ] **Step 7: Implementasikan Server Action dan halaman**

Buat `src/server/actions/settings.ts`:

```ts
'use server';

import type { FormState } from '@/lib/form-state';
import { runFormAction } from '@/server/forms/run-action';
import { updateLibrarySettings } from '@/server/services/settings';
import { settingsSchema } from '@/server/validation/settings';

export async function updateSettingsAction(_state: FormState, formData: FormData): Promise<FormState> {
  return runFormAction({
    roles: ['admin'],
    schema: settingsSchema,
    formData,
    invalidMessage: 'Konfigurasi belum dapat disimpan. Periksa kolom yang ditandai.',
    execute: (data, actor) => updateLibrarySettings(data, actor),
    successMessage: 'Konfigurasi tersimpan. Aturan baru berlaku untuk transaksi berikutnya.',
    revalidate: ['/pengaturan/konfigurasi'],
  });
}
```

Buat `src/app/(app)/pengaturan/konfigurasi/page.tsx`:

```tsx
import { AccessDenied } from '@/components/ui/access-denied';
import { ActionForm } from '@/components/ui/action-form';
import { CheckboxField, TextAreaField, TextField } from '@/components/ui/fields';
import { PageHeader } from '@/components/ui/page-header';
import { updateSettingsAction } from '@/server/actions/settings';
import { requireProfile } from '@/server/auth/guard';
import { getLibrarySettings } from '@/server/queries/settings';

const LEGEND = 'mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-500)]';

export default async function SettingsPage() {
  const profile = await requireProfile();
  if (profile.role !== 'admin') return <AccessDenied />;
  const settings = await getLibrarySettings();

  return (
    <>
      <PageHeader
        title="Konfigurasi"
        description="Aturan peminjaman dan isi struk. Perubahan berlaku untuk transaksi berikutnya."
      />
      <ActionForm action={updateSettingsAction} submitLabel="Simpan Konfigurasi">
        <fieldset className="space-y-4">
          <legend className={LEGEND}>Aturan peminjaman</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField
              name="maxActiveLoans"
              label="Batas pinjam per siswa"
              type="number"
              inputMode="numeric"
              required
              defaultValue={String(settings.maxActiveLoans)}
              hint="Eksemplar yang boleh dipinjam sekaligus."
            />
            <TextField
              name="loanDurationDays"
              label="Durasi pinjam (hari)"
              type="number"
              inputMode="numeric"
              required
              defaultValue={String(settings.loanDurationDays)}
              hint="Jatuh tempo pinjaman yang sudah berjalan tidak berubah."
            />
            <TextField
              name="finePerDay"
              label="Denda per hari (Rp)"
              inputMode="numeric"
              required
              defaultValue={String(settings.finePerDay)}
              hint="Per eksemplar. Berlaku untuk setiap pengembalian berikutnya."
            />
          </div>
          <CheckboxField
            name="blockWhenOverdue"
            label="Tolak peminjaman baru bila siswa punya pinjaman terlambat"
            defaultChecked={settings.blockWhenOverdue}
            hint="Aturan bawaan. Matikan hanya bila pengelola perpustakaan memutuskan demikian."
          />
          <CheckboxField
            name="blockWhenUnpaidFine"
            label="Tolak peminjaman baru bila siswa punya denda belum lunas"
            defaultChecked={settings.blockWhenUnpaidFine}
            hint="Mati secara bawaan: tunggakan tetap dicatat, tetapi tidak menghalangi peminjaman."
          />
        </fieldset>
        <fieldset className="space-y-4 pt-2">
          <legend className={LEGEND}>Struk peminjaman</legend>
          <TextField
            name="schoolName"
            label="Nama sekolah"
            required
            maxLength={150}
            defaultValue={settings.schoolName ?? ''}
          />
          <TextAreaField
            name="receiptFooter"
            label="Catatan kaki struk"
            defaultValue={settings.receiptFooter ?? ''}
            hint="Dicetak di bagian bawah struk, misalnya pengingat jatuh tempo."
          />
        </fieldset>
      </ActionForm>
    </>
  );
}
```

- [ ] **Step 8: Jalankan seluruh uji unit, uji integrasi konfigurasi, dan lint**

Run: `npm test && npx vitest run --config vitest.integration.config.ts tests/integration/settings.test.ts && npm run lint && npx tsc --noEmit`
Expected: seluruhnya PASS, lint dan tsc bersih.

- [ ] **Step 9: Commit**

```bash
git add src/server/validation/settings.ts src/server/validation/settings.test.ts \
  src/server/queries/settings.ts src/server/services/settings.ts tests/integration/settings.test.ts \
  src/server/actions/settings.ts src/server/actions/settings.test.ts \
  "src/app/(app)/pengaturan/konfigurasi"
git commit -m "$(cat <<'EOF'
feat(pengaturan): konfigurasi aturan peminjaman dan isi struk

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Layanan Akun Pengguna

Lapisan server manajemen pengguna. Membuat pengguna menyentuh dua sistem: Supabase Auth (akun dan kata sandi) dan tabel `profiles` (nama, peran, status). Keduanya tidak berbagi transaksi, jadi service mengurutkan langkahnya agar kegagalan di tengah tidak meninggalkan akun yatim, dan menolak perubahan yang dapat mengunci admin dari sistemnya sendiri.

Service menerima port `AuthAdmin`, bukan memanggil Supabase langsung. Server Action memberinya `supabaseAuthAdmin()`; uji integrasi memberinya `fakeAuthAdmin(tx)`.

**Files:**
- Create: `src/server/auth/auth-admin.ts`, `src/server/auth/auth-admin.test.ts`
- Modify: `src/server/auth/username.ts` (ekspor pola)
- Create: `src/server/validation/user.ts`, `src/server/validation/user.test.ts`
- Create: `src/server/queries/users.ts`, `src/server/services/users.ts`
- Modify: `tests/integration/helpers.ts` (tambah `fakeAuthAdmin`)
- Create: `tests/integration/users.test.ts`
- Modify: `README.md` (bagian Uji)

**Interfaces:**
- Consumes: `usernameToEmail` (username.ts); `requiredText`, `isUuid`; `writeAudit`; `uniqueViolation`; `ok`/`fail`; `withRollback`, `testActor`
- Produces:
  - `type AuthAdminResult = { ok: true; id: string } | { ok: false; code: string | null; message: string }`
  - `interface AuthAdmin { createUser(email, password): Promise<AuthAdminResult>; setPassword(userId, password): Promise<AuthAdminResult>; deleteUser(userId): Promise<void> }`
  - `supabaseAuthAdmin(): AuthAdmin`
  - `VALID_USERNAME: RegExp` (diekspor dari username.ts)
  - `newUserSchema`, `userSchema`, `passwordSchema`; `NewUserInput = { username; fullName; role: UserRole; password; passwordConfirm }`, `UserInput = { fullName; role: UserRole }`, `PasswordInput = { password; passwordConfirm }`
  - `interface User { id: string; username: string; fullName: string; role: UserRole; status: RecordStatus }`
  - `listUsers(executor?): Promise<User[]>`, `getUser(id: string, executor?): Promise<User | null>`
  - `createUser(input: NewUserInput, actor: Actor, auth: AuthAdmin, executor?): Promise<ServiceResult>`
  - `updateUser(id: string, input: UserInput, actor: Actor, executor?): Promise<ServiceResult>`
  - `setUserStatus(id: string, status: RecordStatus, actor: Actor, executor?): Promise<ServiceResult>`
  - `resetUserPassword(id: string, input: PasswordInput, actor: Actor, auth: AuthAdmin, executor?): Promise<ServiceResult>`
  - `fakeAuthAdmin(tx, options?): FakeAuthAdmin` di `tests/integration/helpers.ts`
  - Audit: `user.create`, `user.update`, `user.activate`, `user.deactivate`, `user.reset_password` (entity `profiles`; tanpa kata sandi)

- [ ] **Step 1: Tulis uji port Supabase yang gagal**

Buat `src/server/auth/auth-admin.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockCreateUser, mockUpdateUserById, mockDeleteUser, mockCreateClient } = vi.hoisted(() => {
  const mockCreateUser = vi.fn();
  const mockUpdateUserById = vi.fn();
  const mockDeleteUser = vi.fn();
  return {
    mockCreateUser,
    mockUpdateUserById,
    mockDeleteUser,
    mockCreateClient: vi.fn(() => ({
      auth: { admin: { createUser: mockCreateUser, updateUserById: mockUpdateUserById, deleteUser: mockDeleteUser } },
    })),
  };
});

vi.mock('@supabase/supabase-js', () => ({ createClient: mockCreateClient }));

import { supabaseAuthAdmin } from './auth-admin';

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('supabaseAuthAdmin', () => {
  it('memakai service role tanpa menyimpan sesi', () => {
    supabaseAuthAdmin();
    expect(mockCreateClient.mock.calls[0]?.[2]).toEqual({ auth: { autoRefreshToken: false, persistSession: false } });
  });

  it('membuat akun yang langsung terkonfirmasi dan mengembalikan id-nya', async () => {
    mockCreateUser.mockResolvedValueOnce({ data: { user: { id: 'a1' } }, error: null });

    expect(await supabaseAuthAdmin().createUser('siti@perpus.local', 'rahasia123')).toEqual({ ok: true, id: 'a1' });
    expect(mockCreateUser).toHaveBeenCalledWith({
      email: 'siti@perpus.local', password: 'rahasia123', email_confirm: true,
    });
  });

  it('meneruskan kode galat Supabase', async () => {
    mockCreateUser.mockResolvedValueOnce({
      data: { user: null },
      error: { code: 'email_exists', message: 'A user with this email address has already been registered' },
    });

    expect(await supabaseAuthAdmin().createUser('siti@perpus.local', 'rahasia123')).toEqual({
      ok: false, code: 'email_exists', message: 'A user with this email address has already been registered',
    });
  });

  it('mengganti kata sandi lewat updateUserById', async () => {
    mockUpdateUserById.mockResolvedValueOnce({ data: { user: { id: 'a1' } }, error: null });

    expect(await supabaseAuthAdmin().setPassword('a1', 'baru12345')).toEqual({ ok: true, id: 'a1' });
    expect(mockUpdateUserById).toHaveBeenCalledWith('a1', { password: 'baru12345' });
  });

  it('mencatat kegagalan penghapusan akun tanpa melempar galat', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockDeleteUser.mockResolvedValueOnce({ data: null, error: { message: 'Service unavailable' } });

    await expect(supabaseAuthAdmin().deleteUser('a1')).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('a1'));
  });
});
```

Run: `npx vitest run src/server/auth/auth-admin.test.ts`
Expected: FAIL — modul `./auth-admin` tidak ditemukan.

- [ ] **Step 2: Implementasikan port**

Buat `src/server/auth/auth-admin.ts`:

```ts
import { createClient } from '@supabase/supabase-js';

export type AuthAdminResult =
  | { ok: true; id: string }
  | { ok: false; code: string | null; message: string };

/**
 * Operasi Supabase Auth yang dibutuhkan manajemen pengguna. Service
 * menerimanya sebagai parameter, sehingga uji integrasi dapat memakai tiruan
 * yang tidak membuat akun sungguhan di Supabase cloud.
 */
export interface AuthAdmin {
  createUser(email: string, password: string): Promise<AuthAdminResult>;
  setPassword(userId: string, password: string): Promise<AuthAdminResult>;
  /** Dipakai untuk membersihkan akun bila profilnya gagal disimpan. Tidak pernah melempar. */
  deleteUser(userId: string): Promise<void>;
}

function failure(error: { code?: string; message: string } | null): AuthAdminResult {
  return { ok: false, code: error?.code ?? null, message: error?.message ?? 'Supabase tidak mengembalikan data akun' };
}

/** Hanya untuk kode server: kunci service role melewati seluruh RLS. */
export function supabaseAuthAdmin(): AuthAdmin {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  return {
    async createUser(email, password) {
      const { data, error } = await client.auth.admin.createUser({ email, password, email_confirm: true });
      if (error || !data.user) return failure(error);
      return { ok: true, id: data.user.id };
    },
    async setPassword(userId, password) {
      const { data, error } = await client.auth.admin.updateUserById(userId, { password });
      if (error || !data.user) return failure(error);
      return { ok: true, id: data.user.id };
    },
    async deleteUser(userId) {
      const { error } = await client.auth.admin.deleteUser(userId);
      if (error) {
        console.error(
          `Akun autentikasi ${userId} gagal dihapus setelah profilnya gagal disimpan: ${error.message}. ` +
          'Hapus akun itu lewat dasbor Supabase agar username-nya dapat dipakai lagi.',
        );
      }
    },
  };
}
```

Run: `npx vitest run src/server/auth/auth-admin.test.ts`
Expected: PASS.

- [ ] **Step 3: Tulis uji validasi yang gagal**

Buat `src/server/validation/user.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { newUserSchema, passwordSchema, userSchema } from './user';

const valid = {
  username: ' Siti.Aminah ',
  fullName: 'Siti Aminah',
  role: 'petugas',
  password: 'rahasia123',
  passwordConfirm: 'rahasia123',
};

function messagesOf(result: z.ZodSafeParseResult<unknown>): string[] {
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe('newUserSchema', () => {
  it('menormalkan username ke huruf kecil tanpa mengubah kata sandi', () => {
    expect(newUserSchema.parse({ ...valid, password: ' Rahasia123 ', passwordConfirm: ' Rahasia123 ' })).toEqual({
      username: 'siti.aminah',
      fullName: 'Siti Aminah',
      role: 'petugas',
      password: ' Rahasia123 ',
      passwordConfirm: ' Rahasia123 ',
    });
  });

  it('menolak username berspasi atau bertanda hubung dengan contoh yang benar', () => {
    for (const username of ['siti aminah', 'siti-aminah']) {
      expect(messagesOf(newUserSchema.safeParse({ ...valid, username }))).toEqual([
        'Username hanya boleh berisi huruf kecil, angka, titik, dan garis bawah, misalnya siti.aminah.',
      ]);
    }
  });

  it('menolak username terlalu pendek dan peran yang tidak dikenal', () => {
    expect(messagesOf(newUserSchema.safeParse({ ...valid, username: 'ab', role: 'kepala' }))).toEqual([
      'Username minimal 3 karakter.',
      'Peran harus admin atau petugas.',
    ]);
  });

  it('menolak kata sandi pendek dan pengulangan yang berbeda', () => {
    expect(messagesOf(newUserSchema.safeParse({ ...valid, password: 'pendek', passwordConfirm: 'pendek' }))).toEqual([
      'Kata sandi minimal 8 karakter.',
    ]);
    expect(messagesOf(newUserSchema.safeParse({ ...valid, passwordConfirm: 'rahasia124' }))).toEqual([
      'Ulangi kata sandi yang sama persis.',
    ]);
  });
});

describe('userSchema', () => {
  it('hanya menerima nama lengkap dan peran', () => {
    expect(userSchema.parse({ fullName: ' Siti Aminah ', role: 'admin', username: 'lain' })).toEqual({
      fullName: 'Siti Aminah',
      role: 'admin',
    });
  });
});

describe('passwordSchema', () => {
  it('menandai kolom pengulangan bila berbeda', () => {
    const result = passwordSchema.safeParse({ password: 'rahasia123', passwordConfirm: 'rahasia12' });
    expect(result.error?.issues[0]?.path).toEqual(['passwordConfirm']);
  });
});
```

Run: `npx vitest run src/server/validation/user.test.ts`
Expected: FAIL — modul `./user` tidak ditemukan.

- [ ] **Step 4: Implementasikan validasi**

Di `src/server/auth/username.ts`, ubah `const VALID_USERNAME` menjadi `export const VALID_USERNAME` (satu kata ditambahkan; isi tetap).

Buat `src/server/validation/user.ts`:

```ts
import { z } from 'zod';
import { VALID_USERNAME } from '@/server/auth/username';
import { requiredText } from './common';

const PASSWORD_MIN = 'Kata sandi minimal 8 karakter.';
const CONFIRM = 'Ulangi kata sandi yang sama persis.';

// Kata sandi tidak di-trim: spasi di ujung adalah bagian sah dari kata sandi.
// 72 adalah batas bcrypt yang dipakai Supabase Auth.
const password = z.string({ error: PASSWORD_MIN }).min(8, PASSWORD_MIN).max(72, 'Kata sandi maksimal 72 karakter.');
const passwordConfirm = z.string().optional();

function sameConfirmation(value: { password: string; passwordConfirm?: string }): boolean {
  return value.password === value.passwordConfirm;
}

const fullName = requiredText('Nama lengkap wajib diisi.', 100);
const role = z.enum(['admin', 'petugas'], 'Peran harus admin atau petugas.');

export const newUserSchema = z
  .object({
    username: requiredText('Username wajib diisi.', 30)
      .transform((value) => value.toLowerCase())
      .pipe(
        z.string()
          .min(3, 'Username minimal 3 karakter.')
          .regex(VALID_USERNAME, 'Username hanya boleh berisi huruf kecil, angka, titik, dan garis bawah, misalnya siti.aminah.'),
      ),
    fullName,
    role,
    password,
    passwordConfirm,
  })
  .refine(sameConfirmation, { path: ['passwordConfirm'], error: CONFIRM });

/** Username tidak dapat diubah: ia menjadi surel internal akun Supabase. */
export const userSchema = z.object({ fullName, role });

export const passwordSchema = z
  .object({ password, passwordConfirm })
  .refine(sameConfirmation, { path: ['passwordConfirm'], error: CONFIRM });

export type NewUserInput = z.output<typeof newUserSchema>;
export type UserInput = z.output<typeof userSchema>;
export type PasswordInput = z.output<typeof passwordSchema>;
```

Run: `npx vitest run src/server/validation/user.test.ts src/server/auth/username.test.ts`
Expected: PASS. Bila uji "kata sandi pendek" juga memunculkan pesan pengulangan, periksa bahwa kedua isian di uji itu sama (`'pendek'`) — refinement hanya menambah pesan bila isiannya berbeda.

- [ ] **Step 5: Tambahkan `fakeAuthAdmin` ke helper uji integrasi**

Di `tests/integration/helpers.ts`, ubah impor `drizzle-orm` menjadi `import { and, eq, sql, TransactionRollbackError } from 'drizzle-orm';`, tambahkan `import type { AuthAdmin, AuthAdminResult } from '@/server/auth/auth-admin';`, lalu tambahkan di akhir berkas:

```ts
export interface FakeAuthAdmin extends AuthAdmin {
  created: { id: string; email: string; password: string }[];
  passwords: { userId: string; password: string }[];
  deleted: string[];
}

interface FakeOptions {
  /** Meniru akun Supabase yang terbuat tetapi tanpa baris auth.users, agar penyimpanan profil ditolak foreign key. */
  withoutAuthRow?: boolean;
  createError?: { code: string | null; message: string };
  passwordError?: { code: string | null; message: string };
}

/**
 * Tiruan Supabase Auth untuk uji integrasi. Uji tidak boleh membuat akun
 * sungguhan di Supabase cloud, tetapi `profiles.id` mereferensikan
 * `auth.users`. Karena itu `createUser` menyisipkan baris `auth.users` di
 * transaksi uji yang sama, sehingga ikut di-rollback bersama profilnya.
 */
export function fakeAuthAdmin(tx: Transaction, options: FakeOptions = {}): FakeAuthAdmin {
  const fake: FakeAuthAdmin = {
    created: [],
    passwords: [],
    deleted: [],
    async createUser(email, password): Promise<AuthAdminResult> {
      if (options.createError) return { ok: false, ...options.createError };
      const id = crypto.randomUUID();
      if (!options.withoutAuthRow) {
        await tx.execute(sql`
          insert into auth.users (instance_id, id, aud, role, email)
          values ('00000000-0000-0000-0000-000000000000', ${id}, 'authenticated', 'authenticated', ${email})
        `);
      }
      fake.created.push({ id, email, password });
      return { ok: true, id };
    },
    async setPassword(userId, password): Promise<AuthAdminResult> {
      if (options.passwordError) return { ok: false, ...options.passwordError };
      fake.passwords.push({ userId, password });
      return { ok: true, id: userId };
    },
    async deleteUser(userId) {
      fake.deleted.push(userId);
    },
  };
  return fake;
}
```

- [ ] **Step 6: Tulis uji integrasi service pengguna yang gagal**

Buat `tests/integration/users.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { usernameToEmail } from '@/server/auth/username';
import { auditLogs } from '@/server/db/schema';
import { getUser, listUsers } from '@/server/queries/users';
import { createUser, resetUserPassword, setUserStatus, updateUser } from '@/server/services/users';
import { fakeAuthAdmin, testActor, withRollback } from './helpers';

const input = {
  username: 'uji_petugas',
  fullName: 'UJI Petugas Baru',
  role: 'petugas' as const,
  password: 'rahasia-uji-1',
  passwordConfirm: 'rahasia-uji-1',
};

async function auditOf(tx: Parameters<Parameters<typeof withRollback>[0]>[0], entityId: string, action: string) {
  return tx.select().from(auditLogs).where(and(eq(auditLogs.entityId, entityId), eq(auditLogs.action, action)));
}

describe('createUser', () => {
  it('membuat akun autentikasi dan profil, lalu menulis audit tanpa kata sandi', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const auth = fakeAuthAdmin(tx);

      const result = await createUser(input, actor, auth, tx);

      if (!result.ok) throw new Error(result.message);
      expect(auth.created).toEqual([{ id: result.id, email: usernameToEmail('uji_petugas'), password: 'rahasia-uji-1' }]);
      expect(await getUser(result.id, tx)).toEqual({
        id: result.id, username: 'uji_petugas', fullName: 'UJI Petugas Baru', role: 'petugas', status: 'active',
      });
      const [audit] = await auditOf(tx, result.id, 'user.create');
      expect(audit?.metadata).toEqual({ username: 'uji_petugas', fullName: 'UJI Petugas Baru', role: 'petugas' });
    });
  });

  it('menolak username yang sudah dipakai tanpa menghubungi layanan autentikasi', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const auth = fakeAuthAdmin(tx);
      await createUser(input, actor, auth, tx);

      expect(await createUser(input, actor, auth, tx)).toEqual({
        ok: false, field: 'username', message: 'Username uji_petugas sudah dipakai. Pilih username lain.',
      });
      expect(auth.created).toHaveLength(1);
    });
  });

  it('menjelaskan username yang tertinggal di layanan autentikasi tanpa profil', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const auth = fakeAuthAdmin(tx, {
        createError: { code: 'email_exists', message: 'A user with this email address has already been registered' },
      });

      expect(await createUser(input, actor, auth, tx)).toEqual({
        ok: false,
        field: 'username',
        message: 'Username uji_petugas sudah terdaftar di layanan autentikasi, tetapi tidak ada di daftar pengguna. '
          + 'Pilih username lain, atau minta pengembang menghapus akun lama itu di dasbor Supabase.',
      });
    });
  });

  it('meneruskan galat layanan autentikasi lain dengan saran mencoba lagi', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const auth = fakeAuthAdmin(tx, { createError: { code: null, message: 'Service unavailable' } });

      expect(await createUser(input, actor, auth, tx)).toEqual({
        ok: false,
        message: 'Akun uji_petugas belum dapat dibuat di layanan autentikasi (Service unavailable). Coba lagi beberapa saat lagi.',
      });
    });
  });

  it('menghapus akun autentikasi bila profilnya gagal disimpan', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const auth = fakeAuthAdmin(tx, { withoutAuthRow: true });

      await expect(createUser(input, actor, auth, tx)).rejects.toThrow();

      expect(auth.deleted).toEqual([auth.created[0]?.id]);
    });
  });
});

describe('updateUser', () => {
  it('mengubah nama dan peran, dan mencatat nilai sebelum dan sesudah', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const created = await createUser(input, actor, fakeAuthAdmin(tx), tx);
      if (!created.ok) throw new Error(created.message);
      const changed = { fullName: 'UJI Admin Baru', role: 'admin' as const };

      expect(await updateUser(created.id, changed, actor, tx)).toEqual({ ok: true, id: created.id });

      expect(await getUser(created.id, tx)).toMatchObject(changed);
      const [audit] = await auditOf(tx, created.id, 'user.update');
      expect(audit?.metadata).toEqual({
        username: 'uji_petugas',
        before: { fullName: 'UJI Petugas Baru', role: 'petugas' },
        after: changed,
      });
    });
  });

  it('menolak admin mengubah perannya sendiri, tetapi mengizinkan mengubah namanya', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);

      expect(await updateUser(actor.id, { fullName: 'UJI Nama Admin', role: 'petugas' }, actor, tx)).toEqual({
        ok: false,
        field: 'role',
        message: 'Anda tidak dapat mengubah peran akun Anda sendiri. Minta admin lain melakukannya bila perlu.',
      });
      expect(await updateUser(actor.id, { fullName: 'UJI Nama Admin', role: 'admin' }, actor, tx)).toEqual({
        ok: true, id: actor.id,
      });
    });
  });

  it('melaporkan pengguna yang tidak ada', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      expect(await updateUser(crypto.randomUUID(), { fullName: 'UJI', role: 'petugas' }, actor, tx)).toEqual({
        ok: false, message: 'Pengguna tidak ditemukan. Muat ulang halaman daftar pengguna.',
      });
    });
  });
});

describe('setUserStatus', () => {
  it('menonaktifkan pengguna lain dan mencatat audit', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const created = await createUser(input, actor, fakeAuthAdmin(tx), tx);
      if (!created.ok) throw new Error(created.message);

      expect(await setUserStatus(created.id, 'inactive', actor, tx)).toEqual({ ok: true, id: created.id });

      expect((await getUser(created.id, tx))?.status).toBe('inactive');
      const [audit] = await auditOf(tx, created.id, 'user.deactivate');
      expect(audit?.metadata).toEqual({ username: 'uji_petugas' });
    });
  });

  it('menolak admin menonaktifkan akunnya sendiri', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);

      expect(await setUserStatus(actor.id, 'inactive', actor, tx)).toEqual({
        ok: false,
        message: 'Anda tidak dapat menonaktifkan akun Anda sendiri. Minta admin lain melakukannya bila perlu.',
      });
      expect((await getUser(actor.id, tx))?.status).toBe('active');
    });
  });
});

describe('resetUserPassword', () => {
  it('mengganti kata sandi di layanan autentikasi dan mencatat audit tanpa kata sandinya', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const auth = fakeAuthAdmin(tx);
      const created = await createUser(input, actor, auth, tx);
      if (!created.ok) throw new Error(created.message);

      const result = await resetUserPassword(
        created.id, { password: 'baru-uji-12', passwordConfirm: 'baru-uji-12' }, actor, auth, tx,
      );

      expect(result).toEqual({ ok: true, id: created.id });
      expect(auth.passwords).toEqual([{ userId: created.id, password: 'baru-uji-12' }]);
      const [audit] = await auditOf(tx, created.id, 'user.reset_password');
      expect(audit?.metadata).toEqual({ username: 'uji_petugas' });
    });
  });

  it('tidak menulis audit bila layanan autentikasi menolak', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const created = await createUser(input, actor, fakeAuthAdmin(tx), tx);
      if (!created.ok) throw new Error(created.message);
      const failing = fakeAuthAdmin(tx, { passwordError: { code: null, message: 'Service unavailable' } });

      expect(await resetUserPassword(
        created.id, { password: 'baru-uji-12', passwordConfirm: 'baru-uji-12' }, actor, failing, tx,
      )).toEqual({
        ok: false,
        message: 'Kata sandi uji_petugas belum dapat diganti (Service unavailable). Coba lagi beberapa saat lagi.',
      });
      expect(await auditOf(tx, created.id, 'user.reset_password')).toHaveLength(0);
    });
  });
});

describe('listUsers', () => {
  it('mengurutkan berdasarkan username', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      await createUser(input, actor, fakeAuthAdmin(tx), tx);

      const usernames = (await listUsers(tx)).map((user) => user.username);

      expect(usernames).toContain('uji_petugas');
      expect(usernames).toEqual([...usernames].sort());
    });
  });
});
```

Run: `npx vitest run --config vitest.integration.config.ts tests/integration/users.test.ts`
Expected: FAIL — modul `@/server/queries/users` tidak ditemukan.

- [ ] **Step 7: Implementasikan query**

Buat `src/server/queries/users.ts`:

```ts
import { asc, eq } from 'drizzle-orm';
import type { RecordStatus, UserRole } from '@/domain/shared/types';
import { db } from '@/server/db/client';
import type { Executor } from '@/server/db/executor';
import { profiles } from '@/server/db/schema';
import { isUuid } from '@/server/validation/common';

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  status: RecordStatus;
}

const userColumns = {
  id: profiles.id,
  username: profiles.username,
  fullName: profiles.fullName,
  role: profiles.role,
  status: profiles.status,
};

/** Staf perpustakaan hanya segelintir, jadi tanpa paginasi dan filter. */
export async function listUsers(executor: Executor = db): Promise<User[]> {
  return executor.select(userColumns).from(profiles).orderBy(asc(profiles.username));
}

export async function getUser(id: string, executor: Executor = db): Promise<User | null> {
  if (!isUuid(id)) return null;
  const [user] = await executor.select(userColumns).from(profiles).where(eq(profiles.id, id)).limit(1);
  return user ?? null;
}
```

- [ ] **Step 8: Implementasikan service**

Buat `src/server/services/users.ts`:

```ts
import { eq } from 'drizzle-orm';
import type { Actor, RecordStatus } from '@/domain/shared/types';
import { writeAudit } from '@/server/audit';
import type { AuthAdmin } from '@/server/auth/auth-admin';
import { usernameToEmail } from '@/server/auth/username';
import { db } from '@/server/db/client';
import { uniqueViolation } from '@/server/db/errors';
import type { Executor } from '@/server/db/executor';
import { profiles } from '@/server/db/schema';
import { isUuid } from '@/server/validation/common';
import type { NewUserInput, PasswordInput, UserInput } from '@/server/validation/user';
import { fail, ok, type ServiceResult } from './result';

const NOT_FOUND = 'Pengguna tidak ditemukan. Muat ulang halaman daftar pengguna.';
const SELF_ROLE = 'Anda tidak dapat mengubah peran akun Anda sendiri. Minta admin lain melakukannya bila perlu.';
const SELF_STATUS = 'Anda tidak dapat menonaktifkan akun Anda sendiri. Minta admin lain melakukannya bila perlu.';

function duplicate(username: string): ServiceResult {
  return fail(`Username ${username} sudah dipakai. Pilih username lain.`, 'username');
}

/**
 * Urutannya: periksa username → buat akun Supabase → simpan profil.
 * Supabase dan Postgres tidak berbagi transaksi, jadi bila profil gagal
 * disimpan, akun Supabase-nya dihapus lagi. Tanpa pembersihan itu username
 * terkunci selamanya: Supabase menolak surel yang sama, sedangkan daftar
 * pengguna tidak menampilkannya.
 */
export async function createUser(
  input: NewUserInput,
  actor: Actor,
  auth: AuthAdmin,
  executor: Executor = db,
): Promise<ServiceResult> {
  const [taken] = await executor
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.username, input.username))
    .limit(1);
  if (taken) return duplicate(input.username);

  const account = await auth.createUser(usernameToEmail(input.username), input.password);
  if (!account.ok) {
    if (account.code === 'email_exists') {
      return fail(
        `Username ${input.username} sudah terdaftar di layanan autentikasi, tetapi tidak ada di daftar pengguna. `
          + 'Pilih username lain, atau minta pengembang menghapus akun lama itu di dasbor Supabase.',
        'username',
      );
    }
    return fail(`Akun ${input.username} belum dapat dibuat di layanan autentikasi (${account.message}). Coba lagi beberapa saat lagi.`);
  }

  const profile = { username: input.username, fullName: input.fullName, role: input.role };
  try {
    return await executor.transaction(async (tx) => {
      await tx.insert(profiles).values({ id: account.id, ...profile });
      await writeAudit(tx, {
        actorId: actor.id,
        action: 'user.create',
        entity: 'profiles',
        entityId: account.id,
        metadata: profile,
      });
      return ok(account.id);
    });
  } catch (error) {
    await auth.deleteUser(account.id);
    if (uniqueViolation(error) === 'profiles_username_unique') return duplicate(input.username);
    throw error;
  }
}

export async function updateUser(
  id: string,
  input: UserInput,
  actor: Actor,
  executor: Executor = db,
): Promise<ServiceResult> {
  if (!isUuid(id)) return fail(NOT_FOUND);
  return executor.transaction(async (tx) => {
    const [current] = await tx
      .select({ username: profiles.username, fullName: profiles.fullName, role: profiles.role })
      .from(profiles)
      .where(eq(profiles.id, id))
      .for('update');
    if (!current) return fail(NOT_FOUND);
    // Admin yang menurunkan perannya sendiri dapat membuat perpustakaan
    // tanpa admin sama sekali; tidak ada layar yang dapat memulihkannya.
    if (id === actor.id && input.role !== current.role) return fail(SELF_ROLE, 'role');

    const after = { fullName: input.fullName, role: input.role };
    await tx.update(profiles).set({ ...after, updatedAt: new Date() }).where(eq(profiles.id, id));

    await writeAudit(tx, {
      actorId: actor.id,
      action: 'user.update',
      entity: 'profiles',
      entityId: id,
      metadata: { username: current.username, before: { fullName: current.fullName, role: current.role }, after },
    });
    return ok(id);
  });
}

/**
 * Profil nonaktif ditolak `getCurrentProfile()` di setiap request, jadi
 * sesinya yang masih hidup langsung tidak berguna tanpa perlu dicabut.
 */
export async function setUserStatus(
  id: string,
  status: RecordStatus,
  actor: Actor,
  executor: Executor = db,
): Promise<ServiceResult> {
  if (!isUuid(id)) return fail(NOT_FOUND);
  if (id === actor.id) return fail(SELF_STATUS);
  return executor.transaction(async (tx) => {
    const [updated] = await tx
      .update(profiles)
      .set({ status, updatedAt: new Date() })
      .where(eq(profiles.id, id))
      .returning({ username: profiles.username });
    if (!updated) return fail(NOT_FOUND);

    await writeAudit(tx, {
      actorId: actor.id,
      action: status === 'active' ? 'user.activate' : 'user.deactivate',
      entity: 'profiles',
      entityId: id,
      metadata: { username: updated.username },
    });
    return ok(id);
  });
}

/**
 * Spec Section 7: tanpa surel sungguhan, admin-lah yang mengatur ulang kata
 * sandi. Kata sandinya tidak pernah masuk audit log.
 */
export async function resetUserPassword(
  id: string,
  input: PasswordInput,
  actor: Actor,
  auth: AuthAdmin,
  executor: Executor = db,
): Promise<ServiceResult> {
  if (!isUuid(id)) return fail(NOT_FOUND);
  return executor.transaction(async (tx) => {
    const [user] = await tx
      .select({ username: profiles.username })
      .from(profiles)
      .where(eq(profiles.id, id))
      .for('update');
    if (!user) return fail(NOT_FOUND);

    const result = await auth.setPassword(id, input.password);
    if (!result.ok) {
      return fail(`Kata sandi ${user.username} belum dapat diganti (${result.message}). Coba lagi beberapa saat lagi.`);
    }

    await writeAudit(tx, {
      actorId: actor.id,
      action: 'user.reset_password',
      entity: 'profiles',
      entityId: id,
      metadata: { username: user.username },
    });
    return ok(id);
  });
}
```

- [ ] **Step 9: Jalankan uji integrasi dan pastikan lulus**

Run: `npx vitest run --config vitest.integration.config.ts tests/integration/users.test.ts`
Expected: seluruh uji PASS.

Bila `insert into auth.users` di `fakeAuthAdmin` ditolak karena kolom wajib lain, baca daftar kolom `not null` tanpa nilai bawaan dengan kueri read-only `select column_name from information_schema.columns where table_schema = 'auth' and table_name = 'users' and is_nullable = 'NO' and column_default is null`, lalu tambahkan kolom itu ke insert tiruan. Jangan pernah membuat akun Supabase sungguhan dari uji.

- [ ] **Step 10: Catat aturan uji pengguna di README**

Di `README.md`, tambahkan paragraf ini tepat setelah paragraf yang diakhiri "…agar tidak bertabrakan dengan data seed." di bagian **Uji**:

```markdown
Uji manajemen pengguna tidak membuat akun sungguhan di Supabase Auth.
Service pengguna menerima port `AuthAdmin`; uji memakai `fakeAuthAdmin(tx)`
yang menyisipkan baris `auth.users` di transaksi uji yang sama, sehingga ikut
di-rollback. Username uji berawalan `uji_`, dan tahun ajaran uji memakai
tahun 2090 ke atas, karena format keduanya tidak mengizinkan awalan `UJI-`.
```

- [ ] **Step 11: Jalankan seluruh uji unit, seluruh uji integrasi, lint, dan tsc**

Run: `npm test && npm run test:integration && npm run lint && npx tsc --noEmit`
Expected: seluruhnya PASS, lint dan tsc bersih.

- [ ] **Step 12: Commit**

```bash
git add src/server/auth/auth-admin.ts src/server/auth/auth-admin.test.ts src/server/auth/username.ts \
  src/server/validation/user.ts src/server/validation/user.test.ts \
  src/server/queries/users.ts src/server/services/users.ts \
  tests/integration/helpers.ts tests/integration/users.test.ts README.md
git commit -m "$(cat <<'EOF'
feat(pengguna): layanan akun Supabase Auth dengan pembersihan akun yatim

Admin tidak dapat mengubah peran atau menonaktifkan akunnya sendiri.
Uji integrasi memakai tiruan AuthAdmin, tanpa akun Supabase sungguhan.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Layar Pengguna dan Penolakan Akun Nonaktif

Admin membuat akun petugas, mengubah nama dan peran, mengatur ulang kata sandi, dan menonaktifkan akun. Layar masuk kini menjelaskan mengapa akun nonaktif tidak dapat masuk.

**Files:**
- Create: `src/server/actions/users.ts`, `src/server/actions/users.test.ts`
- Modify: `src/server/actions/auth.ts`, `src/server/actions/auth.test.ts`
- Create: `src/app/(app)/pengaturan/pengguna/user-fields.tsx`
- Create: `src/app/(app)/pengaturan/pengguna/page.tsx`, `page.test.tsx`
- Create: `src/app/(app)/pengaturan/pengguna/baru/page.tsx`, `baru/page.test.tsx`
- Create: `src/app/(app)/pengaturan/pengguna/[id]/page.tsx`, `[id]/page.test.tsx`
- Modify: `README.md` (bagian Akun pengembangan)

**Interfaces:**
- Consumes: `createUser`, `updateUser`, `setUserStatus`, `resetUserPassword`, `listUsers`, `getUser`, `User` (Task 4); `supabaseAuthAdmin` (Task 4); `newUserSchema`, `userSchema`, `passwordSchema` (Task 4); `runFormAction({ secretFields })`, `TextField type="password"`, `AccessDenied` (Task 1)
- Produces:
  - Server Action: `createUserAction`, `updateUserAction(id, …)`, `resetUserPasswordAction(id, …)`, `setUserStatusAction(id, status, …)`
  - `signIn` mengembalikan `{ error: 'Akun ini dinonaktifkan. …' }` untuk profil nonaktif
  - `ROLE_LABELS: Record<UserRole, string>`, `<ProfileFields user? isSelf? />`, `<PasswordFields />`

- [ ] **Step 1: Tulis uji Server Action pengguna yang gagal**

Buat `src/server/actions/users.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formError, IDLE } from '@/lib/form-state';

const {
  mockRunFormAction, mockRunCommand, mockCreate, mockUpdate, mockSetStatus, mockReset, fakeAuth,
} = vi.hoisted(() => ({
  mockRunFormAction: vi.fn(),
  mockRunCommand: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockSetStatus: vi.fn(),
  mockReset: vi.fn(),
  fakeAuth: { createUser: vi.fn(), setPassword: vi.fn(), deleteUser: vi.fn() },
}));

vi.mock('@/server/forms/run-action', () => ({ runFormAction: mockRunFormAction, runCommand: mockRunCommand }));
vi.mock('@/server/services/users', () => ({
  createUser: mockCreate,
  updateUser: mockUpdate,
  setUserStatus: mockSetStatus,
  resetUserPassword: mockReset,
}));
vi.mock('@/server/auth/auth-admin', () => ({ supabaseAuthAdmin: vi.fn(() => fakeAuth) }));

import {
  createUserAction, resetUserPasswordAction, setUserStatusAction, updateUserAction,
} from './users';

const actor = { id: 'u1', role: 'admin' as const };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Server Action pengguna', () => {
  it('createUserAction hanya untuk admin, tidak mengirim balik kata sandi, dan memakai Supabase Auth', async () => {
    await createUserAction(IDLE, new FormData());

    const options = mockRunFormAction.mock.calls[0]?.[0];
    expect(options.roles).toEqual(['admin']);
    expect(options.secretFields).toEqual(['password', 'passwordConfirm']);
    expect(options.redirectTo).toBe('/pengaturan/pengguna');
    const data = { username: 'siti', fullName: 'Siti', role: 'petugas', password: 'x', passwordConfirm: 'x' };
    await options.execute(data, actor);
    expect(mockCreate).toHaveBeenCalledWith(data, actor, fakeAuth);
  });

  it('updateUserAction meneruskan id ke service', async () => {
    await updateUserAction('p1', IDLE, new FormData());

    const options = mockRunFormAction.mock.calls[0]?.[0];
    expect(options.roles).toEqual(['admin']);
    await options.execute({ fullName: 'Siti', role: 'admin' }, actor);
    expect(mockUpdate).toHaveBeenCalledWith('p1', { fullName: 'Siti', role: 'admin' }, actor);
  });

  it('resetUserPasswordAction tetap di halaman dan tidak mengirim balik kata sandi', async () => {
    await resetUserPasswordAction('p1', IDLE, new FormData());

    const options = mockRunFormAction.mock.calls[0]?.[0];
    expect(options.roles).toEqual(['admin']);
    expect(options.secretFields).toEqual(['password', 'passwordConfirm']);
    expect(options.redirectTo).toBeUndefined();
    const data = { password: 'baru12345', passwordConfirm: 'baru12345' };
    await options.execute(data, actor);
    expect(mockReset).toHaveBeenCalledWith('p1', data, actor, fakeAuth);
  });

  it('setUserStatusAction menolak status yang tidak dikenal', async () => {
    const state = await setUserStatusAction('p1', 'deleted' as never, IDLE, new FormData());

    expect(state).toEqual(formError('Status pengguna tidak dikenal. Muat ulang halaman lalu coba lagi.'));
    expect(mockRunCommand).not.toHaveBeenCalled();
  });

  it('setUserStatusAction hanya untuk admin dan meneruskan status yang sah', async () => {
    await setUserStatusAction('p1', 'inactive', IDLE, new FormData());

    const options = mockRunCommand.mock.calls[0]?.[0];
    expect(options.roles).toEqual(['admin']);
    await options.execute(actor);
    expect(mockSetStatus).toHaveBeenCalledWith('p1', 'inactive', actor);
  });
});
```

Run: `npx vitest run src/server/actions/users.test.ts`
Expected: FAIL — modul `./users` tidak ditemukan.

- [ ] **Step 2: Implementasikan Server Action pengguna**

Buat `src/server/actions/users.ts`:

```ts
'use server';

import type { RecordStatus, UserRole } from '@/domain/shared/types';
import { formError, type FormState } from '@/lib/form-state';
import { supabaseAuthAdmin } from '@/server/auth/auth-admin';
import { runCommand, runFormAction } from '@/server/forms/run-action';
import { createUser, resetUserPassword, setUserStatus, updateUser } from '@/server/services/users';
import { isRecordStatus } from '@/server/validation/common';
import { newUserSchema, passwordSchema, userSchema } from '@/server/validation/user';

const ROLES: UserRole[] = ['admin'];
const LIST = '/pengaturan/pengguna';
const SECRET = ['password', 'passwordConfirm'];

export async function createUserAction(_state: FormState, formData: FormData): Promise<FormState> {
  return runFormAction({
    roles: ROLES,
    schema: newUserSchema,
    formData,
    invalidMessage: 'Pengguna belum dapat dibuat. Periksa kolom yang ditandai.',
    secretFields: SECRET,
    execute: (data, actor) => createUser(data, actor, supabaseAuthAdmin()),
    successMessage: 'Pengguna berhasil dibuat. Sampaikan username dan kata sandinya secara langsung.',
    revalidate: [LIST],
    redirectTo: LIST,
  });
}

export async function updateUserAction(id: string, _state: FormState, formData: FormData): Promise<FormState> {
  return runFormAction({
    roles: ROLES,
    schema: userSchema,
    formData,
    invalidMessage: 'Perubahan pengguna belum dapat disimpan. Periksa kolom yang ditandai.',
    execute: (data, actor) => updateUser(id, data, actor),
    successMessage: 'Perubahan pengguna tersimpan.',
    revalidate: [LIST],
    redirectTo: LIST,
  });
}

export async function resetUserPasswordAction(id: string, _state: FormState, formData: FormData): Promise<FormState> {
  return runFormAction({
    roles: ROLES,
    schema: passwordSchema,
    formData,
    invalidMessage: 'Kata sandi belum dapat diganti. Periksa kolom yang ditandai.',
    secretFields: SECRET,
    execute: (data, actor) => resetUserPassword(id, data, actor, supabaseAuthAdmin()),
    successMessage: 'Kata sandi diganti. Sampaikan kata sandi baru secara langsung kepada pemilik akun.',
    revalidate: [],
  });
}

export async function setUserStatusAction(
  id: string,
  status: RecordStatus,
  _state: FormState,
  _formData: FormData,
): Promise<FormState> {
  if (!isRecordStatus(status)) {
    return formError('Status pengguna tidak dikenal. Muat ulang halaman lalu coba lagi.');
  }
  return runCommand({
    roles: ROLES,
    execute: (actor) => setUserStatus(id, status, actor),
    successMessage: status === 'active' ? 'Pengguna diaktifkan.' : 'Pengguna dinonaktifkan.',
    revalidate: [LIST],
  });
}
```

Run: `npx vitest run src/server/actions/users.test.ts`
Expected: PASS.

- [ ] **Step 3: Tulis uji penolakan akun nonaktif di layar masuk yang gagal**

Di `src/server/actions/auth.test.ts`, ganti blok `vi.hoisted` dan `vi.mock` di bagian atas dengan:

```ts
const { mockSignInWithPassword, mockSignOut, mockRedirect, mockGetUser } = vi.hoisted(() => ({
  mockSignInWithPassword: vi.fn(),
  mockSignOut: vi.fn(),
  mockRedirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
  mockGetUser: vi.fn(),
}));

vi.mock('@/server/auth/session', () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { signInWithPassword: mockSignInWithPassword, signOut: mockSignOut },
  })),
}));
vi.mock('@/server/queries/users', () => ({ getUser: mockGetUser }));
vi.mock('next/navigation', () => ({ redirect: mockRedirect }));
```

Ganti uji `'mengarahkan ke /dashboard ketika kredensial benar'` dengan tiga uji ini:

```ts
  it('mengarahkan ke /dashboard ketika kredensial benar dan akunnya aktif', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null });
    mockGetUser.mockResolvedValueOnce({ id: 'u1', status: 'active' });
    await expect(
      signIn(null, buildFormData({ username: 'budi', password: 'benar' })),
    ).rejects.toThrow('NEXT_REDIRECT');
    expect(mockRedirect).toHaveBeenCalledWith('/dashboard');
  });

  it('menjelaskan bahwa akun dinonaktifkan dan tidak meninggalkan sesi', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null });
    mockGetUser.mockResolvedValueOnce({ id: 'u1', status: 'inactive' });

    const result = await signIn(null, buildFormData({ username: 'budi', password: 'benar' }));

    expect(result?.error).toBe('Akun ini dinonaktifkan. Hubungi admin perpustakaan untuk mengaktifkannya kembali.');
    expect(mockSignOut).toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('menjelaskan akun autentikasi yang belum memiliki profil', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null });
    mockGetUser.mockResolvedValueOnce(null);

    const result = await signIn(null, buildFormData({ username: 'budi', password: 'benar' }));

    expect(result?.error).toBe('Akun ini belum terdaftar sebagai pengguna perpustakaan. Hubungi admin perpustakaan.');
    expect(mockSignOut).toHaveBeenCalled();
  });
```

Dan ganti mock di uji `'mengembalikan pesan generik ketika kredensial ditolak…'` menjadi `mockSignInWithPassword.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Invalid login credentials' } });`. Tambahkan `beforeEach(() => { vi.clearAllMocks(); });` tepat setelah fungsi `buildFormData`, dan tambahkan `beforeEach` ke impor `vitest`.

Run: `npx vitest run src/server/actions/auth.test.ts`
Expected: FAIL — uji akun nonaktif dan tanpa profil gagal karena `signIn` langsung mengarahkan ke `/dashboard`.

- [ ] **Step 4: Tolak akun nonaktif di `signIn`**

Di `src/server/actions/auth.ts`, tambahkan `import { getUser } from '@/server/queries/users';` ke blok impor, lalu ganti bagian dari `const supabase = …` sampai `redirect('/dashboard');` di `signIn` dengan:

```ts
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    // Pesan sengaja tidak membedakan username salah dari kata sandi salah,
    // agar tidak membocorkan username mana yang terdaftar.
    return { error: 'Username atau kata sandi salah.' };
  }

  // Kata sandinya benar, jadi aman menjelaskan alasannya. Tanpa pemeriksaan
  // ini, akun nonaktif hanya terlempar kembali ke layar masuk tanpa
  // penjelasan, karena setiap halaman menolak profil nonaktif.
  const account = await getUser(data.user.id);
  if (!account || account.status !== 'active') {
    await supabase.auth.signOut();
    return {
      error: account
        ? 'Akun ini dinonaktifkan. Hubungi admin perpustakaan untuk mengaktifkannya kembali.'
        : 'Akun ini belum terdaftar sebagai pengguna perpustakaan. Hubungi admin perpustakaan.',
    };
  }

  redirect('/dashboard');
```

Run: `npx vitest run src/server/actions/auth.test.ts`
Expected: PASS.

- [ ] **Step 5: Tulis uji halaman pengguna yang gagal**

Buat `src/app/(app)/pengaturan/pengguna/page.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockList, mockRequireProfile } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockRequireProfile: vi.fn(),
}));

vi.mock('@/server/queries/users', () => ({ listUsers: mockList }));
vi.mock('@/server/actions/users', () => ({ setUserStatusAction: vi.fn() }));
vi.mock('@/server/auth/guard', () => ({ requireProfile: mockRequireProfile }));

import UsersPage from './page';

async function render(params: Record<string, string> = {}) {
  return renderToStaticMarkup(await UsersPage({ searchParams: Promise.resolve(params) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireProfile.mockResolvedValue({ id: 'u1', role: 'admin', fullName: 'Administrator', status: 'active' });
});

describe('UsersPage', () => {
  it('menampilkan peran dan tidak menawarkan menonaktifkan akun sendiri', async () => {
    mockList.mockResolvedValueOnce([
      { id: 'u1', username: 'admin', fullName: 'Administrator', role: 'admin', status: 'active' },
      { id: 'u2', username: 'petugas', fullName: 'Petugas Perpustakaan', role: 'petugas', status: 'active' },
      { id: 'u3', username: 'lama', fullName: 'Petugas Lama', role: 'petugas', status: 'inactive' },
    ]);

    const html = await render({ pesan: 'Pengguna berhasil dibuat.' });

    expect(html).toContain('Akun Anda');
    expect(html.split('Nonaktifkan').length - 1).toBe(1);
    expect(html).toContain('Aktifkan');
    expect(html).toContain('Petugas Perpustakaan');
    expect(html).toContain('href="/pengaturan/pengguna/u2"');
    expect(html).toContain('Pengguna berhasil dibuat.');
  });

  it('menampilkan Akses ditolak untuk petugas tanpa membaca data', async () => {
    mockRequireProfile.mockResolvedValueOnce({ id: 'u2', role: 'petugas', fullName: 'Petugas', status: 'active' });

    const html = await render();

    expect(html).toContain('Akses ditolak');
    expect(mockList).not.toHaveBeenCalled();
  });
});
```

Buat `src/app/(app)/pengaturan/pengguna/baru/page.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockRequireProfile } = vi.hoisted(() => ({ mockRequireProfile: vi.fn() }));

vi.mock('@/server/actions/users', () => ({ createUserAction: vi.fn() }));
vi.mock('@/server/auth/guard', () => ({ requireProfile: mockRequireProfile }));

import NewUserPage from './page';

beforeEach(() => {
  mockRequireProfile.mockResolvedValue({ id: 'u1', role: 'admin', fullName: 'Administrator', status: 'active' });
});

describe('NewUserPage', () => {
  it('menampilkan kolom akun baru dengan peran petugas terpilih', async () => {
    const html = renderToStaticMarkup(await NewUserPage());

    for (const name of ['username', 'fullName', 'role', 'password', 'passwordConfirm']) {
      expect(html).toContain(`name="${name}"`);
    }
    expect(html.split('type="password"').length - 1).toBe(2);
    expect(html).toMatch(/<option value="petugas" selected="">Petugas<\/option>/);
  });

  it('menampilkan Akses ditolak untuk petugas', async () => {
    mockRequireProfile.mockResolvedValueOnce({ id: 'u2', role: 'petugas', fullName: 'Petugas', status: 'active' });
    expect(renderToStaticMarkup(await NewUserPage())).toContain('Akses ditolak');
  });
});
```

Buat `src/app/(app)/pengaturan/pengguna/[id]/page.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockGet, mockRequireProfile, mockNotFound } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockRequireProfile: vi.fn(),
  mockNotFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('@/server/queries/users', () => ({ getUser: mockGet }));
vi.mock('@/server/actions/users', () => ({ updateUserAction: vi.fn(), resetUserPasswordAction: vi.fn() }));
vi.mock('@/server/auth/guard', () => ({ requireProfile: mockRequireProfile }));
vi.mock('next/navigation', () => ({ notFound: mockNotFound }));

import EditUserPage from './page';

function render(id: string) {
  return EditUserPage({ params: Promise.resolve({ id }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireProfile.mockResolvedValue({ id: 'u1', role: 'admin', fullName: 'Administrator', status: 'active' });
});

describe('EditUserPage', () => {
  it('mengisi nama dan peran, dan menyediakan form kata sandi terpisah yang kosong', async () => {
    mockGet.mockResolvedValueOnce({
      id: 'u2', username: 'petugas', fullName: 'Petugas Perpustakaan', role: 'petugas', status: 'active',
    });

    const html = renderToStaticMarkup(await render('u2'));

    expect(html).toContain('value="Petugas Perpustakaan"');
    expect(html).toMatch(/<option value="petugas" selected="">Petugas<\/option>/);
    expect(html).toContain('Atur Ulang Kata Sandi');
    expect(html).toContain('Ganti Kata Sandi');
    expect(html).not.toContain('name="username"');
    expect(html).not.toContain('Peran akun Anda sendiri tidak dapat diubah');
  });

  it('memberi tahu admin bahwa perannya sendiri tidak dapat diubah', async () => {
    mockGet.mockResolvedValueOnce({
      id: 'u1', username: 'admin', fullName: 'Administrator', role: 'admin', status: 'active',
    });

    expect(renderToStaticMarkup(await render('u1'))).toContain('Peran akun Anda sendiri tidak dapat diubah');
  });

  it('menampilkan halaman tidak ditemukan untuk id yang tidak ada', async () => {
    mockGet.mockResolvedValueOnce(null);
    await expect(render('x')).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('menampilkan Akses ditolak untuk petugas tanpa membaca data', async () => {
    mockRequireProfile.mockResolvedValueOnce({ id: 'u2', role: 'petugas', fullName: 'Petugas', status: 'active' });

    expect(renderToStaticMarkup(await render('u1'))).toContain('Akses ditolak');
    expect(mockGet).not.toHaveBeenCalled();
  });
});
```

Run: `npx vitest run "src/app/(app)/pengaturan/pengguna"`
Expected: FAIL — modul halaman tidak ditemukan.

- [ ] **Step 6: Implementasikan halaman pengguna**

Buat `src/app/(app)/pengaturan/pengguna/user-fields.tsx`:

```tsx
import { SelectField, TextField } from '@/components/ui/fields';
import type { UserRole } from '@/domain/shared/types';
import type { Option } from '@/lib/options';
import type { User } from '@/server/queries/users';

export const ROLE_LABELS: Record<UserRole, string> = { admin: 'Admin', petugas: 'Petugas' };

const ROLE_OPTIONS: Option[] = [
  { value: 'petugas', label: ROLE_LABELS.petugas },
  { value: 'admin', label: ROLE_LABELS.admin },
];

/** Nama dan peran, dipakai bersama halaman tambah dan ubah pengguna. */
export function ProfileFields({ user, isSelf = false }: { user?: User; isSelf?: boolean }) {
  return (
    <>
      <TextField name="fullName" label="Nama lengkap" defaultValue={user?.fullName} required maxLength={100} />
      <SelectField
        name="role"
        label="Peran"
        required
        defaultValue={user?.role ?? 'petugas'}
        options={ROLE_OPTIONS}
        hint={
          isSelf
            ? 'Peran akun Anda sendiri tidak dapat diubah. Minta admin lain bila perlu.'
            : 'Admin juga dapat mengelola pengguna, tahun ajaran, dan konfigurasi.'
        }
      />
    </>
  );
}

/** Kolom kata sandi. Isinya tidak pernah dikirim balik setelah galat. */
export function PasswordFields() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField
        name="password"
        label="Kata sandi"
        type="password"
        autoComplete="new-password"
        required
        hint="Minimal 8 karakter."
      />
      <TextField
        name="passwordConfirm"
        label="Ulangi kata sandi"
        type="password"
        autoComplete="new-password"
        required
      />
    </div>
  );
}
```

Buat `src/app/(app)/pengaturan/pengguna/page.tsx`:

```tsx
import Link from 'next/link';
import { AccessDenied } from '@/components/ui/access-denied';
import { ActionButton } from '@/components/ui/action-button';
import { buttonClass } from '@/components/ui/button-styles';
import { Flash } from '@/components/ui/flash';
import { PageHeader } from '@/components/ui/page-header';
import { RecordStatusBadge } from '@/components/ui/record-status-badge';
import { ScrollTable } from '@/components/ui/scroll-table';
import { TD, TH } from '@/components/ui/table-styles';
import { firstValue, type SearchParams } from '@/lib/search-params';
import { setUserStatusAction } from '@/server/actions/users';
import { requireProfile } from '@/server/auth/guard';
import { listUsers } from '@/server/queries/users';
import { ROLE_LABELS } from './user-fields';

export default async function UsersPage({ searchParams }: { searchParams: SearchParams }) {
  const profile = await requireProfile();
  if (profile.role !== 'admin') return <AccessDenied />;
  const params = await searchParams;
  const users = await listUsers();

  return (
    <>
      <PageHeader
        title="Pengguna"
        description="Akun admin dan petugas. Username tidak dapat diubah setelah dibuat."
        actions={<Link href="/pengaturan/pengguna/baru" className={buttonClass('primary')}>Tambah Pengguna</Link>}
      />
      <Flash message={firstValue(params.pesan)} />

      <ScrollTable>
        <thead>
          <tr>
            <th className={TH}>Username</th>
            <th className={TH}>Nama</th>
            <th className={TH}>Peran</th>
            <th className={TH}>Status</th>
            <th className={TH}><span className="sr-only">Aksi</span></th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td className={`${TD} font-mono`}>{user.username}</td>
              <td className={TD}>{user.fullName}</td>
              <td className={TD}>{ROLE_LABELS[user.role]}</td>
              <td className={TD}><RecordStatusBadge status={user.status} /></td>
              <td className={TD}>
                <div className="flex items-start justify-end gap-2">
                  <Link href={`/pengaturan/pengguna/${user.id}`} className={buttonClass('secondary', 'sm')}>Ubah</Link>
                  {user.id === profile.id ? (
                    <span className="px-2.5 py-1 text-xs text-[var(--color-ink-500)]">Akun Anda</span>
                  ) : (
                    <ActionButton
                      action={setUserStatusAction.bind(null, user.id, user.status === 'active' ? 'inactive' : 'active')}
                      label={user.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                      confirmText={
                        user.status === 'active'
                          ? `Nonaktifkan ${user.username}? Pengguna ini tidak dapat masuk sampai diaktifkan kembali.`
                          : undefined
                      }
                    />
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </ScrollTable>
    </>
  );
}
```

Buat `src/app/(app)/pengaturan/pengguna/baru/page.tsx`:

```tsx
import { AccessDenied } from '@/components/ui/access-denied';
import { ActionForm } from '@/components/ui/action-form';
import { TextField } from '@/components/ui/fields';
import { PageHeader } from '@/components/ui/page-header';
import { createUserAction } from '@/server/actions/users';
import { requireProfile } from '@/server/auth/guard';
import { PasswordFields, ProfileFields } from '../user-fields';

export default async function NewUserPage() {
  const profile = await requireProfile();
  if (profile.role !== 'admin') return <AccessDenied />;

  return (
    <>
      <PageHeader title="Tambah Pengguna" />
      <ActionForm action={createUserAction} submitLabel="Buat Pengguna" cancelHref="/pengaturan/pengguna">
        <TextField
          name="username"
          label="Username"
          required
          autoFocus
          maxLength={30}
          hint="Huruf kecil, angka, titik, dan garis bawah, misalnya siti.aminah. Tidak dapat diubah setelah dibuat."
        />
        <ProfileFields />
        <PasswordFields />
      </ActionForm>
    </>
  );
}
```

Buat `src/app/(app)/pengaturan/pengguna/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { AccessDenied } from '@/components/ui/access-denied';
import { ActionForm } from '@/components/ui/action-form';
import { PageHeader } from '@/components/ui/page-header';
import { resetUserPasswordAction, updateUserAction } from '@/server/actions/users';
import { requireProfile } from '@/server/auth/guard';
import { getUser } from '@/server/queries/users';
import { PasswordFields, ProfileFields } from '../user-fields';

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile();
  if (profile.role !== 'admin') return <AccessDenied />;
  const { id } = await params;
  const user = await getUser(id);
  if (!user) notFound();

  return (
    <>
      <PageHeader title="Ubah Pengguna" description={`${user.username} · ${user.fullName}`} />
      <ActionForm
        action={updateUserAction.bind(null, user.id)}
        submitLabel="Simpan Perubahan"
        cancelHref="/pengaturan/pengguna"
      >
        <ProfileFields user={user} isSelf={user.id === profile.id} />
      </ActionForm>

      <h2 className="page-title mb-3 mt-8 text-lg font-semibold">Atur Ulang Kata Sandi</h2>
      <ActionForm action={resetUserPasswordAction.bind(null, user.id)} submitLabel="Ganti Kata Sandi">
        <PasswordFields />
      </ActionForm>
    </>
  );
}
```

- [ ] **Step 7: Jalankan uji halaman dan pastikan lulus**

Run: `npx vitest run "src/app/(app)/pengaturan/pengguna"`
Expected: PASS.

- [ ] **Step 8: Perbarui catatan akun pengembangan di README**

Di `README.md`, ganti paragraf di bawah tabel **Akun pengembangan** (yang diawali "Kata sandi `perpus123` sama untuk keduanya…") dengan:

```markdown
Kata sandi `perpus123` sama untuk keduanya dan hanya dimaksudkan untuk
pengembangan lokal. **Sebelum aplikasi dijalankan di produksi, ganti kata
sandi kedua akun ini** lewat **Pengaturan → Pengguna → Ubah → Atur Ulang
Kata Sandi**, atau nonaktifkan akun `petugas` bila tidak dipakai. Akun baru
untuk staf dibuat dari layar yang sama; tidak perlu membuka dasbor Supabase.
```

- [ ] **Step 9: Jalankan seluruh uji unit, lint, dan tsc**

Run: `npm test && npm run lint && npx tsc --noEmit`
Expected: seluruhnya PASS, lint dan tsc bersih.

- [ ] **Step 10: Commit**

```bash
git add src/server/actions/users.ts src/server/actions/users.test.ts \
  src/server/actions/auth.ts src/server/actions/auth.test.ts \
  "src/app/(app)/pengaturan/pengguna" README.md
git commit -m "$(cat <<'EOF'
feat(pengaturan): layar pengguna dan penolakan jelas untuk akun nonaktif

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Verifikasi Akhir

Tidak ada kode baru. Task ini membuktikan bahwa seluruh rencana bekerja bersama, di mesin dan di peramban, lalu mengembalikan data pengembangan ke keadaan semula.

**Files:**
- Tidak ada berkas yang dibuat. Pemeriksaan manual mengubah data di Supabase cloud; Step 5 mengembalikannya.

**Interfaces:**
- Consumes: seluruh keluaran Task 1–5
- Produces: bukti bahwa Rencana 03 selesai

- [ ] **Step 1: Jalankan seluruh pemeriksaan otomatis**

```bash
npm test
npm run test:integration
npm run lint
npx tsc --noEmit
npm run build
```

Harapan: seluruhnya lulus. `npm run build` mencantumkan rute `/pengaturan/tahun-ajaran`, `/pengaturan/konfigurasi`, `/pengaturan/pengguna`, beserta `/baru` dan `/[id]` untuk tahun ajaran dan pengguna.

- [ ] **Step 2: Pastikan uji integrasi tidak meninggalkan jejak**

`npx tsx -e "import(...)"` tidak dapat dipakai di repo ini (namespace modulnya berada di bawah `.default`). Pakai berkas sementara dengan impor statis, lalu hapus:

```bash
cat > tmp-sisa.ts <<'EOF'
import { sql } from 'drizzle-orm';
import { db } from './src/server/db/client';

async function main() {
  const [row] = await db.execute(sql`
    select
      (select count(*) from profiles where username like 'uji\_%')
    + (select count(*) from auth.users where email like 'uji\_%')
    + (select count(*) from academic_years where name >= '2090' or name like 'UJI-%')
    + (select count(*) from audit_logs where metadata::text like '%UJI-%')
    + (select count(*) from library_settings where school_name like 'UJI-%') as sisa
  `);
  console.log('Sisa data uji:', row?.sisa);
  process.exit(0);
}
main();
EOF
npx tsx --env-file=.env.local tmp-sisa.ts
rm tmp-sisa.ts
```

Harapan: `Sisa data uji: 0`. Angka lain berarti ada uji yang ditulis di luar `withRollback()`. Temukan dan perbaiki ujinya; jangan hapus datanya tanpa memahami asalnya.

- [ ] **Step 3: Uji alur lengkap di peramban**

Jalankan `npm run dev`. Bila memakai agen, gunakan skill `/browse` (bukan `mcp__claude-in-chrome__*`).

Sebagai **petugas** (`petugas` / `perpus123`):
1. Sidebar tidak menampilkan grup Pengaturan.
2. Membuka `/pengaturan/konfigurasi`, `/pengaturan/tahun-ajaran`, dan `/pengaturan/pengguna` langsung lewat URL → panel "Akses ditolak" dengan tombol kembali ke dashboard, tanpa data admin.

Sebagai **admin** (`admin` / `perpus123`), **Konfigurasi**:
3. Form terisi nilai saat ini (batas 3, durasi 3, denda 1000, "Tolak … terlambat" tercentang, "Tolak … denda belum lunas" tidak).
4. Lepas centang "Tolak … terlambat", isi durasi `0`, simpan → galat di kolom durasi; kotak "terlambat" **tetap tidak tercentang**.
5. Isi durasi `3`, denda `1.500`, simpan → pesan "Konfigurasi tersimpan…"; muat ulang halaman → denda `1500` dan kotak "terlambat" tidak tercentang.

**Tahun Ajaran**:
6. Tambah `2027/2029` → galat format nama. Tambah `2027/2028` dengan mulai `2026-07-01` → galat tanggal mulai menyebut tahun 2027.
7. Tambah `2027/2028`, mulai `2027-07-01`, selesai `2028-06-30`, **tanpa** centang "jadikan aktif" → kembali ke daftar; top bar masih "2026/2027".
8. Tekan **Jadikan Aktif** pada `2027/2028`, setujui konfirmasi → badge Aktif pindah; top bar kini "2027/2028".
9. Buka `/master/siswa/baru` → pilihan tahun ajaran terisi `2027/2028 (aktif)`.

**Pengguna**:
10. Baris `admin` bertanda "Akun Anda" tanpa tombol Nonaktifkan. Ubah akun `admin` sendiri ke peran Petugas → galat "Anda tidak dapat mengubah peran akun Anda sendiri…".
11. Tambah pengguna `qa_petugas` (nama "Petugas QA", peran Petugas) dengan kata sandi yang berbeda di kolom ulangan → galat pengulangan; **kedua kolom kata sandi kosong**, username dan nama tetap terisi.
12. Isi ulang kata sandi `qa-sandi-123` dua kali → kembali ke daftar dengan pesan sukses; `qa_petugas` tampil aktif.
13. Buka **Ubah** `qa_petugas` → **Atur Ulang Kata Sandi** ke `qa-sandi-456` → pesan "Kata sandi diganti…".
14. Keluar, masuk sebagai `qa_petugas` / `qa-sandi-456` → berhasil ke dashboard, tanpa grup Pengaturan. Keluar.
15. Masuk sebagai admin, **Nonaktifkan** `qa_petugas` (setujui konfirmasi). Keluar, masuk sebagai `qa_petugas` / `qa-sandi-456` → layar masuk menampilkan "Akun ini dinonaktifkan. Hubungi admin perpustakaan untuk mengaktifkannya kembali."

Di lebar tablet (`$B viewport 768x1024`):
16. Ketiga halaman Pengaturan dan form-formnya tidak membuat halaman melebar; tabel tahun ajaran dan pengguna digulir di dalam kotaknya.

Seluruh langkah harus dapat diselesaikan dengan papan ketik saja (Tab, Enter, Spasi).

- [ ] **Step 4: Periksa jejak audit dari alur di atas**

```bash
cat > tmp-audit.ts <<'EOF'
import { sql } from 'drizzle-orm';
import { db } from './src/server/db/client';

async function main() {
  const rows = await db.execute(sql`
    select a.action, p.username, a.metadata
    from audit_logs a join profiles p on p.id = a.user_id
    order by a.created_at desc limit 10
  `);
  console.table(rows);
  process.exit(0);
}
main();
EOF
npx tsx --env-file=.env.local tmp-audit.ts
rm tmp-audit.ts
```

Harapan, dari atas: `user.deactivate`, `user.reset_password`, `user.create`, `academic_year.activate` (metadata `previous: "2026/2027"`), `academic_year.create`, `settings.update` — seluruhnya oleh `admin`. **Tidak ada satu pun metadata yang memuat `qa-sandi`.**

- [ ] **Step 5: Kembalikan data pengembangan**

Sebagai admin, lewat layar:
1. **Tahun Ajaran:** Jadikan Aktif `2026/2027`. Biarkan `2027/2028` tersimpan tidak aktif; itu tahun ajaran sungguhan berikutnya dan tidak dapat dihapus (BR-08).
2. **Konfigurasi:** kembalikan denda ke `1000` dan centang lagi "Tolak … terlambat". Simpan.
3. **Pengguna:** biarkan `qa_petugas` nonaktif. Akun Supabase Auth-nya tetap ada; itu wajar untuk akun nonaktif.

Pastikan top bar kembali menampilkan "2026/2027".

- [ ] **Step 6: Tandai rencana selesai**

Ubah seluruh `- [ ]` di berkas rencana ini menjadi `- [x]`, lalu commit:

```bash
git add docs/superpowers/plans/2026-09-25-perpustakaan-03-pengaturan.md
git commit -m "$(cat <<'EOF'
docs: tandai Rencana 03 (Pengaturan) selesai

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Hasil Akhir Rencana 03

- Admin mengelola tahun ajaran dan memindahkan tahun aktif dengan satu tombol. Database dan kunci baris menjamin tepat satu tahun aktif, termasuk saat dua admin menekannya bersamaan.
- Aturan peminjaman (batas, durasi, denda, blokir) dan isi struk dapat diubah tanpa menyentuh kode (BR-09). `getLibrarySettings()` siap dipakai Rencana 04.
- Admin membuat akun staf, mengubah peran, mengatur ulang kata sandi, dan menonaktifkan akun tanpa membuka dasbor Supabase. Kegagalan di tengah pembuatan akun tidak meninggalkan akun yatim, dan admin tidak dapat mengunci dirinya sendiri.
- Akun nonaktif mendapat penjelasan di layar masuk, bukan dilempar balik tanpa kata.
- Kata sandi tidak pernah tercatat di audit log dan tidak pernah dikirim balik ke peramban.
- Petugas yang membuka halaman Pengaturan lewat URL melihat "Akses ditolak"; Server Action-nya menolak di server.
- Form tambah siswa tidak lagi diam-diam memasukkan siswa ke tahun ajaran lama.

## Yang Sengaja Belum Ada

| Hal | Alasan / Ditangani di |
|---|---|
| Peminjaman, pengembalian, pelunasan denda, riwayat | Rencana 04 |
| Tampilan audit log | Rencana 05 |
| Unggah logo sekolah | Kolom `school_logo_url` sudah ada; struk (spec 8.5) hanya mewajibkan nama sekolah |
| Kenaikan kelas massal saat tahun ajaran berganti | Spec 2.1: tanpa alur massal. Kelas siswa diubah per siswa; `loans.student_class` menyimpan snapshot |
| Pemeriksaan tumpang-tindih tanggal antar tahun ajaran | Nama harus dua tahun berurutan dan tanggal harus sesuai nama, sehingga tumpang-tindih praktis hanya terjadi antar tahun berurutan; belum ada kebutuhan operasional |
| Menghapus akun pengguna | BR-08: dinonaktifkan, tidak dihapus. Riwayat transaksi mereferensikan pembuatnya |
| Mencabut sesi Supabase saat akun dinonaktifkan | Tidak perlu: `getCurrentProfile()` menolak profil nonaktif di setiap request |
| Mengganti kata sandi sendiri oleh petugas | Spec Section 7: admin yang mengatur ulang. Dapat ditambah bila pengelola memintanya |

## Verifikasi Sebelum Melanjutkan ke Rencana 04

```bash
npm test                   # seluruh uji unit lulus
npm run test:integration   # seluruh uji integrasi lulus, tanpa sisa data uji
npm run lint               # bersih
npm run build              # sukses
```

Dan secara manual: admin dapat membuat akun petugas baru, petugas itu dapat masuk, dan setelah dinonaktifkan ia melihat pesan yang menjelaskan alasannya.
