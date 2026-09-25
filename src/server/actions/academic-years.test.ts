import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDLE } from '@/lib/form-state';

const { mockRunFormAction, mockRunCommand, mockCreate, mockUpdate, mockActivate } = vi.hoisted(() => ({
  mockRunFormAction: vi.fn(),
  mockRunCommand: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockActivate: vi.fn(),
}));

vi.mock('@/server/forms/run-action', () => ({ runFormAction: mockRunFormAction, runCommand: mockRunCommand }));
vi.mock('@/server/services/academic-years', () => ({
  createAcademicYear: mockCreate,
  updateAcademicYear: mockUpdate,
  activateAcademicYear: mockActivate,
}));

import {
  activateAcademicYearAction, createAcademicYearAction, updateAcademicYearAction,
} from './academic-years';

const actor = { id: 'u1', role: 'admin' as const };
const data = { name: '2027/2028', startDate: '2027-07-01', endDate: '2028-06-30' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Server Action tahun ajaran', () => {
  it('createAcademicYearAction hanya untuk admin, lalu kembali ke daftar', async () => {
    await createAcademicYearAction(IDLE, new FormData());

    const options = mockRunFormAction.mock.calls[0]?.[0];
    expect(options.roles).toEqual(['admin']);
    expect(options.redirectTo).toBe('/pengaturan/tahun-ajaran');
    await options.execute({ ...data, activate: true }, actor);
    expect(mockCreate).toHaveBeenCalledWith({ ...data, activate: true }, actor);
  });

  it('updateAcademicYearAction meneruskan id ke service', async () => {
    await updateAcademicYearAction('y1', IDLE, new FormData());

    const options = mockRunFormAction.mock.calls[0]?.[0];
    expect(options.roles).toEqual(['admin']);
    await options.execute(data, actor);
    expect(mockUpdate).toHaveBeenCalledWith('y1', data, actor);
  });

  it('activateAcademicYearAction hanya untuk admin dan meneruskan id', async () => {
    await activateAcademicYearAction('y1', IDLE, new FormData());

    const options = mockRunCommand.mock.calls[0]?.[0];
    expect(options.roles).toEqual(['admin']);
    expect(options.revalidate).toEqual(['/pengaturan/tahun-ajaran']);
    expect(options.redirectTo).toBe('/pengaturan/tahun-ajaran');
    await options.execute(actor);
    expect(mockActivate).toHaveBeenCalledWith('y1', actor);
  });
});
