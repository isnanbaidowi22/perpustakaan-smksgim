import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formError, IDLE } from '@/lib/form-state';

const { mockRunFormAction, mockRunCommand, mockCreate, mockUpdate, mockSetStatus } = vi.hoisted(() => ({
  mockRunFormAction: vi.fn(),
  mockRunCommand: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockSetStatus: vi.fn(),
}));

vi.mock('@/server/forms/run-action', () => ({ runFormAction: mockRunFormAction, runCommand: mockRunCommand }));
vi.mock('@/server/services/categories', () => ({
  createCategory: mockCreate,
  updateCategory: mockUpdate,
  setCategoryStatus: mockSetStatus,
}));

import { createCategoryAction, setCategoryStatusAction, updateCategoryAction } from './categories';

const actor = { id: 'u1', role: 'admin' as const };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createCategoryAction', () => {
  it('kembali ke daftar setelah berhasil', async () => {
    await createCategoryAction(IDLE, new FormData());

    const options = mockRunFormAction.mock.calls[0]?.[0];
    expect(options.redirectTo).toBe('/master/kategori');
    expect(options.revalidate).toEqual(['/master/kategori']);

    await options.execute({ name: 'Fiksi' }, actor);
    expect(mockCreate).toHaveBeenCalledWith({ name: 'Fiksi' }, actor);
  });
});

describe('updateCategoryAction', () => {
  it('meneruskan id kategori ke service', async () => {
    await updateCategoryAction('c1', IDLE, new FormData());

    const options = mockRunFormAction.mock.calls[0]?.[0];
    await options.execute({ name: 'Sains' }, actor);
    expect(mockUpdate).toHaveBeenCalledWith('c1', { name: 'Sains' }, actor);
  });
});

describe('setCategoryStatusAction', () => {
  it('menolak status yang tidak dikenal tanpa memanggil service', async () => {
    const state = await setCategoryStatusAction('c1', 'deleted' as never, IDLE, new FormData());

    expect(state).toEqual(formError('Status kategori tidak dikenal. Muat ulang halaman lalu coba lagi.'));
    expect(mockRunCommand).not.toHaveBeenCalled();
  });

  it('meneruskan status yang sah ke service', async () => {
    await setCategoryStatusAction('c1', 'inactive', IDLE, new FormData());

    const options = mockRunCommand.mock.calls[0]?.[0];
    await options.execute(actor);
    expect(mockSetStatus).toHaveBeenCalledWith('c1', 'inactive', actor);
  });
});
