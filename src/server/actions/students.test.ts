import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDLE } from '@/lib/form-state';

const { mockRunFormAction, mockUpdate } = vi.hoisted(() => ({
  mockRunFormAction: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock('@/server/forms/run-action', () => ({ runFormAction: mockRunFormAction }));
vi.mock('@/server/services/students', () => ({ updateStudent: mockUpdate }));

import { updateStudentAction } from './students';

const actor = { id: 'u1', role: 'admin' as const };
const data = {
  nis: '202600123', name: 'Ahmad Fauzi', className: 'XI RPL 1',
  major: null, gender: null, phone: null, academicYearId: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Server Action siswa', () => {
  it('updateStudentAction meneruskan id siswa ke service lalu kembali ke meja peminjaman', async () => {
    await updateStudentAction('s1', IDLE, new FormData());

    const options = mockRunFormAction.mock.calls[0]?.[0];
    expect(options.redirectTo).toBe('/transaksi/peminjaman');
    await options.execute(data, actor);
    expect(mockUpdate).toHaveBeenCalledWith('s1', data, actor);
  });
});
