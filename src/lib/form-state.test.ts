import { describe, expect, it } from 'vitest';
import { formError, formSuccess, formToObject, IDLE } from './form-state';

describe('formToObject', () => {
  it('mengambil isian teks dan membuang kunci internal React', () => {
    const data = new FormData();
    data.set('name', 'Fiksi');
    data.set('$ACTION_ID_abc', '');
    expect(formToObject(data)).toEqual({ name: 'Fiksi' });
  });

  it('membuang berkas unggahan', () => {
    const data = new FormData();
    data.set('cover', new File(['x'], 'sampul.png'));
    data.set('title', 'Pemrograman Web');
    expect(formToObject(data)).toEqual({ title: 'Pemrograman Web' });
  });
});

describe('pembentuk state', () => {
  it('membentuk state galat dengan kolom dan isian sebelumnya', () => {
    expect(formError('Kategori belum dapat disimpan.', { name: ['Wajib diisi.'] }, { name: '' })).toEqual({
      status: 'error',
      message: 'Kategori belum dapat disimpan.',
      fieldErrors: { name: ['Wajib diisi.'] },
      values: { name: '' },
    });
  });

  it('memberi nilai kosong pada kolom dan isian bila tidak disebut', () => {
    expect(formError('Akses ditolak.')).toEqual({
      status: 'error', message: 'Akses ditolak.', fieldErrors: {}, values: {},
    });
  });

  it('membentuk state sukses dan state awal', () => {
    expect(formSuccess('Tersimpan.')).toEqual({ status: 'success', message: 'Tersimpan.' });
    expect(IDLE).toEqual({ status: 'idle' });
  });
});
