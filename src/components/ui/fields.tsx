'use client';

import type { ReactNode } from 'react';
import type { Option } from '@/lib/options';
import { useField } from './action-form';

const CONTROL =
  'w-full rounded-md border border-[var(--color-ink-300)] bg-white px-3 py-2 text-sm aria-[invalid=true]:border-[var(--color-status-terlambat)]';

interface BaseProps {
  name: string;
  label: string;
  hint?: string;
  required?: boolean;
  defaultValue?: string;
}

function describedBy(name: string, error?: string, hint?: string): string | undefined {
  if (error) return `${name}-error`;
  return hint ? `${name}-hint` : undefined;
}

function FieldShell({
  name, label, hint, required, error, children,
}: Omit<BaseProps, 'defaultValue'> & { error?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium">
        {label}
        {required && <span aria-hidden="true" className="text-[var(--color-status-terlambat)]"> *</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${name}-hint`} className="mt-1 text-xs text-[var(--color-ink-500)]">{hint}</p>
      )}
      {error && (
        <p id={`${name}-error`} className="mt-1 text-xs font-medium text-[var(--color-status-terlambat)]">{error}</p>
      )}
    </div>
  );
}

export function TextField({
  name, label, hint, required, defaultValue = '', type = 'text', inputMode, autoFocus, maxLength, autoComplete,
}: BaseProps & {
  type?: 'text' | 'number' | 'date' | 'tel' | 'password';
  inputMode?: 'text' | 'numeric' | 'tel';
  autoFocus?: boolean;
  maxLength?: number;
  autoComplete?: string;
}) {
  const { value, error } = useField(name, defaultValue);
  return (
    <FieldShell name={name} label={label} hint={hint} required={required} error={error}>
      <input
        id={name}
        name={name}
        type={type}
        inputMode={inputMode}
        autoFocus={autoFocus}
        maxLength={maxLength}
        autoComplete={autoComplete}
        required={required}
        defaultValue={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, error, hint)}
        className={CONTROL}
      />
    </FieldShell>
  );
}

export function SelectField({
  name, label, hint, required, defaultValue = '', options, placeholder,
}: BaseProps & { options: Option[]; placeholder?: string }) {
  const { value, error } = useField(name, defaultValue);
  return (
    <FieldShell name={name} label={label} hint={hint} required={required} error={error}>
      {/* React memperbarui defaultValue <input> dan <textarea> saat prop berubah,
          tetapi tidak untuk <select>. Tanpa `key`, reset form bawaan React 19
          mengembalikan pilihan ke nilai awal setelah validasi gagal. */}
      <select
        key={value}
        id={name}
        name={name}
        required={required}
        defaultValue={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, error, hint)}
        className={CONTROL}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </FieldShell>
  );
}

/**
 * Kotak centang. Kolom tersembunyi bernilai "off" mendahului kotaknya, dan
 * `formToObject` menyimpan nilai terakhir: "on" bila dicentang, "off" bila
 * tidak. Tanpa kolom tersembunyi, kotak yang dilepas tidak terkirim sama
 * sekali dan kembali tercentang setelah validasi kolom lain gagal.
 */
export function CheckboxField({
  name, label, hint, defaultChecked = false,
}: { name: string; label: string; hint?: string; defaultChecked?: boolean }) {
  const { value, error } = useField(name, defaultChecked ? 'on' : 'off');
  return (
    <div>
      <div className="flex items-start gap-2">
        <input type="hidden" name={name} value="off" />
        {/* `key` untuk alasan yang sama dengan SelectField: reset form React 19
            tidak memperbarui defaultChecked yang berubah. */}
        <input
          key={value}
          id={name}
          name={name}
          type="checkbox"
          value="on"
          defaultChecked={value === 'on'}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(name, error, hint)}
          className="mt-0.5 size-4 accent-[var(--color-accent-600)]"
        />
        <label htmlFor={name} className="text-sm font-medium">{label}</label>
      </div>
      {hint && !error && (
        <p id={`${name}-hint`} className="ml-6 mt-1 text-xs text-[var(--color-ink-500)]">{hint}</p>
      )}
      {error && (
        <p id={`${name}-error`} className="ml-6 mt-1 text-xs font-medium text-[var(--color-status-terlambat)]">{error}</p>
      )}
    </div>
  );
}

export function TextAreaField({
  name, label, hint, required, defaultValue = '', rows = 3,
}: BaseProps & { rows?: number }) {
  const { value, error } = useField(name, defaultValue);
  return (
    <FieldShell name={name} label={label} hint={hint} required={required} error={error}>
      <textarea
        id={name}
        name={name}
        rows={rows}
        required={required}
        defaultValue={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, error, hint)}
        className={CONTROL}
      />
    </FieldShell>
  );
}
