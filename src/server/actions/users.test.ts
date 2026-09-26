import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formError, IDLE } from '@/lib/form-state';

const {
  mockRunFormAction, mockRunCommand, mockCreate, mockUpdate, mockSetStatus, mockReset, fakeAuth,
} = vi.hoisted(() => ({
  mockRunFormAction: vi.fn(),
  mockRunCommand: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockSetStatus: vi.fn(),
  mockReset: vi.fn(),
  fakeAuth: { createUser: vi.fn(), setPassword: vi.fn(), deleteUser: vi.fn() },
}));

vi.mock('@/server/forms/run-action', () => ({ runFormAction: mockRunFormAction, runCommand: mockRunCommand }));
vi.mock('@/server/services/users', () => ({
  createUser: mockCreate,
  updateUser: mockUpdate,
  setUserStatus: mockSetStatus,
  resetUserPassword: mockReset,
}));
vi.mock('@/server/auth/auth-admin', () => ({ supabaseAuthAdmin: vi.fn(() => fakeAuth) }));

import {
  createUserAction, resetUserPasswordAction, setUserStatusAction, updateUserAction,
} from './users';

const actor = { id: 'u1', role: 'admin' as const };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Server Action pengguna', () => {
  it('createUserAction tidak mengirim balik kata sandi dan memakai Supabase Auth', async () => {
    await createUserAction(IDLE, new FormData());

    const options = mockRunFormAction.mock.calls[0]?.[0];
    expect(options.secretFields).toEqual(['password', 'passwordConfirm']);
    expect(options.redirectTo).toBe('/pengaturan/pengguna');
    const data = { username: 'siti', fullName: 'Siti', password: 'x', passwordConfirm: 'x' };
    await options.execute(data, actor);
    expect(mockCreate).toHaveBeenCalledWith(data, actor, fakeAuth);
  });

  it('updateUserAction meneruskan id ke service', async () => {
    await updateUserAction('p1', IDLE, new FormData());

    const options = mockRunFormAction.mock.calls[0]?.[0];
    await options.execute({ fullName: 'Siti' }, actor);
    expect(mockUpdate).toHaveBeenCalledWith('p1', { fullName: 'Siti' }, actor);
  });

  it('resetUserPasswordAction tetap di halaman dan tidak mengirim balik kata sandi', async () => {
    await resetUserPasswordAction('p1', IDLE, new FormData());

    const options = mockRunFormAction.mock.calls[0]?.[0];
    expect(options.secretFields).toEqual(['password', 'passwordConfirm']);
    expect(options.redirectTo).toBeUndefined();
    const data = { password: 'baru12345', passwordConfirm: 'baru12345' };
    await options.execute(data, actor);
    expect(mockReset).toHaveBeenCalledWith('p1', data, actor, fakeAuth);
  });

  it('setUserStatusAction menolak status yang tidak dikenal', async () => {
    const state = await setUserStatusAction('p1', 'deleted' as never, IDLE, new FormData());

    expect(state).toEqual(formError('Status pengguna tidak dikenal. Muat ulang halaman lalu coba lagi.'));
    expect(mockRunCommand).not.toHaveBeenCalled();
  });

  it('setUserStatusAction meneruskan status yang sah', async () => {
    await setUserStatusAction('p1', 'inactive', IDLE, new FormData());

    const options = mockRunCommand.mock.calls[0]?.[0];
    await options.execute(actor);
    expect(mockSetStatus).toHaveBeenCalledWith('p1', 'inactive', actor);
  });
});
