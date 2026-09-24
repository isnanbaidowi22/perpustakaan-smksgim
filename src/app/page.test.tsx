import { describe, expect, it, vi } from 'vitest';

const { mockRedirect } = vi.hoisted(() => ({
  mockRedirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

vi.mock('next/navigation', () => ({ redirect: mockRedirect }));

import Home from './page';

describe('Home', () => {
  it('mengarahkan akar aplikasi ke /dashboard', () => {
    expect(() => Home()).toThrow('NEXT_REDIRECT');
    expect(mockRedirect).toHaveBeenCalledWith('/dashboard');
  });
});
