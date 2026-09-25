import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { formError } from '@/lib/form-state';
import { ActionForm } from './action-form';
import { SelectField, TextAreaField, TextField } from './fields';

describe('ActionForm', () => {
  it('menampilkan kolom, tombol simpan, dan tautan batal', () => {
    const html = renderToStaticMarkup(
      <ActionForm action={vi.fn()} submitLabel="Simpan Kategori" cancelHref="/master/kategori">
        <TextField name="name" label="Nama kategori" required />
      </ActionForm>,
    );
    expect(html).toContain('name="name"');
    expect(html).toContain('Simpan Kategori');
    expect(html).toContain('href="/master/kategori"');
    expect(html).not.toContain('role="alert"');
  });

  it('menampilkan galat umum, galat kolom, dan isian terakhir setelah validasi gagal', () => {
    const state = formError(
      'Kategori belum dapat disimpan. Periksa kolom yang ditandai.',
      { name: ['Nama kategori wajib diisi.'] },
      { name: 'Fik', note: 'catatan lama' },
    );
    const html = renderToStaticMarkup(
      <ActionForm action={vi.fn()} submitLabel="Simpan" initialState={state}>
        <TextField name="name" label="Nama kategori" defaultValue="" />
        <TextAreaField name="note" label="Catatan" />
      </ActionForm>,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('Kategori belum dapat disimpan. Periksa kolom yang ditandai.');
    expect(html).toContain('Nama kategori wajib diisi.');
    expect(html).toContain('value="Fik"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('catatan lama');
  });

  it('SelectField menampilkan opsi kosong dan memilih nilai bawaan', () => {
    const html = renderToStaticMarkup(
      <ActionForm action={vi.fn()} submitLabel="Simpan">
        <SelectField
          name="categoryId"
          label="Kategori"
          placeholder="— Tanpa kategori —"
          defaultValue="c2"
          options={[{ value: 'c1', label: 'Fiksi' }, { value: 'c2', label: 'Sains' }]}
        />
      </ActionForm>,
    );
    expect(html).toContain('— Tanpa kategori —');
    expect(html).toMatch(/<option value="c2" selected="">Sains<\/option>/);
  });
});
