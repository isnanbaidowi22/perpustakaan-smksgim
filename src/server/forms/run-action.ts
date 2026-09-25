import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { z } from 'zod';
import type { Actor, UserRole } from '@/domain/shared/types';
import { formError, formSuccess, formToObject, type FieldErrors, type FormState } from '@/lib/form-state';
import { authorize } from '@/server/auth/guard';
import type { ServiceResult } from '@/server/services/result';

interface Completion {
  successMessage: string;
  /** Halaman yang datanya berubah; diperbarui setelah berhasil. */
  revalidate: string[];
  /**
   * Bila diisi, pindah ke halaman ini dan tampilkan pesan sukses di sana.
   * Bentuk fungsi menerima id data yang baru disimpan, misalnya untuk
   * membuka halaman detail buku yang baru dibuat.
   */
  redirectTo?: string | ((id: string) => string);
}

interface FormActionOptions<S extends z.ZodType> extends Completion {
  roles: UserRole[];
  schema: S;
  formData: FormData;
  /** Pesan umum saat ada kolom tidak valid, menyebut entitasnya. */
  invalidMessage: string;
  /**
   * Kolom yang tidak boleh dikirim balik ke peramban bersama isian terakhir,
   * misalnya kata sandi. Kolom ini kosong kembali setelah galat.
   */
  secretFields?: string[];
  execute: (data: z.output<S>, actor: Actor) => Promise<ServiceResult>;
}

interface CommandOptions extends Completion {
  roles: UserRole[];
  execute: (actor: Actor) => Promise<ServiceResult>;
}

/**
 * Urutan baku setiap Server Action penulis data:
 * otorisasi → validasi → service → revalidasi → (pindah halaman).
 * Otorisasi selalu pertama, sebelum isian form dibaca sama sekali.
 */
export async function runFormAction<S extends z.ZodType>(options: FormActionOptions<S>): Promise<FormState> {
  const auth = await authorize(options.roles);
  if (!auth.ok) return formError(auth.message);

  const values = formToObject(options.formData);
  const echoed = withoutFields(values, options.secretFields ?? []);
  const parsed = options.schema.safeParse(values);
  if (!parsed.success) {
    return formError(options.invalidMessage, fieldErrorsOf(parsed.error), echoed);
  }

  const result = await options.execute(parsed.data, auth.actor);
  return complete(result, options, echoed);
}

/** Untuk aksi tanpa isian form, misalnya menonaktifkan data. */
export async function runCommand(options: CommandOptions): Promise<FormState> {
  const auth = await authorize(options.roles);
  if (!auth.ok) return formError(auth.message);

  const result = await options.execute(auth.actor);
  return complete(result, options, {});
}

function withoutFields(values: Record<string, string>, fields: string[]): Record<string, string> {
  return Object.fromEntries(Object.entries(values).filter(([key]) => !fields.includes(key)));
}

function fieldErrorsOf(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? '');
    (errors[field] ??= []).push(issue.message);
  }
  return errors;
}

function complete(result: ServiceResult, completion: Completion, values: Record<string, string>): FormState {
  if (!result.ok) {
    const fieldErrors = result.field ? { [result.field]: [result.message] } : {};
    return formError(result.message, fieldErrors, values);
  }

  for (const path of completion.revalidate) revalidatePath(path);

  const message = result.notice ? `${completion.successMessage} ${result.notice}` : completion.successMessage;
  if (completion.redirectTo) {
    const target = typeof completion.redirectTo === 'function'
      ? completion.redirectTo(result.id)
      : completion.redirectTo;
    // redirect() melempar; sengaja berada di luar try/catch mana pun.
    redirect(`${target}?pesan=${encodeURIComponent(message)}`);
  }
  return formSuccess(message);
}
