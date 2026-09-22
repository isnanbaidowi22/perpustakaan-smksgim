import { config } from 'dotenv';
config({ path: '.env.local' });

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

afterAll(async () => {
  // Bersihkan sisa data pengujian agar suite ini tidak meninggalkan jejak
  // (mis. buku 'Uji' bertabrakan dengan skema barcode skrip data awal).
  await sql`truncate loan_items, loans, book_copies, books, students, academic_years restart identity cascade`;
  await sql.end();
});

beforeEach(async () => {
  await sql`truncate loan_items, loans, book_copies, books, students, academic_years restart identity cascade`;
});

describe('batasan academic_years', () => {
  it('menolak dua tahun ajaran aktif sekaligus', async () => {
    await sql`insert into academic_years (name, start_date, end_date, is_active)
              values ('2026/2027', '2026-07-01', '2027-06-30', true)`;

    await expect(
      sql`insert into academic_years (name, start_date, end_date, is_active)
          values ('2027/2028', '2027-07-01', '2028-06-30', true)`,
    ).rejects.toThrow(/one_active_academic_year/);
  });

  it('mengizinkan banyak tahun ajaran tidak aktif', async () => {
    await sql`insert into academic_years (name, start_date, end_date, is_active)
              values ('2025/2026', '2025-07-01', '2026-06-30', false),
                     ('2026/2027', '2026-07-01', '2027-06-30', false)`;
    const rows = await sql`select count(*)::int as n from academic_years`;
    expect(rows[0].n).toBe(2);
  });

  it('menolak tanggal selesai sebelum tanggal mulai', async () => {
    await expect(
      sql`insert into academic_years (name, start_date, end_date)
          values ('salah', '2027-06-30', '2026-07-01')`,
    ).rejects.toThrow(/academic_years_range_valid/);
  });
});

describe('batasan book_copies', () => {
  it('menolak status di luar daftar yang sah', async () => {
    const [book] = await sql`insert into books (title, author) values ('Uji', 'Penulis') returning id`;
    await expect(
      sql`insert into book_copies (book_id, barcode, status)
          values (${book.id}, 'BK-000001', 'ENTAH')`,
    ).rejects.toThrow(/book_copies_status_valid/);
  });

  it('menolak barcode ganda', async () => {
    const [book] = await sql`insert into books (title, author) values ('Uji', 'Penulis') returning id`;
    await sql`insert into book_copies (book_id, barcode) values (${book.id}, 'BK-000001')`;
    await expect(
      sql`insert into book_copies (book_id, barcode) values (${book.id}, 'BK-000001')`,
    ).rejects.toThrow(/book_copies_barcode/);
  });
});
