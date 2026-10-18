'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useState, type ComponentProps } from 'react';

/** Kolom kata sandi dengan tombol tampilkan/sembunyikan. */
export function PasswordInput({ className = '', ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  return (
    <div className="relative">
      <input {...props} type={visible ? 'text' : 'password'} className={`${className} pr-10`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-lg text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)] focus-visible:outline-2 focus-visible:outline-[var(--color-accent-600)]"
      >
        <Icon aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
