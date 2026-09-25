export type FieldErrors = Record<string, string[]>;

/**
 * State yang dikembalikan Server Action ke `useActionState`.
 * Berada di `lib/`, bukan `server/`, karena komponen klien ikut membacanya.
 */
export type FormState =
  | { status: 'idle' }
  | { status: 'success'; message: string }
  | {
      status: 'error';
      message: string;
      fieldErrors: FieldErrors;
      /**
       * Isian terakhir. React 19 mengosongkan form setelah Server Action
       * selesai; tanpa ini petugas harus mengetik ulang seluruh isian
       * hanya karena satu kolom salah.
       */
      values: Record<string, string>;
    };

export const IDLE: FormState = { status: 'idle' };

export function formError(
  message: string,
  fieldErrors: FieldErrors = {},
  values: Record<string, string> = {},
): FormState {
  return { status: 'error', message, fieldErrors, values };
}

export function formSuccess(message: string): FormState {
  return { status: 'success', message };
}

/**
 * Mengambil isian teks dari FormData. Kunci internal React (`$ACTION_…`)
 * dan berkas unggahan dibuang, sehingga skema validasi hanya melihat isian.
 */
export function formToObject(formData: FormData): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('$ACTION_') || typeof value !== 'string') continue;
    result[key] = value;
  }
  return result;
}
