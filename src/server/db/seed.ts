import { db, schema } from './client';

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

  const books = await db.insert(schema.books).values([
    { title: 'Pemrograman Web', author: 'Budi Raharjo', publisher: 'Informatika',
      publishYear: 2024, price: '85000', categoryId: categories[0]?.id, rackId: racks[1]?.id },
    { title: 'Basis Data Lanjut', author: 'Siti Nurhaliza', publisher: 'Andi',
      publishYear: 2023, price: '92000', categoryId: categories[0]?.id, rackId: racks[0]?.id },
  ]).onConflictDoNothing().returning();

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

  console.log(`Selesai: ${books.length} judul, ${copies.length} eksemplar, 2 siswa.`);
  process.exit(0);
}

seed().catch((error) => {
  console.error('Pengisian data awal gagal:', error);
  process.exit(1);
});
