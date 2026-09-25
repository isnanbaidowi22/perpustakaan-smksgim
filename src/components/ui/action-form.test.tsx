import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { formError } from '@/lib/form-state';
import { ActionForm } from './action-form';
import { CheckboxField, SelectField, TextAreaField, TextField } from './fields';

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

  it('CheckboxField mengirim "off" lewat kolom tersembunyi dan mengikuti nilai bawaan', () => {
    const html = renderToStaticMarkup(
      <ActionForm action={vi.fn()} submitLabel="Simpan">
        <CheckboxField name="blockWhenOverdue" label="Tolak bila terlambat" defaultChecked />
      </ActionForm>,
    );
    expect(html).toMatch(/<input type="hidden" name="blockWhenOverdue" value="off"\/?>/);
    expect(html).toMatch(/type="checkbox"[^>]*checked=""/);
  });

  it('CheckboxField tetap tidak dicentang setelah validasi kolom lain gagal', () => {
    const state = formError(
      'Konfigurasi belum dapat disimpan. Periksa kolom yang ditandai.',
      { loanDurationDays: ['Durasi pinjam harus bilangan bulat 1 sampai 90 hari.'] },
      { blockWhenOverdue: 'off', loanDurationDays: '0' },
    );
    const html = renderToStaticMarkup(
      <ActionForm action={vi.fn()} submitLabel="Simpan" initialState={state}>
        <CheckboxField name="blockWhenOverdue" label="Tolak bila terlambat" defaultChecked />
      </ActionForm>,
    );
    expect(html).not.toMatch(/checked=""/);
  });

  it('TextField kata sandi memakai type password dan petunjuk isi otomatis', () => {
    const html = renderToStaticMarkup(
      <ActionForm action={vi.fn()} submitLabel="Simpan">
        <TextField name="password" label="Kata sandi" type="password" autoComplete="new-password" />
      </ActionForm>,
    );
    expect(html).toContain('type="password"');
    // React 19 SSR merender atribut ini sebagai `autoComplete` (bukan
    // `autocomplete`), berbeda dari asumsi markup di brief; faktanya sama.
    expect(html).toMatch(/autocomplete="new-password"/i);
  });
});
