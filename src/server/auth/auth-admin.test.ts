import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockCreateUser, mockUpdateUserById, mockDeleteUser, mockCreateClient } = vi.hoisted(() => {
  const mockCreateUser = vi.fn();
  const mockUpdateUserById = vi.fn();
  const mockDeleteUser = vi.fn();
  return {
    mockCreateUser,
    mockUpdateUserById,
    mockDeleteUser,
    mockCreateClient: vi.fn((..._args: unknown[]) => ({
      auth: { admin: { createUser: mockCreateUser, updateUserById: mockUpdateUserById, deleteUser: mockDeleteUser } },
    })),
  };
});

vi.mock('@supabase/supabase-js', () => ({ createClient: mockCreateClient }));

import { supabaseAuthAdmin } from './auth-admin';

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('supabaseAuthAdmin', () => {
  it('memakai service role tanpa menyimpan sesi', () => {
    supabaseAuthAdmin();
    expect(mockCreateClient.mock.calls[0]?.[2]).toEqual({ auth: { autoRefreshToken: false, persistSession: false } });
  });

  it('membuat akun yang langsung terkonfirmasi dan mengembalikan id-nya', async () => {
    mockCreateUser.mockResolvedValueOnce({ data: { user: { id: 'a1' } }, error: null });

    expect(await supabaseAuthAdmin().createUser('siti@perpus.local', 'rahasia123')).toEqual({ ok: true, id: 'a1' });
    expect(mockCreateUser).toHaveBeenCalledWith({
      email: 'siti@perpus.local', password: 'rahasia123', email_confirm: true,
    });
  });

  it('meneruskan kode galat Supabase', async () => {
    mockCreateUser.mockResolvedValueOnce({
      data: { user: null },
      error: { code: 'email_exists', message: 'A user with this email address has already been registered' },
    });

    expect(await supabaseAuthAdmin().createUser('siti@perpus.local', 'rahasia123')).toEqual({
      ok: false, code: 'email_exists', message: 'A user with this email address has already been registered',
    });
  });

  it('mengganti kata sandi lewat updateUserById', async () => {
    mockUpdateUserById.mockResolvedValueOnce({ data: { user: { id: 'a1' } }, error: null });

    expect(await supabaseAuthAdmin().setPassword('a1', 'baru12345')).toEqual({ ok: true, id: 'a1' });
    expect(mockUpdateUserById).toHaveBeenCalledWith('a1', { password: 'baru12345' });
  });

  it('mencatat kegagalan penghapusan akun tanpa melempar galat', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockDeleteUser.mockResolvedValueOnce({ data: null, error: { message: 'Service unavailable' } });

    await expect(supabaseAuthAdmin().deleteUser('a1')).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('a1'));
  });
});
