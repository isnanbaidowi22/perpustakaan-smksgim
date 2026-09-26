import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formError, IDLE } from '@/lib/form-state';

const { mockRunFormAction, mockRunCommand, mockAddCopies, mockChangeStatus } = vi.hoisted(() => ({
  mockRunFormAction: vi.fn(),
  mockRunCommand: vi.fn(),
  mockAddCopies: vi.fn(),
  mockChangeStatus: vi.fn(),
}));

vi.mock('@/server/forms/run-action', () => ({ runFormAction: mockRunFormAction, runCommand: mockRunCommand }));
vi.mock('@/server/services/copies', () => ({ addCopies: mockAddCopies, changeCopyStatus: mockChangeStatus }));

import { addCopiesAction, changeCopyStatusAction } from './copies';

const actor = { id: 'u1', role: 'admin' as const };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('addCopiesAction', () => {
  it('tetap di halaman buku setelah berhasil', async () => {
    await addCopiesAction('b1', IDLE, new FormData());

    const options = mockRunFormAction.mock.calls[0]?.[0];
    expect(options.redirectTo).toBeUndefined();
    expect(options.revalidate).toEqual(['/master/buku', '/master/buku/b1']);

    const data = { count: 2, barcode: null, acquisitionDate: null, notes: null };
    await options.execute(data, actor);
    expect(mockAddCopies).toHaveBeenCalledWith('b1', data, actor);
  });
});

describe('changeCopyStatusAction', () => {
  it('meneruskan aksi yang sah ke service', async () => {
    await changeCopyStatusAction('b1', 'k1', 'RESTORE', IDLE, new FormData());

    const options = mockRunCommand.mock.calls[0]?.[0];
    await options.execute(actor);
    expect(mockChangeStatus).toHaveBeenCalledWith('k1', 'RESTORE', actor);
  });

  it('menolak aksi yang tidak dikenal tanpa memanggil service', async () => {
    const state = await changeCopyStatusAction('b1', 'k1', 'HAPUS' as never, IDLE, new FormData());

    expect(state).toEqual(formError('Aksi eksemplar tidak dikenal. Muat ulang halaman lalu coba lagi.'));
    expect(mockRunCommand).not.toHaveBeenCalled();
  });
});
