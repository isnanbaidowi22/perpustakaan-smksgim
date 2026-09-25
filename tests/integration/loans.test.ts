import { describe, expect, it } from 'vitest';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { auditLogs, bookCopies, books, loanItems, loans, students } from '@/server/db/schema';
import { createLoan } from '@/server/services/loans';
import { circulationFixture, seedLoan, TODAY } from './circulation-fixture';
import { withRollback } from './helpers';

describe('createLoan — jalur normal', () => {
  it('mencatat peminjaman, mengubah eksemplar menjadi DIPINJAM, dan menulis audit', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      const copyIds = [fx.copies[0].id, fx.copies[1].id];

      const result = await createLoan({ studentId: fx.students[0].id, copyIds, notes: 'UJI catatan' }, fx.actor, TODAY, tx);

      if (!result.ok) throw new Error(JSON.stringify(result));
      expect(result).toEqual({ ok: true, id: result.id, transactionNumber: 'PJM-20900302-0001', dueDate: '2090-03-05' });

      const [loan] = await tx.select().from(loans).where(eq(loans.id, result.id));
      expect(loan).toMatchObject({
        studentId: fx.students[0].id,
        studentClass: 'XI UJI 1',
        academicYearId: fx.yearId,
        loanDate: TODAY,
        dueDate: '2090-03-05',
        status: 'AKTIF',
        notes: 'UJI catatan',
        createdBy: fx.actor.id,
      });

      const items = await tx.select({ copyId: loanItems.bookCopyId }).from(loanItems).where(eq(loanItems.loanId, result.id));
      expect(items.map((item) => item.copyId).sort()).toEqual([...copyIds].sort());

      const copies = await tx.select({ status: bookCopies.status }).from(bookCopies).where(inArray(bookCopies.id, copyIds));
      expect(copies.map((copy) => copy.status)).toEqual(['DIPINJAM', 'DIPINJAM']);

      const [audit] = await tx
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.entityId, result.id), eq(auditLogs.action, 'loan.create')));
      expect(audit?.metadata).toEqual({
        transactionNumber: 'PJM-20900302-0001',
        studentNis: 'UJI-S1',
        barcodes: ['UJI-SRK-01', 'UJI-SRK-02'],
        dueDate: '2090-03-05',
      });
    });
  });

  it('memberi nomor urut berikutnya untuk transaksi kedua di hari yang sama', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      await createLoan({ studentId: fx.students[0].id, copyIds: [fx.copies[0].id], notes: null }, fx.actor, TODAY, tx);

      const second = await createLoan({ studentId: fx.students[1].id, copyIds: [fx.copies[1].id], notes: null }, fx.actor, TODAY, tx);

      expect(second).toMatchObject({ ok: true, transactionNumber: 'PJM-20900302-0002' });
    });
  });
});

describe('createLoan — penolakan', () => {
  it('menolak eksemplar yang sedang dipinjam, menyebut peminjamnya, dan tidak menulis apa pun', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      await createLoan({ studentId: fx.students[0].id, copyIds: [fx.copies[0].id], notes: null }, fx.actor, TODAY, tx);

      const result = await createLoan({ studentId: fx.students[1].id, copyIds: [fx.copies[0].id], notes: null }, fx.actor, TODAY, tx);

      expect(result).toEqual({
        ok: false,
        violations: [{
          code: 'COPY_UNAVAILABLE',
          barcode: 'UJI-SRK-01',
          bookTitle: 'UJI-Buku Sirkulasi',
          status: 'DIPINJAM',
          borrowedBy: { name: 'UJI Siswa Satu', nis: 'UJI-S1', dueDate: '2090-03-05' },
        }],
      });
      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(loans)
        .where(eq(loans.studentId, fx.students[1].id));
      expect(count).toBe(0);
    });
  });

  it('menolak permintaan yang melebihi kuota', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      await createLoan({
        studentId: fx.students[0].id, copyIds: [fx.copies[0].id, fx.copies[1].id, fx.copies[2].id], notes: null,
      }, fx.actor, TODAY, tx);

      const result = await createLoan({ studentId: fx.students[0].id, copyIds: [fx.copies[3].id], notes: null }, fx.actor, TODAY, tx);

      expect(result).toEqual({
        ok: false,
        violations: [{
          code: 'QUOTA_EXCEEDED', studentName: 'UJI Siswa Satu', activeCount: 3, requestedCount: 1, maxActiveLoans: 3,
        }],
      });
    });
  });

  it('menolak siswa yang punya pinjaman terlambat', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      const late = await seedLoan(tx, fx, { student: 0, copies: [0], loanDate: '2090-02-20', dueDate: '2090-02-23' });

      const result = await createLoan({ studentId: fx.students[0].id, copyIds: [fx.copies[1].id], notes: null }, fx.actor, TODAY, tx);

      expect(result).toEqual({
        ok: false,
        violations: [{
          code: 'HAS_OVERDUE', studentName: 'UJI Siswa Satu', transactionNumber: late.transactionNumber, daysLate: 7,
        }],
      });
    });
  });

  it('menolak eksemplar milik buku nonaktif (spec 5.2 BOOK_INACTIVE)', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      await tx.update(books).set({ status: 'inactive' }).where(eq(books.id, fx.bookId));

      const result = await createLoan({ studentId: fx.students[0].id, copyIds: [fx.copies[0].id], notes: null }, fx.actor, TODAY, tx);

      expect(result).toEqual({
        ok: false,
        violations: [{ code: 'BOOK_INACTIVE', barcode: 'UJI-SRK-01', bookTitle: 'UJI-Buku Sirkulasi' }],
      });
    });
  });

  it('menolak bila tidak ada tahun ajaran aktif', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      await tx.execute(sql`update academic_years set is_active = false`);

      const result = await createLoan({ studentId: fx.students[0].id, copyIds: [fx.copies[0].id], notes: null }, fx.actor, TODAY, tx);

      expect(result).toEqual({ ok: false, violations: [{ code: 'NO_ACTIVE_YEAR' }] });
    });
  });

  it('menolak siswa nonaktif dan eksemplar yang dimasukkan dua kali', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);
      await tx.update(students).set({ status: 'inactive' }).where(eq(students.id, fx.students[0].id));

      const result = await createLoan({
        studentId: fx.students[0].id, copyIds: [fx.copies[0].id, fx.copies[0].id], notes: null,
      }, fx.actor, TODAY, tx);

      expect(result).toEqual({
        ok: false,
        violations: [
          { code: 'STUDENT_INACTIVE', studentName: 'UJI Siswa Satu' },
          { code: 'DUPLICATE_COPY', barcode: 'UJI-SRK-01', bookTitle: 'UJI-Buku Sirkulasi' },
        ],
      });
    });
  });

  it('menjelaskan siswa atau eksemplar yang tidak ditemukan', async () => {
    await withRollback(async (tx) => {
      const fx = await circulationFixture(tx);

      expect(await createLoan({ studentId: crypto.randomUUID(), copyIds: [fx.copies[0].id], notes: null }, fx.actor, TODAY, tx))
        .toEqual({ ok: false, message: 'Siswa tidak ditemukan. Cari ulang siswa dengan NIS atau nama.' });
      expect(await createLoan({ studentId: fx.students[0].id, copyIds: [crypto.randomUUID()], notes: null }, fx.actor, TODAY, tx))
        .toEqual({ ok: false, message: 'Salah satu eksemplar tidak ditemukan. Pindai ulang barcode bukunya.' });
    });
  });
});
