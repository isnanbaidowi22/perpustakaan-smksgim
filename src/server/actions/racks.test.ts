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
vi.mock('@/server/services/racks', () => ({
  createRack: mockCreate,
  updateRack: mockUpdate,
  setRackStatus: mockSetStatus,
}));

import { createRackAction, setRackStatusAction, updateRackAction } from './racks';

const actor = { id: 'u1', role: 'petugas' as const };
const data = { code: 'A-3', name: 'Rak A Baris 3', location: null };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Server Action rak', () => {
  it('createRackAction terbuka untuk admin dan petugas, lalu kembali ke daftar', async () => {
    await createRackAction(IDLE, new FormData());

    const options = mockRunFormAction.mock.calls[0]?.[0];
    expect(options.roles).toEqual(['admin', 'petugas']);
    expect(options.redirectTo).toBe('/master/rak');
    await options.execute(data, actor);
    expect(mockCreate).toHaveBeenCalledWith(data, actor);
  });

  it('updateRackAction meneruskan id rak ke service', async () => {
    await updateRackAction('r1', IDLE, new FormData());

    await mockRunFormAction.mock.calls[0]?.[0].execute(data, actor);
    expect(mockUpdate).toHaveBeenCalledWith('r1', data, actor);
  });

  it('setRackStatusAction menolak status yang tidak dikenal', async () => {
    const state = await setRackStatusAction('r1', 'deleted' as never, IDLE, new FormData());

    expect(state).toEqual(formError('Status rak tidak dikenal. Muat ulang halaman lalu coba lagi.'));
    expect(mockRunCommand).not.toHaveBeenCalled();
  });

  it('setRackStatusAction meneruskan status yang sah ke service', async () => {
    await setRackStatusAction('r1', 'inactive', IDLE, new FormData());

    await mockRunCommand.mock.calls[0]?.[0].execute(actor);
    expect(mockSetStatus).toHaveBeenCalledWith('r1', 'inactive', actor);
  });
});
