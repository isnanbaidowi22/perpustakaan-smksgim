import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDLE } from '@/lib/form-state';

const { mockRunFormAction, mockUpdate } = vi.hoisted(() => ({
  mockRunFormAction: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock('@/server/forms/run-action', () => ({ runFormAction: mockRunFormAction }));
vi.mock('@/server/services/settings', () => ({ updateLibrarySettings: mockUpdate }));

import { updateSettingsAction } from './settings';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('updateSettingsAction', () => {
  it('hanya untuk admin, tetap di halaman yang sama, dan meneruskan data ke service', async () => {
    await updateSettingsAction(IDLE, new FormData());

    const options = mockRunFormAction.mock.calls[0]?.[0];
    expect(options.roles).toEqual(['admin']);
    expect(options.redirectTo).toBeUndefined();
    expect(options.revalidate).toEqual(['/pengaturan/konfigurasi']);

    const actor = { id: 'u1', role: 'admin' as const };
    const data = { maxActiveLoans: 3 };
    await options.execute(data, actor);
    expect(mockUpdate).toHaveBeenCalledWith(data, actor);
  });
});
