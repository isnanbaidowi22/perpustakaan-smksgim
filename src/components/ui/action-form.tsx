'use client';

import Link from 'next/link';
import { createContext, useActionState, useContext, type ReactNode } from 'react';
import { IDLE, type FormState } from '@/lib/form-state';
import { buttonClass } from './button-styles';
import { CARD } from './card-styles';
import { Notice } from './notice';

export type FormAction = (state: FormState, formData: FormData) => Promise<FormState>;

const FormStateContext = createContext<FormState>(IDLE);

/**
 * Nilai dan galat sebuah kolom menurut state terakhir form.
 * Setelah validasi gagal, isian terakhir menggantikan nilai bawaan
 * sehingga petugas tidak mengetik ulang.
 */
export function useField(name: string, fallback: string): { value: string; error?: string } {
  const state = useContext(FormStateContext);
  if (state.status !== 'error') return { value: fallback };
  return { value: state.values[name] ?? fallback, error: state.fieldErrors[name]?.[0] };
}

export function ActionForm({
  action,
  submitLabel,
  cancelHref,
  children,
  initialState = IDLE,
}: {
  action: FormAction;
  submitLabel: string;
  cancelHref?: string;
  children: ReactNode;
  /** Hanya untuk uji; di aplikasi form selalu mulai dari IDLE. */
  initialState?: FormState;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <FormStateContext value={state}>
      <form action={formAction} className={`max-w-2xl space-y-5 p-6 ${CARD}`}>
        {state.status === 'error' && <Notice tone="danger" role="alert">{state.message}</Notice>}
        {state.status === 'success' && <Notice tone="success" role="status">{state.message}</Notice>}
        {children}
        <div className="flex items-center gap-2.5 border-t border-[var(--color-divider)] pt-5">
          <button type="submit" disabled={pending} className={buttonClass('primary')}>
            {pending ? 'Menyimpan…' : submitLabel}
          </button>
          {cancelHref && (
            <Link href={cancelHref} className={buttonClass('secondary')}>
              Batal
            </Link>
          )}
        </div>
      </form>
    </FormStateContext>
  );
}
