import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { formError, formSuccess } from '@/lib/form-state';
import { requiredText } from '@/server/validation/common';
import type { ServiceResult } from '@/server/services/result';

const { mockRequireActor, mockRevalidatePath, mockRedirect } = vi.hoisted(() => ({
  mockRequireActor: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockRedirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

vi.mock('@/server/auth/guard', () => ({ requireActor: mockRequireActor }));
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }));
vi.mock('next/navigation', () => ({ redirect: mockRedirect }));

import { runCommand, runFormAction } from './run-action';

const actor = { id: 'u1', role: 'admin' as const };
const schema = z.object({ name: requiredText('Nama kategori wajib diisi.') });

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

function options(overrides: Partial<Parameters<typeof runFormAction<typeof schema>>[0]> = {}) {
  return {
    schema,
    formData: form({ name: 'Fiksi' }),
    invalidMessage: 'Kategori belum dapat disimpan. Periksa kolom yang ditandai.',
    execute: vi.fn(async (): Promise<ServiceResult> => ({ ok: true, id: 'c1' })),
    successMessage: 'Kategori berhasil disimpan.',
    revalidate: ['/master/kategori'],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireActor.mockResolvedValue(actor);
});

describe('runFormAction', () => {
  it('tidak membaca isian bila pengunjung belum masuk', async () => {
    mockRequireActor.mockRejectedValueOnce(new Error('NEXT_REDIRECT'));
    const execute = vi.fn();
    const formData = form({ name: 'Fiksi' });
    const get = vi.spyOn(formData, 'entries');

    await expect(runFormAction(options({ execute, formData }))).rejects.toThrow('NEXT_REDIRECT');
    expect(get).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it('mengembalikan galat per kolom beserta isian sebelumnya bila validasi gagal', async () => {
    const execute = vi.fn();

    const state = await runFormAction(options({ execute, formData: form({ name: '   ' }) }));

    expect(state).toEqual(formError(
      'Kategori belum dapat disimpan. Periksa kolom yang ditandai.',
      { name: ['Nama kategori wajib diisi.'] },
      { name: '   ' },
    ));
    expect(execute).not.toHaveBeenCalled();
  });

  it('meneruskan data tervalidasi dan pelaku ke service', async () => {
    const opts = options({ formData: form({ name: '  Fiksi  ' }) });

    await runFormAction(opts);

    expect(opts.execute).toHaveBeenCalledWith({ name: 'Fiksi' }, actor);
  });

  it('memetakan kegagalan service ke kolom yang disebut', async () => {
    const execute = vi.fn(async (): Promise<ServiceResult> => ({
      ok: false, message: 'Kategori "Fiksi" sudah ada.', field: 'name',
    }));

    const state = await runFormAction(options({ execute }));

    expect(state).toEqual(formError(
      'Kategori "Fiksi" sudah ada.',
      { name: ['Kategori "Fiksi" sudah ada.'] },
      { name: 'Fiksi' },
    ));
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('merevalidasi halaman lalu mengembalikan pesan sukses beserta catatan service', async () => {
    const execute = vi.fn(async (): Promise<ServiceResult> => ({
      ok: true, id: 'b1', notice: 'Perhatian: harga buku masih Rp0.',
    }));

    const state = await runFormAction(options({ execute }));

    expect(mockRevalidatePath).toHaveBeenCalledWith('/master/kategori');
    expect(state).toEqual(formSuccess('Kategori berhasil disimpan. Perhatian: harga buku masih Rp0.'));
  });

  it('pindah ke halaman tujuan dengan pesan sukses di query string', async () => {
    await expect(runFormAction(options({ redirectTo: '/master/kategori' }))).rejects.toThrow('NEXT_REDIRECT');
    expect(mockRedirect).toHaveBeenCalledWith('/master/kategori?pesan=Kategori%20berhasil%20disimpan.');
  });

  it('dapat menyusun halaman tujuan dari id yang baru disimpan', async () => {
    await expect(
      runFormAction(options({ redirectTo: (id: string) => `/master/buku/${id}` })),
    ).rejects.toThrow('NEXT_REDIRECT');
    expect(mockRedirect).toHaveBeenCalledWith('/master/buku/c1?pesan=Kategori%20berhasil%20disimpan.');
  });

  it('tidak mengirim balik kolom rahasia bila validasi gagal', async () => {
    const state = await runFormAction(options({
      formData: form({ name: '', password: 'rahasia123' }),
      secretFields: ['password'],
    }));

    expect(state).toEqual(formError(
      'Kategori belum dapat disimpan. Periksa kolom yang ditandai.',
      { name: ['Nama kategori wajib diisi.'] },
      { name: '' },
    ));
  });

  it('tidak mengirim balik kolom rahasia bila service menolak', async () => {
    const execute = vi.fn(async (): Promise<ServiceResult> => ({
      ok: false, message: 'Username siti sudah dipakai. Pilih username lain.', field: 'name',
    }));

    const state = await runFormAction(options({
      execute,
      formData: form({ name: 'Fiksi', password: 'rahasia123' }),
      secretFields: ['password'],
    }));

    expect(state).toEqual(formError(
      'Username siti sudah dipakai. Pilih username lain.',
      { name: ['Username siti sudah dipakai. Pilih username lain.'] },
      { name: 'Fiksi' },
    ));
  });
});

describe('runCommand', () => {
  it('tidak memanggil service bila pengunjung belum masuk', async () => {
    mockRequireActor.mockRejectedValueOnce(new Error('NEXT_REDIRECT'));
    const execute = vi.fn();

    await expect(runCommand({ execute, successMessage: 'Selesai.', revalidate: [] })).rejects.toThrow('NEXT_REDIRECT');
    expect(execute).not.toHaveBeenCalled();
  });

  it('menjalankan service dengan pelaku lalu merevalidasi', async () => {
    const execute = vi.fn(async (): Promise<ServiceResult> => ({ ok: true, id: 'c1' }));

    const state = await runCommand({
      execute, successMessage: 'Kategori dinonaktifkan.', revalidate: ['/master/kategori'],
    });

    expect(execute).toHaveBeenCalledWith(actor);
    expect(mockRevalidatePath).toHaveBeenCalledWith('/master/kategori');
    expect(state).toEqual(formSuccess('Kategori dinonaktifkan.'));
  });
});
