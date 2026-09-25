import { asc, eq, inArray, sql } from 'drizzle-orm';
import { calculateDueDate } from '@/domain/loan/due-date';
import { validateLoanRequest } from '@/domain/loan/rules';
import { formatTransactionNumber, loanCounterScope } from '@/domain/loan/transaction-number';
import type { IsoDate } from '@/domain/shared/date';
import type { Actor, CopySnapshot } from '@/domain/shared/types';
import type { Violation } from '@/domain/shared/violations';
import { writeAudit } from '@/server/audit';
import { db } from '@/server/db/client';
import { uniqueViolation } from '@/server/db/errors';
import type { Executor, Transaction } from '@/server/db/executor';
import { bookCopies, books, counters, loanItems, loans, students } from '@/server/db/schema';
import { getActiveAcademicYear } from '@/server/queries/academic-years';
import { borrowersOf, loadBorrowerLoans } from '@/server/queries/circulation';
import { getLibrarySettings } from '@/server/queries/settings';
import { isUuid } from '@/server/validation/common';
import type { CreateLoanInput } from '@/server/validation/loan';

export type LoanResult =
  | { ok: true; id: string; transactionNumber: string; dueDate: IsoDate }
  | { ok: false; violations: Violation[] }
  | { ok: false; message: string };

const STUDENT_NOT_FOUND = 'Siswa tidak ditemukan. Cari ulang siswa dengan NIS atau nama.';
const COPY_NOT_FOUND = 'Salah satu eksemplar tidak ditemukan. Pindai ulang barcode bukunya.';
const COPY_RACE = 'Salah satu eksemplar baru saja dipinjam di transaksi lain. Periksa daftar buku lalu simpan kembali.';

/**
 * Spec 6.1 langkah 3, inti pertahanan integritas: seluruh eksemplar yang
 * diminta dikunci `FOR UPDATE` dan statusnya dibaca DI PERNYATAAN YANG SAMA.
 * Petugas kedua yang meminta eksemplar yang sama menunggu kunci dilepas, lalu
 * membaca status terbaru. Urutan kunci menurut id mencegah deadlock antara
 * dua transaksi yang meminta beberapa eksemplar yang sama.
 *
 * Mengembalikan snapshot dalam urutan permintaan (termasuk duplikat, agar
 * domain dapat melaporkan DUPLICATE_COPY), atau null bila ada yang tidak ada.
 */
async function lockRequestedCopies(tx: Transaction, copyIds: string[]): Promise<CopySnapshot[] | null> {
  const unique = [...new Set(copyIds)];
  if (unique.length === 0) return [];
  if (!unique.every((id) => isUuid(id))) return null;

  const rows = await tx
    .select({
      id: bookCopies.id,
      barcode: bookCopies.barcode,
      status: bookCopies.status,
      bookTitle: books.title,
      bookStatus: books.status,
    })
    .from(bookCopies)
    .innerJoin(books, eq(books.id, bookCopies.bookId))
    .where(inArray(bookCopies.id, unique))
    .orderBy(asc(bookCopies.id))
    .for('update', { of: bookCopies });
  if (rows.length !== unique.length) return null;

  const borrowers = await borrowersOf(rows.filter((row) => row.status === 'DIPINJAM').map((row) => row.id), tx);
  const byId = new Map<string, CopySnapshot>(rows.map((row) => {
    const borrowedBy = borrowers.get(row.id);
    return [row.id, borrowedBy ? { ...row, borrowedBy } : row];
  }));
  return copyIds.flatMap((id) => {
    const copy = byId.get(id);
    return copy ? [copy] : [];
  });
}

/**
 * Spec 6.3: nomor urut harian dari baris counter yang terkunci sampai commit.
 * `count(*)` transaksi hari ini rawan tabrakan di bawah konkurensi.
 */
