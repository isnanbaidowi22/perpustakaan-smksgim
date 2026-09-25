import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  isRecordStatus, isUuid, optionalInteger, optionalText, optionalUuid, requiredText, rupiah,
} from './common';

function messageOf(result: z.ZodSafeParseResult<unknown>): string | undefined {
  return result.success ? undefined : result.error.issues[0]?.message;
}

describe('requiredText', () => {
  const schema = requiredText('Nama kategori wajib diisi.', 10);

  it('membuang spasi di ujung', () => {
    expect(schema.parse('  Fiksi  ')).toBe('Fiksi');
  });

  it('menolak isian kosong atau hanya spasi dengan pesan yang diberikan', () => {
    expect(messageOf(schema.safeParse('   '))).toBe('Nama kategori wajib diisi.');
  });

  it('menolak isian yang tidak dikirim sama sekali dengan pesan yang sama', () => {
    expect(messageOf(schema.safeParse(undefined))).toBe('Nama kategori wajib diisi.');
  });

  it('menolak isian melebihi batas panjang', () => {
    expect(messageOf(schema.safeParse('Sebelas kar'))).toBe('Maksimal 10 karakter.');
  });
});

describe('optionalText', () => {
  it('menyimpan isian kosong sebagai null, bukan untai kosong', () => {
    expect(optionalText().parse('   ')).toBeNull();
    expect(optionalText().parse(undefined)).toBeNull();
  });

  it('membuang spasi di ujung isian yang terisi', () => {
    expect(optionalText().parse(' Ruang Utama ')).toBe('Ruang Utama');
  });
});

describe('optionalUuid', () => {
  const schema = optionalUuid('Kategori tidak valid. Pilih dari daftar.');

  it('menganggap opsi kosong sebagai null', () => {
    expect(schema.parse('')).toBeNull();
  });

  it('menerima UUID', () => {
    const id = '6f1c2b1e-4b1a-4c3e-9f7a-2d1e3c4b5a6f';
    expect(schema.parse(id)).toBe(id);
  });

  it('menolak nilai yang bukan UUID', () => {
    expect(messageOf(schema.safeParse('bukan-uuid'))).toBe('Kategori tidak valid. Pilih dari daftar.');
  });
});

describe('optionalInteger', () => {
  const schema = optionalInteger('Tahun terbit harus antara 1800 dan 2100.', 1800, 2100);

  it('menganggap isian kosong sebagai null', () => {
    expect(schema.parse('')).toBeNull();
  });

  it('mengubah teks angka menjadi bilangan', () => {
    expect(schema.parse('2024')).toBe(2024);
  });

  it.each(['19x', '1799', '2101', '2024.5'])('menolak %s', (value) => {
    expect(messageOf(schema.safeParse(value))).toBe('Tahun terbit harus antara 1800 dan 2100.');
  });
});

describe('rupiah', () => {
  const schema = rupiah('Harga harus bilangan bulat rupiah, minimal 0.');

  it('menerima titik pemisah ribuan yang biasa diketik petugas', () => {
    expect(schema.parse('85.000')).toBe(85_000);
  });

  it('menganggap isian kosong sebagai nol', () => {
    expect(schema.parse('')).toBe(0);
  });

  it.each(['-1', 'delapan', '1,5'])('menolak %s', (value) => {
    expect(messageOf(schema.safeParse(value))).toBe('Harga harus bilangan bulat rupiah, minimal 0.');
  });
});

describe('penjaga tipe', () => {
  it('isUuid mengenali UUID dan menolak selainnya', () => {
    expect(isUuid('6f1c2b1e-4b1a-4c3e-9f7a-2d1e3c4b5a6f')).toBe(true);
    expect(isUuid('c1')).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });

  it('isRecordStatus hanya menerima active dan inactive', () => {
    expect(isRecordStatus('active')).toBe(true);
    expect(isRecordStatus('inactive')).toBe(true);
    expect(isRecordStatus('deleted')).toBe(false);
  });
});
