import { asc, eq, inArray, sql } from 'drizzle-orm';
import type { IsoDate } from '@/domain/shared/date';
import type { Actor, LoanStatus } from '@/domain/shared/types';
import type { Transaction } from '@/server/db/executor';
import {
  academicYears, bookCopies, books, librarySettings, loanItems, loans, racks, students,
} from '@/server/db/schema';
import { testActor } from './helpers';

/**
 * Hari uji. Jauh di masa depan agar penghitung nomor transaksi harian
 * ('loan:20900302') tidak pernah bertabrakan dengan transaksi sungguhan.
 */
export const TODAY: IsoDate = '2090-03-02';

export interface FixtureStudent {
  id: string;
  nis: string;
  name: string;
  className: string;
}

export interface FixtureCopy {
  id: string;
  barcode: string;
}

export interface CirculationFixture {
  actor: Actor;
  yearId: string;
  bookId: string;
  bookTitle: string;
  copies: FixtureCopy[];
  students: FixtureStudent[];
}

/**
 * Dunia kecil untuk uji transaksi, seluruhnya di dalam transaksi uji yang
 * di-rollback: tahun ajaran aktif sendiri, konfigurasi yang diketahui
 * (kuota 3, durasi 3 hari, denda Rp1.000, blokir terlambat), satu buku
 * seharga Rp50.000 di rak UJI-R1 dengan eksemplar UJI-SRK-01…, dan dua siswa.
 * Uji tidak bergantung pada data seed atau konfigurasi cloud saat itu.
 */
export async function circulationFixture(
  tx: Transaction,
  options: { copies?: number; bookPrice?: number } = {},
): Promise<CirculationFixture> {
  const actor = await testActor(tx);

  await tx.execute(sql`update academic_years set is_active = false`);
  const [year] = await tx
    .insert(academicYears)
    .values({ name: 'UJI-2089/2090', startDate: '2089-07-01', endDate: '2090-06-30', isActive: true })
    .returning({ id: academicYears.id });

  const rules = {
    maxActiveLoans: 3,
    loanDurationDays: 3,
    finePerDay: '1000',
    blockWhenOverdue: true,
    blockWhenUnpaidFine: false,
  };
  await tx.insert(librarySettings).values({ id: 1, ...rules })
    .onConflictDoUpdate({ target: librarySettings.id, set: rules });

  const [rack] = await tx.insert(racks).values({ code: 'UJI-R1', name: 'UJI Rak Sirkulasi' }).returning({ id: racks.id });
  const bookTitle = 'UJI-Buku Sirkulasi';
  const [book] = await tx
    .insert(books)
    .values({ title: bookTitle, author: 'UJI-Penulis', rackId: rack.id, price: String(options.bookPrice ?? 50_000) })
    .returning({ id: books.id });

  const count = options.copies ?? 5;
  await tx.insert(bookCopies).values(
    Array.from({ length: count }, (_, index) => ({
      bookId: book.id,
      barcode: `UJI-SRK-${String(index + 1).padStart(2, '0')}`,
    })),
  );
  const copies = await tx
    .select({ id: bookCopies.id, barcode: bookCopies.barcode })
    .from(bookCopies)
    .where(eq(bookCopies.bookId, book.id))
    .orderBy(asc(bookCopies.barcode));

  await tx.insert(students).values([
    { nis: 'UJI-S1', name: 'UJI Siswa Satu', className: 'XI UJI 1', academicYearId: year.id },
    { nis: 'UJI-S2', name: 'UJI Siswa Dua', className: 'XI UJI 2', academicYearId: year.id },
  ]);
  const studentRows = await tx
    .select({ id: students.id, nis: students.nis, name: students.name, className: students.className })
    .from(students)
    .where(inArray(students.nis, ['UJI-S1', 'UJI-S2']))
    .orderBy(asc(students.nis));

  return { actor, yearId: year.id, bookId: book.id, bookTitle, copies, students: studentRows };
}

let seededLoans = 0;

/**
 * Menyisipkan peminjaman langsung, tanpa createLoan, untuk menyiapkan keadaan
 * yang sulit dicapai lewat service (pinjaman lama yang terlambat, pinjaman
 * selesai yang dendanya belum lunas). `copies` dan `returned` adalah indeks
 * ke `fx.copies`; `returned` harus bagian dari `copies`.
 */
export async function seedLoan(
  tx: Transaction,
  fx: CirculationFixture,
  options: {
    student: number;
    copies: number[];
    loanDate: IsoDate;
    dueDate: IsoDate;
    returned?: number[];
    totalFine?: number;
  },
): Promise<{ id: string; transactionNumber: string }> {
  const returned = new Set(options.returned ?? []);
  const status: LoanStatus = returned.size === 0
    ? 'AKTIF'
    : returned.size === options.copies.length ? 'SELESAI' : 'SEBAGIAN_KEMBALI';
  seededLoans += 1;
  const transactionNumber = `UJI-PJM-${String(seededLoans).padStart(4, '0')}`;
  const student = fx.students[options.student];

  const [loan] = await tx
    .insert(loans)
    .values({
      transactionNumber,
      studentId: student.id,
      studentClass: student.className,
      academicYearId: fx.yearId,
      loanDate: options.loanDate,
      dueDate: options.dueDate,
      status,
      totalFine: String(options.totalFine ?? 0),
      createdBy: fx.actor.id,
    })
    .returning({ id: loans.id });

  await tx.insert(loanItems).values(options.copies.map((index) => ({
    loanId: loan.id,
    bookCopyId: fx.copies[index].id,
    returnedAt: returned.has(index) ? new Date() : null,
    returnCondition: returned.has(index) ? ('BAIK' as const) : null,
  })));

  const onLoan = options.copies.filter((index) => !returned.has(index)).map((index) => fx.copies[index].id);
  if (onLoan.length > 0) {
    await tx.update(bookCopies).set({ status: 'DIPINJAM' }).where(inArray(bookCopies.id, onLoan));
  }
  return { id: loan.id, transactionNumber };
}