async function nextLoanSequence(tx: Transaction, date: IsoDate): Promise<number> {
  const [row] = await tx
    .insert(counters)
    .values({ scope: loanCounterScope(date), value: 1 })
    .onConflictDoUpdate({ target: counters.scope, set: { value: sql`${counters.value} + 1` } })
    .returning({ value: counters.value });
  return row.value;
}

export async function createLoan(
  input: CreateLoanInput,
  actor: Actor,
  today: IsoDate,
  executor: Executor = db,
): Promise<LoanResult> {
  if (!isUuid(input.studentId)) return { ok: false, message: STUDENT_NOT_FOUND };
  try {
    return await executor.transaction(async (tx): Promise<LoanResult> => {
      // 1. Konfigurasi dan tahun ajaran aktif.
      const settings = await getLibrarySettings(tx);
      const activeYear = await getActiveAcademicYear(tx);

      // 2. Kunci siswa: dua peminjaman untuk siswa yang sama berjalan bergiliran,
      //    sehingga kuotanya tidak terlewati oleh dua petugas sekaligus.
      const [student] = await tx
        .select({
          id: students.id,
          nis: students.nis,
          name: students.name,
          className: students.className,
          status: students.status,
        })
        .from(students)
        .where(eq(students.id, input.studentId))
        .for('update');
      if (!student) return { ok: false, message: STUDENT_NOT_FOUND };
      const openLoans = await loadBorrowerLoans(student.id, tx);

      // 3. Kunci seluruh eksemplar yang diminta.
      const requestedCopies = await lockRequestedCopies(tx, input.copyIds);
      if (requestedCopies === null) return { ok: false, message: COPY_NOT_FOUND };

      // 4–5. Validasi dengan keadaan yang baru saja dibaca; belum ada yang ditulis.
      const verdict = validateLoanRequest({
        student,
        openLoans,
        requestedCopies,
        settings,
        hasActiveAcademicYear: activeYear !== null,
        today,
      });
      if (!verdict.ok) return { ok: false, violations: verdict.violations };
      // Tidak tercapai (domain sudah menolak NO_ACTIVE_YEAR); menyempitkan tipe.
      if (!activeYear) return { ok: false, violations: [{ code: 'NO_ACTIVE_YEAR' }] };

      // 6. Nomor transaksi.
      const transactionNumber = formatTransactionNumber(today, await nextLoanSequence(tx, today));
      const dueDate = calculateDueDate(today, settings.loanDurationDays);

      // 7. Pinjaman (dengan snapshot kelas) dan itemnya.
      const [loan] = await tx
        .insert(loans)
        .values({
          transactionNumber,
          studentId: student.id,
          studentClass: student.className,
          academicYearId: activeYear.id,
          loanDate: today,
          dueDate,
          notes: input.notes,
          createdBy: actor.id,
        })
        .returning({ id: loans.id });
      await tx.insert(loanItems).values(requestedCopies.map((copy) => ({ loanId: loan.id, bookCopyId: copy.id })));

      // 8. Status eksemplar.
      await tx
        .update(bookCopies)
        .set({ status: 'DIPINJAM', updatedAt: new Date() })
        .where(inArray(bookCopies.id, requestedCopies.map((copy) => copy.id)));

      // 9. Audit di transaksi yang sama.
      await writeAudit(tx, {
        actorId: actor.id,
        action: 'loan.create',
        entity: 'loans',
        entityId: loan.id,
        metadata: {
          transactionNumber,
          studentNis: student.nis,
          barcodes: requestedCopies.map((copy) => copy.barcode),
          dueDate,
        },
      });
      return { ok: true, id: loan.id, transactionNumber, dueDate };
    });
  } catch (error) {
    // Jaring pengaman tingkat database (spec 4.2); hanya tercapai bila
    // penguncian di atas cacat.
    if (uniqueViolation(error) === 'one_open_loan_per_copy') return { ok: false, message: COPY_RACE };
    throw error;
  }
}
