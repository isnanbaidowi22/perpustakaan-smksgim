'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { FormStateContext } from '@/components/ui/action-form';
import { buttonClass } from '@/components/ui/button-styles';
import { SelectField, TextField } from '@/components/ui/fields';
import { IDLE, type FormState } from '@/lib/form-state';
import { createBorrowerAction } from '@/server/actions/loans';
import type { BorrowerCard } from '@/server/queries/circulation';

const GENDER_OPTIONS = [
  { value: 'L', label: 'Laki-laki' },
  { value: 'P', label: 'Perempuan' },
];

export function NewStudentForm({
  query,
  onCreated,
  onCancel,
}: {
  query: string;
  onCreated: (card: BorrowerCard) => void;
  onCancel: () => void;
}) {
  const [state, setState] = useState<FormState>(IDLE);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await createBorrowerAction(formData);
      if (result.ok) onCreated(result.data);
      else setState(result.state);
    });
  }

  return (
    <FormStateContext.Provider value={state}>
      {/* Ctrl+Enter di sini tidak boleh ikut menyimpan peminjaman. */}
      <form onSubmit={submit} onKeyDown={(event) => event.stopPropagation()} className="space-y-3" aria-label="Siswa baru">
        {/* Kata kunci pencarian yang tidak menemukan siswa hampir selalu adalah nama siswa itu. */}
        <TextField name="name" label="Nama lengkap" defaultValue={query.trim()} required autoFocus maxLength={150} autoComplete="off" />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField name="className" label="Kelas" required maxLength={30} hint="Misalnya XI RPL 1." />
          <TextField name="major" label="Jurusan" maxLength={50} />
        </div>
        <SelectField name="gender" label="Jenis kelamin" placeholder="— Tidak diisi —" options={GENDER_OPTIONS} />
        {state.status === 'error' && (
          <p role="alert" className="text-sm text-[var(--color-status-terlambat)]">{state.message}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={pending} className={buttonClass('primary', 'sm')}>
            {pending ? 'Menyimpan…' : 'Simpan & Pilih Siswa'}
          </button>
          <button type="button" onClick={onCancel} className={buttonClass('secondary', 'sm')}>Batal</button>
        </div>
      </form>
    </FormStateContext.Provider>
  );
}
