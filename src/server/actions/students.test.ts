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
vi.mock('@/server/services/students', () => ({
  createStudent: mockCreate,
  updateStudent: mockUpdate,
  setStudentStatus: mockSetStatus,
}));

import { createStudentAction, setStudentStatusAction, updateStudentAction } from './students';

const actor = { id: 'u1', role: 'petugas' as const };
const data = {
  nis: '202600123', name: 'Ahmad Fauzi', className: 'XI RPL 1',
  major: null, gender: null, phone: null, academicYearId: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Server Action siswa', () => {
  it('createStudentAction terbuka untuk admin dan petugas, lalu kembali ke daftar', async () => {
    await createStudentAction(IDLE, new FormData());

    const options = mockRunFormAction.mock.calls[0]?.[0];
    expect(options.roles).toEqual(['admin', 'petugas']);
    expect(options.redirectTo).toBe('/master/siswa');
    await options.execute(data, actor);
    expect(mockCreate).toHaveBeenCalledWith(data, actor);
  });

  it('updateStudentAction meneruskan id siswa ke service', async () => {
    await updateStudentAction('s1', IDLE, new FormData());

    await mockRunFormAction.mock.calls[0]?.[0].execute(data, actor);
    expect(mockUpdate).toHaveBeenCalledWith('s1', data, actor);
  });

  it('setStudentStatusAction menolak status yang tidak dikenal', async () => {
    const state = await setStudentStatusAction('s1', 'lulus' as never, IDLE, new FormData());

    expect(state).toEqual(formError('Status siswa tidak dikenal. Muat ulang halaman lalu coba lagi.'));
    expect(mockRunCommand).not.toHaveBeenCalled();
  });

  it('setStudentStatusAction meneruskan status yang sah ke service', async () => {
    await setStudentStatusAction('s1', 'inactive', IDLE, new FormData());

    await mockRunCommand.mock.calls[0]?.[0].execute(actor);
    expect(mockSetStatus).toHaveBeenCalledWith('s1', 'inactive', actor);
  });
});
