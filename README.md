This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Akun pengembangan (⚠️ jangan bawa ke produksi)

`npm run db:seed` membuat dua akun Supabase Auth untuk pengembangan lokal:

| Username  | Kata sandi  | Peran     |
| --------- | ----------- | --------- |
| `admin`   | `perpus123` | admin     |
| `petugas` | `perpus123` | petugas   |

Kata sandi `perpus123` sama untuk keduanya dan hanya dimaksudkan untuk
pengembangan lokal. **Sebelum aplikasi dijalankan di produksi, ganti kata
sandi kedua akun ini** lewat **Pengaturan → Pengguna → Ubah → Atur Ulang
Kata Sandi**, atau nonaktifkan akun `petugas` bila tidak dipakai. Akun baru
untuk staf dibuat dari layar yang sama; tidak perlu membuka dasbor Supabase.

## Uji

| Perintah | Isi | Butuh database |
| --- | --- | --- |
| `npm test` | Uji unit di `src/` | Tidak |
| `npm run test:integration` | Uji integrasi di `tests/integration/` | Ya, dari `.env.local` |

`DATABASE_URL` menunjuk ke database pengembangan di Supabase cloud yang
berisi data seed. Karena itu setiap uji integrasi berjalan di dalam
`withRollback()` (`tests/integration/helpers.ts`): transaksi selalu
di-rollback, sehingga uji tidak meninggalkan jejak. **Jangan pernah menulis
`truncate` atau `delete` tanpa `where` di uji integrasi.** Beri awalan `UJI-`
pada nilai unik buatan uji agar tidak bertabrakan dengan data seed.

Uji manajemen pengguna tidak membuat akun sungguhan di Supabase Auth.
Service pengguna menerima port `AuthAdmin`; uji memakai `fakeAuthAdmin(tx)`
yang menyisipkan baris `auth.users` di transaksi uji yang sama, sehingga ikut
di-rollback. Username uji berawalan `uji_`, dan tahun ajaran uji memakai
tahun 2090 ke atas, karena format keduanya tidak mengizinkan awalan `UJI-`.

Uji integrasi membutuhkan akun `admin` dari `npm run db:seed`.
