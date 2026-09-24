import { describe, expect, it, vi } from 'vitest';

const { mockGetUser } = vi.hoisted(() => ({
  mockGetUser: vi.fn(async () => ({ data: { user: null } })),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({ auth: { getUser: mockGetUser } })),
}));

import { NextRequest } from 'next/server';
import { proxy } from './proxy';

describe('proxy', () => {
  it('menyegarkan sesi dengan memanggil getUser() lalu meneruskan permintaan', async () => {
    const request = new NextRequest('http://localhost/dashboard');
    await proxy(request);
    expect(mockGetUser).toHaveBeenCalled();
  });
});
