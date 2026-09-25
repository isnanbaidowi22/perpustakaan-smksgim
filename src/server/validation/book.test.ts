import { describe, expect, it } from 'vitest';
import { bookSchema } from './book';

const valid = {
  isbn: '978-602-1234-56-7',
  title: 'Pemrograman Web',
  author: 'Budi Raharjo',
  publisher: 'Informatika',
  publishYear: '2024',
  categoryId: '',
  rackId: '',
  price: '85.000',
  description: '',
};

function messages(input: Record<string, string>) {
  const result = bookSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe('bookSchema', () => {
  it('menormalkan ISBN, tahun, harga, dan pilihan kosong', () => {
    expect(bookSchema.parse(valid)).toEqual({
      isbn: '9786021234567',
      title: 'Pemrograman Web',
      author: 'Budi Raharjo',
      publisher: 'Informatika',
      publishYear: 2024,
      categoryId: null,
      rackId: null,
      price: 85_000,
      description: null,
    });
  });

  it('menerima ISBN-10 dengan digit pemeriksa X kecil', () => {
    expect(bookSchema.parse({ ...valid, isbn: '0-306-40615-x' }).isbn).toBe('030640615X');
  });

  it('mengizinkan ISBN dan harga kosong', () => {
    const parsed = bookSchema.parse({ ...valid, isbn: '', price: '' });
    expect(parsed.isbn).toBeNull();
    expect(parsed.price).toBe(0);
  });

  it('menolak ISBN yang panjangnya salah', () => {
    expect(messages({ ...valid, isbn: '12345' })).toEqual([
      'ISBN harus 10 atau 13 digit. Tanda hubung boleh diketik.',
    ]);
  });

  it('mewajibkan judul dan penulis', () => {
    expect(messages({ ...valid, title: '', author: ' ' })).toEqual([
      'Judul buku wajib diisi.',
      'Penulis wajib diisi.',
    ]);
  });
});
