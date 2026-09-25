import { SelectField, TextAreaField, TextField } from '@/components/ui/fields';
import type { Option } from '@/lib/options';
import type { Book } from '@/server/queries/books';

/** Kolom form buku, dipakai bersama halaman tambah dan detail. */
export function BookFields({
  book,
  categoryOptions,
  rackOptions,
}: {
  book?: Book;
  categoryOptions: Option[];
  rackOptions: Option[];
}) {
  return (
    <>
      <TextField name="title" label="Judul" defaultValue={book?.title} required autoFocus={!book} maxLength={200} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="author" label="Penulis" defaultValue={book?.author} required maxLength={150} />
        <TextField name="publisher" label="Penerbit" defaultValue={book?.publisher ?? ''} maxLength={150} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="isbn"
          label="ISBN"
          defaultValue={book?.isbn ?? ''}
          maxLength={20}
          hint="10 atau 13 digit; tanda hubung boleh diketik."
        />
        <TextField
          name="publishYear"
          label="Tahun terbit"
          inputMode="numeric"
          defaultValue={book?.publishYear?.toString() ?? ''}
          maxLength={4}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          name="categoryId"
          label="Kategori"
          placeholder="— Tanpa kategori —"
          defaultValue={book?.categoryId ?? ''}
          options={categoryOptions}
        />
        <SelectField
          name="rackId"
          label="Rak"
          placeholder="— Belum ditempatkan —"
          defaultValue={book?.rackId ?? ''}
          options={rackOptions}
        />
      </div>
      <TextField
        name="price"
        label="Harga (Rp)"
        inputMode="numeric"
        defaultValue={book ? String(Math.round(Number(book.price))) : ''}
        maxLength={12}
        hint="Dasar biaya ganti bila eksemplar rusak atau hilang. Boleh diketik dengan titik, misalnya 85.000."
      />
      <TextAreaField name="description" label="Deskripsi" defaultValue={book?.description ?? ''} rows={3} />
    </>
  );
}
