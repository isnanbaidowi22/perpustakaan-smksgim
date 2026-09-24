import { createClient } from '@supabase/supabase-js';
import { and, eq } from 'drizzle-orm';
import { db, schema } from './client';

/**
 * `books` tidak memiliki batasan unik (dua edisi berbeda boleh berbagi judul
 * dan penulis), sehingga `onConflictDoNothing()` di situ tidak berlaku apa-apa.
 * Skrip ini jujur soal itu: cari baris yang cocok dulu, baru sisipkan bila
 * belum ada — supaya menjalankan ulang skrip ini tidak menggandakan judul.
 */
async function findOrCreateBook(values: typeof schema.books.$inferInsert) {
  const [existing] = await db.select().from(schema.books)
    .where(and(eq(schema.books.title, values.title), eq(schema.books.author, values.author)))
    .limit(1);
  if (existing) return existing;

  const [created] = await db.insert(schema.books).values(values).returning();
  return created;
}

async function seedUsers() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const accounts = [
    { username: 'admin', fullName: 'Administrator', role: 'admin' as const },
    { username: 'petugas', fullName: 'Petugas Perpustakaan', role: 'petugas' as const },
  ];

  for (const account of accounts) {
    const { data, error } = await admin.auth.admin.createUser({
      email: `${account.username}@${process.env.INTERNAL_EMAIL_DOMAIN ?? 'perpus.local'}`,
      password: 'perpus123',
      email_confirm: true,
    });
    if (error) {
      console.log(`  ${account.username}: ${error.message} — dilewati`);
      continue;
    }
    await db.insert(schema.profiles).values({
      id: data.user.id,
      username: account.username,
      fullName: account.fullName,
      role: account.role,
    }).onConflictDoNothing();
    console.log(`  Akun dibuat: ${account.username} / perpus123`);
  }
}

async function seed() {
  console.log('Mengisi data awal…');

  await db.insert(schema.librarySettings).values({
    id: 1,
    schoolName: 'SMK Negeri 1 Contoh',
    receiptFooter: 'Terima kasih. Simpan struk ini sebagai bukti peminjaman.',
  }).onConflictDoNothing();

  const [year] = await db.insert(schema.academicYears).values({
    name: '2026/2027',
    startDate: '2026-07-01',
    endDate: '2027-06-30',
    isActive: true,
  }).onConflictDoNothing().returning();

  const categories = await db.insert(schema.categories).values([
    { name: 'Teknologi Informasi' },
    { name: 'Matematika' },
    { name: 'Bahasa dan Sastra' },
  ]).onConflictDoNothing().returning();

  const racks = await db.insert(schema.racks).values([
    { code: 'A-1', name: 'Rak A Baris 1', location: 'Ruang Utama' },
    { code: 'A-3', name: 'Rak A Baris 3', location: 'Ruang Utama' },
  ]).onConflictDoNothing().returning();

  const books = await Promise.all([
    findOrCreateBook({ title: 'Pemrograman Web', author: 'Budi Raharjo', publisher: 'Informatika',
      publishYear: 2024, price: '85000', categoryId: categories[0]?.id, rackId: racks[1]?.id }),
    findOrCreateBook({ title: 'Basis Data Lanjut', author: 'Siti Nurhaliza', publisher: 'Andi',
      publishYear: 2023, price: '92000', categoryId: categories[0]?.id, rackId: racks[0]?.id }),
  ]);

  // Tiga eksemplar per judul, cukup untuk menguji aturan kuota tiga buku.
  let sequence = 1;
  const copies = books.flatMap((book) =>
    Array.from({ length: 3 }, () => ({
      bookId: book.id,
      barcode: `BK-${String(sequence++).padStart(6, '0')}`,
      acquisitionDate: '2026-07-15',
    })),
  );
  await db.insert(schema.bookCopies).values(copies).onConflictDoNothing();

  await db.insert(schema.students).values([
    { nis: '202600123', name: 'Ahmad Fauzi', className: 'XI RPL 1', major: 'RPL',
      gender: 'L', academicYearId: year?.id },
    { nis: '202600456', name: 'Siti Aminah', className: 'XI RPL 1', major: 'RPL',
      gender: 'P', academicYearId: year?.id },
  ]).onConflictDoNothing();

  await seedUsers();

  console.log(`Selesai: ${books.length} judul, ${copies.length} eksemplar, 2 siswa.`);
  process.exit(0);
}

seed().catch((error) => {
  console.error('Pengisian data awal gagal:', error);
  process.exit(1);
});
