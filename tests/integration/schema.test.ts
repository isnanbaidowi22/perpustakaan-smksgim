import { describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { expectConstraint, withRollback } from './helpers';

describe('batasan academic_years', () => {
  it('menolak dua tahun ajaran aktif sekaligus', async () => {
    await withRollback(async (tx) => {
      // Database pengembangan sudah punya tahun ajaran aktif dari seed.
      // Matikan dulu di dalam transaksi ini agar uji tidak bergantung padanya.
      await tx.execute(sql`update academic_years set is_active = false`);
      await tx.execute(sql`insert into academic_years (name, start_date, end_date, is_active)
                           values ('UJI-2090/2091', '2090-07-01', '2091-06-30', true)`);

      await expectConstraint(
        tx.execute(sql`insert into academic_years (name, start_date, end_date, is_active)
                       values ('UJI-2091/2092', '2091-07-01', '2092-06-30', true)`),
        'one_active_academic_year',
      );
    });
  });

  it('mengizinkan banyak tahun ajaran tidak aktif', async () => {
    await withRollback(async (tx) => {
      await tx.execute(sql`insert into academic_years (name, start_date, end_date, is_active)
                           values ('UJI-2088/2089', '2088-07-01', '2089-06-30', false),
                                  ('UJI-2089/2090', '2089-07-01', '2090-06-30', false)`);
      const rows = await tx.execute<{ n: number }>(
        sql`select count(*)::int as n from academic_years where name like 'UJI-%'`,
      );
      expect(rows[0].n).toBe(2);
    });
  });

  it('menolak tanggal selesai sebelum tanggal mulai', async () => {
    await withRollback(async (tx) => {
      await expectConstraint(
        tx.execute(sql`insert into academic_years (name, start_date, end_date)
                       values ('UJI-salah', '2091-06-30', '2090-07-01')`),
        'academic_years_range_valid',
      );
    });
  });
});

describe('batasan book_copies', () => {
  it('menolak status di luar daftar yang sah', async () => {
    await withRollback(async (tx) => {
      const [book] = await tx.execute<{ id: string }>(
        sql`insert into books (title, author) values ('UJI-Judul', 'UJI-Penulis') returning id`,
      );
      await expectConstraint(
        tx.execute(sql`insert into book_copies (book_id, barcode, status)
                       values (${book.id}, 'UJI-000001', 'ENTAH')`),
        'book_copies_status_valid',
      );
    });
  });

  it('menolak barcode ganda', async () => {
    await withRollback(async (tx) => {
      const [book] = await tx.execute<{ id: string }>(
        sql`insert into books (title, author) values ('UJI-Judul', 'UJI-Penulis') returning id`,
      );
      await tx.execute(sql`insert into book_copies (book_id, barcode) values (${book.id}, 'UJI-000001')`);
      await expectConstraint(
        tx.execute(sql`insert into book_copies (book_id, barcode) values (${book.id}, 'UJI-000001')`),
        'book_copies_barcode_unique',
      );
    });
  });
});
