'use client';

import { useActionState } from 'react';
import { IDLE } from '@/lib/form-state';
import type { FormAction } from './action-form';
import { buttonClass } from './button-styles';

/**
 * Tombol untuk satu aksi tanpa isian, misalnya menonaktifkan data.
 * Hasilnya tampil tepat di bawah tombol. Galat yang dilempar Server Action
 * akan disamarkan Next.js di produksi, jadi aksi ini mengembalikan state.
 */
export function ActionButton({
  action,
  label,
  pendingLabel = 'Memproses…',
  confirmText,
  variant = 'secondary',
}: {
  action: FormAction;
  label: string;
  pendingLabel?: string;
  /** Bila diisi, petugas diminta konfirmasi sebelum aksi dijalankan. */
  confirmText?: string;
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  const [state, formAction, pending] = useActionState(action, IDLE);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (confirmText && !window.confirm(confirmText)) event.preventDefault();
      }}
      className="inline-flex flex-col items-end gap-1"
    >
      <button type="submit" disabled={pending} className={buttonClass(variant, 'sm')}>
        {pending ? pendingLabel : label}
      </button>
      {state.status === 'error' && (
        <span role="alert" className="max-w-64 text-right text-xs text-[var(--color-status-terlambat)]">
          {state.message}
        </span>
      )}
      {state.status === 'success' && (
        <span role="status" className="text-xs text-[var(--color-status-tersedia)]">{state.message}</span>
      )}
    </form>
  );
}
