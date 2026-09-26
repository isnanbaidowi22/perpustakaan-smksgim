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
vi.mock('@/server/services/books', () => ({
  createBook: mockCreate,
  updateBook: mockUpdate,
  setBookStatus: mockSetStatus,
}));

import { createBookAction, setBookStatusAction, updateBookAction } from './books';

const actor = { id: 'u1', role: 'admin' as const };
const data = {
  isbn: null, title: 'Pemrograman Web', author: 'Budi Raharjo', publisher: null,
  publishYear: null, categoryId: null, rackId: null, price: 85_000, description: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Server Action buku', () => {
  it('createBookAction membuka halaman detail buku baru agar eksemplar dapat langsung ditambahkan', async () => {
    await createBookAction(IDLE, new FormData());

    const options = mockRunFormAction.mock.calls[0]?.[0];
    expect(options.redirectTo('b9')).toBe('/master/buku/b9');
    await options.execute(data, actor);
    expect(mockCreate).toHaveBeenCalledWith(data, actor);
  });

  it('updateBookAction kembali ke halaman detail buku yang sama', async () => {
    await updateBookAction('b1', IDLE, new FormData());

    const options = mockRunFormAction.mock.calls[0]?.[0];
    expect(options.redirectTo('b1')).toBe('/master/buku/b1');
    expect(options.revalidate).toEqual(['/master/buku', '/master/buku/b1']);
    await options.execute(data, actor);
    expect(mockUpdate).toHaveBeenCalledWith('b1', data, actor);
  });

  it('setBookStatusAction menolak status yang tidak dikenal', async () => {
    const state = await setBookStatusAction('b1', 'hapus' as never, IDLE, new FormData());

    expect(state).toEqual(formError('Status buku tidak dikenal. Muat ulang halaman lalu coba lagi.'));
    expect(mockRunCommand).not.toHaveBeenCalled();
  });

  it('setBookStatusAction meneruskan status yang sah ke service', async () => {
    await setBookStatusAction('b1', 'inactive', IDLE, new FormData());

    await mockRunCommand.mock.calls[0]?.[0].execute(actor);
    expect(mockSetStatus).toHaveBeenCalledWith('b1', 'inactive', actor);
  });
});
