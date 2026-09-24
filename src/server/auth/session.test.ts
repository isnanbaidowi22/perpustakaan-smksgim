import { describe, expect, it, vi } from 'vitest';

const { mockGetUser, mockLimit } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockLimit: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ getAll: () => [], set: vi.fn() })),
}));
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({ auth: { getUser: mockGetUser } })),
}));
vi.mock('@/server/db/client', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: mockLimit,
        }),
      }),
    }),
  },
  schema: { profiles: {} },
}));

import { createSupabaseServerClient, getCurrentProfile } from './session';

describe('createSupabaseServerClient', () => {
  it('mengembalikan klien Supabase dari cookie store permintaan', async () => {
    const client = await createSupabaseServerClient();
    expect(client).toBeDefined();
  });
});

describe('getCurrentProfile', () => {
  it('mengembalikan null ketika tidak ada pengguna yang masuk', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const profile = await getCurrentProfile();
    expect(profile).toBeNull();
  });

  it('mengembalikan null ketika profil berstatus tidak aktif', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } });
    mockLimit.mockResolvedValueOnce([{ id: 'user-1', status: 'inactive' }]);
    const profile = await getCurrentProfile();
    expect(profile).toBeNull();
  });
});
