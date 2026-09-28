'use client';

import { Book } from 'lucide-react';
import { useActionState } from 'react';
import { buttonClass } from '@/components/ui/button-styles';
import { CARD } from '@/components/ui/card-styles';
import { CONTROL, LABEL } from '@/components/ui/form-styles';
import { Notice } from '@/components/ui/notice';
import { signIn } from '@/server/actions/auth';

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, null);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)] p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-[var(--color-accent-600)] text-white">
            <Book aria-hidden="true" className="size-5" strokeWidth={2} />
          </span>
          <span className="text-lg font-bold text-[var(--color-ink-900)]">Perpustakaan Sekolah</span>
        </div>

        <form action={action} className={`${CARD} space-y-4 p-7`}>
          <div>
            <h1 className="page-title text-2xl font-bold tracking-tight text-[var(--color-ink-900)]">Masuk</h1>
            <p className="mt-1 text-sm text-[var(--color-ink-500)]">Masuk untuk mengelola peminjaman buku.</p>
          </div>

          <div>
            <label htmlFor="username" className={LABEL}>Username</label>
            <input
              id="username" name="username" required autoFocus autoComplete="username"
              className={`${CONTROL} w-full`}
            />
          </div>

          <div>
            <label htmlFor="password" className={LABEL}>Kata Sandi</label>
            <input
              id="password" name="password" type="password" required autoComplete="current-password"
              className={`${CONTROL} w-full`}
            />
          </div>

          {state?.error && <Notice tone="danger" role="alert">{state.error}</Notice>}

          <button type="submit" disabled={pending} className={`${buttonClass('primary')} w-full`}>
            {pending ? 'Memproses…' : 'Masuk'}
          </button>
        </form>
      </div>
    </main>
  );
}
