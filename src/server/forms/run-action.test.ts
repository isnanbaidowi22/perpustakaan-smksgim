import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { UserRole } from '@/domain/shared/types';
import { formError, formSuccess } from '@/lib/form-state';
import { requiredText } from '@/server/validation/common';
import type { ServiceResult } from '@/server/services/result';

const { mockAuthorize, mockRevalidatePath, mockRedirect } = vi.hoisted(() => ({
  mockAuthorize: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockRedirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

vi.mock('@/server/auth/guard', () => ({ authorize: mockAuthorize }));
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }));
vi.mock('next/navigation', () => ({ redirect: mockRedirect }));

import { runCommand, runFormAction } from './run-action';

const actor = { id: 'u1', role: 'petugas' as const };
const schema = z.object({ name: requiredText('Nama kategori wajib diisi.') });

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

function options(overrides: Partial<Parameters<typeof runFormAction<typeof schema>>[0]> = {}) {
  return {
    roles: ['admin', 'petugas'] as UserRole[],
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
  mockAuthorize.mockResolvedValue({ ok: true, actor });
});

describe('runFormAction', () => {
  it('menolak sebelum membaca isian bila peran tidak diizinkan', async () => {
    mockAuthorize.mockResolvedValueOnce({ ok: false, message: 'Akses ditolak.' });
    const execute = vi.fn();

    const state = await runFormAction(options({ execute }));

    expect(state).toEqual(formError('Akses ditolak.'));
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
});

describe('runCommand', () => {
  it('menolak tanpa memanggil service bila peran tidak diizinkan', async () => {
    mockAuthorize.mockResolvedValueOnce({ ok: false, message: 'Akses ditolak.' });
    const execute = vi.fn();

    const state = await runCommand({ roles: ['admin'], execute, successMessage: 'Selesai.', revalidate: [] });

    expect(state).toEqual(formError('Akses ditolak.'));
    expect(execute).not.toHaveBeenCalled();
  });

  it('menjalankan service dengan pelaku lalu merevalidasi', async () => {
    const execute = vi.fn(async (): Promise<ServiceResult> => ({ ok: true, id: 'c1' }));

    const state = await runCommand({
      roles: ['admin', 'petugas'], execute, successMessage: 'Kategori dinonaktifkan.', revalidate: ['/master/kategori'],
    });

    expect(execute).toHaveBeenCalledWith(actor);
    expect(mockRevalidatePath).toHaveBeenCalledWith('/master/kategori');
    expect(state).toEqual(formSuccess('Kategori dinonaktifkan.'));
  });
});
