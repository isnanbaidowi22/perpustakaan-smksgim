import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockGet, mockRequireProfile } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockRequireProfile: vi.fn(),
}));

vi.mock('@/server/queries/settings', () => ({ getLibrarySettings: mockGet }));
vi.mock('@/server/actions/settings', () => ({ updateSettingsAction: vi.fn() }));
vi.mock('@/server/auth/guard', () => ({ requireProfile: mockRequireProfile }));

import SettingsPage from './page';

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireProfile.mockResolvedValue({ id: 'u1', role: 'admin', fullName: 'Administrator', status: 'active' });
});

describe('SettingsPage', () => {
  it('mengisi form dengan konfigurasi saat ini', async () => {
    mockGet.mockResolvedValueOnce({
      maxActiveLoans: 3,
      loanDurationDays: 7,
      finePerDay: 1500,
      blockWhenOverdue: false,
      blockWhenUnpaidFine: false,
      schoolName: 'SMK Negeri 1 Contoh',
      receiptFooter: 'Terima kasih.',
    });

    const html = renderToStaticMarkup(await SettingsPage());

    expect(html).toContain('value="7"');
    expect(html).toContain('value="1500"');
    expect(html).toContain('value="SMK Negeri 1 Contoh"');
    expect(html).toContain('Terima kasih.');
    expect(html).not.toMatch(/checked=""/);
    for (const name of ['blockWhenOverdue', 'blockWhenUnpaidFine']) {
      expect(html).toContain(`<input type="hidden" name="${name}" value="off"/>`);
    }
  });

  it('memeriksa sesi lebih dulu sebelum membaca konfigurasi', async () => {
    mockRequireProfile.mockRejectedValueOnce(new Error('NEXT_REDIRECT'));

    await expect(SettingsPage()).rejects.toThrow('NEXT_REDIRECT');

    expect(mockGet).not.toHaveBeenCalled();
  });
});
