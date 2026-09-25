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
  it('menyegarkan sesi dengan memanggil getUser() lalu meneruskan permintaan bila sudah masuk', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } });
    const request = new NextRequest('http://localhost/dashboard');
    const response = await proxy(request);
    expect(mockGetUser).toHaveBeenCalled();
    expect(response.status).not.toBe(307);
  });

  it('mengalihkan permintaan anonim ke /login', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const request = new NextRequest('http://localhost/master/siswa');
    const response = await proxy(request);
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost/login');
  });

  it('meneruskan permintaan anonim ke /login itu sendiri', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const request = new NextRequest('http://localhost/login');
    const response = await proxy(request);
    expect(response.status).not.toBe(307);
  });
});
