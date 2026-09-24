'use client';

import { useActionState } from 'react';
import { signIn } from '@/server/actions/auth';

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, null);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-ink-50)] p-4">
      <form action={action} className="w-full max-w-sm rounded-xl bg-white p-8 shadow-sm">
        <h1 className="page-title mb-1 text-xl font-semibold">Perpustakaan Sekolah</h1>
        <p className="mb-6 text-sm text-[var(--color-ink-500)]">
          Masuk untuk mengelola peminjaman buku.
        </p>

        <label htmlFor="username" className="mb-1 block text-sm font-medium">Username</label>
        <input
          id="username" name="username" required autoFocus autoComplete="username"
          className="mb-4 w-full rounded-md border border-[var(--color-ink-300)] px-3 py-2"
        />

        <label htmlFor="password" className="mb-1 block text-sm font-medium">Kata Sandi</label>
        <input
          id="password" name="password" type="password" required autoComplete="current-password"
          className="mb-4 w-full rounded-md border border-[var(--color-ink-300)] px-3 py-2"
        />

        {state?.error && (
          <p role="alert" className="mb-4 rounded-md bg-[var(--color-status-terlambat)]/10 px-3 py-2 text-sm text-[var(--color-status-terlambat)]">
            {state.error}
          </p>
        )}

        <button
          type="submit" disabled={pending}
          className="w-full rounded-md bg-[var(--color-accent-600)] py-2 font-medium text-white disabled:opacity-60"
        >
          {pending ? 'Memproses…' : 'Masuk'}
        </button>
      </form>
    </main>
  );
}
