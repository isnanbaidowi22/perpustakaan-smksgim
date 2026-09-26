'use server';

import type { RecordStatus } from '@/domain/shared/types';
import { formError, type FormState } from '@/lib/form-state';
import { runCommand, runFormAction } from '@/server/forms/run-action';
import { createRack, setRackStatus, updateRack } from '@/server/services/racks';
import { isRecordStatus } from '@/server/validation/common';
import { rackSchema } from '@/server/validation/rack';

const LIST = '/master/rak';
const INVALID = 'Rak belum dapat disimpan. Periksa kolom yang ditandai.';

export async function createRackAction(_state: FormState, formData: FormData): Promise<FormState> {
  return runFormAction({
    schema: rackSchema,
    formData,
    invalidMessage: INVALID,
    execute: (data, actor) => createRack(data, actor),
    successMessage: 'Rak berhasil ditambahkan.',
    revalidate: [LIST],
    redirectTo: LIST,
  });
}

export async function updateRackAction(id: string, _state: FormState, formData: FormData): Promise<FormState> {
  return runFormAction({
    schema: rackSchema,
    formData,
    invalidMessage: INVALID,
    execute: (data, actor) => updateRack(id, data, actor),
    successMessage: 'Perubahan rak tersimpan.',
    revalidate: [LIST],
    redirectTo: LIST,
  });
}

export async function setRackStatusAction(
  id: string,
  status: RecordStatus,
  _state: FormState,
  _formData: FormData,
): Promise<FormState> {
  if (!isRecordStatus(status)) {
    return formError('Status rak tidak dikenal. Muat ulang halaman lalu coba lagi.');
  }
  return runCommand({
    execute: (actor) => setRackStatus(id, status, actor),
    successMessage: status === 'active' ? 'Rak diaktifkan.' : 'Rak dinonaktifkan.',
    revalidate: [LIST],
  });
}
