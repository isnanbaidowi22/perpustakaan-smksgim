'use server';

import type { FormState } from '@/lib/form-state';
import { runFormAction } from '@/server/forms/run-action';
import { updateLibrarySettings } from '@/server/services/settings';
import { settingsSchema } from '@/server/validation/settings';

export async function updateSettingsAction(_state: FormState, formData: FormData): Promise<FormState> {
  return runFormAction({
    schema: settingsSchema,
    formData,
    invalidMessage: 'Konfigurasi belum dapat disimpan. Periksa kolom yang ditandai.',
    execute: (data, actor) => updateLibrarySettings(data, actor),
    successMessage: 'Konfigurasi tersimpan. Aturan baru berlaku untuk transaksi berikutnya.',
    revalidate: ['/pengaturan/konfigurasi'],
  });
}
