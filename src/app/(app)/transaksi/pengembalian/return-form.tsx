'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { buttonClass } from '@/components/ui/button-styles';
import type { ReturnCondition } from '@/domain/shared/types';
import { RETURN_CONDITION_OPTIONS } from '@/lib/circulation-labels';
import { formatRupiah } from '@/lib/format';
import { processReturnAction } from '@/server/actions/returns';
import {
  initialRows, previewReturn, toReturnInput, type ReturnableItem, type ReturnRowState,
} from './return-preview';

const CONTROL = 'rounded-md border border-[var(--color-ink-300)] bg-white px-2 py-1.5 text-sm';

export function ReturnForm({
  loan,
  today,
  finePerDay,
}: {
  loan: { id: string; dueDate: string; items: ReturnableItem[] };
  today: string;
  finePerDay: number;
}) {
  const [rows, setRows] = useState(() => initialRows(loan.items));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const preview = previewReturn(loan.items, rows, { dueDate: loan.dueDate, today, finePerDay });
  const lineOf = new Map(preview.lines.map((line) => [line.itemId, line]));

  function update(id: string, patch: Partial<ReturnRowState>) {
    setRows((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Tombol simpan dinonaktifkan selagi pending, tetapi Enter di kolom teks
    // dapat memicu submit form sebelum render ulang itu tiba; tolak di sini juga
    // supaya pengembalian tidak pernah terkirim dua kali.
    if (pending || preview.problems.length > 0) return;
    setError(null);
    startTransition(async () => {
      // Berhasil: Server Action mengarahkan ke detail transaksi.
      const state = await processReturnAction(toReturnInput(loan.id, loan.items, rows));
      if (state.status === 'error') setError(state.message);
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-3 lg:col-span-2">
        {loan.items.map((item) => {
          const row = rows[item.id];
          const line = lineOf.get(item.id);
          return (
            <fieldset key={item.id} className="rounded-lg border border-[var(--color-ink-100)] bg-white p-3">
              <legend className="sr-only">{item.barcode} {item.bookTitle}</legend>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  id={`kembali-${item.id}`}
                  type="checkbox"
                  checked={row.selected}
                  onChange={(event) => update(item.id, { selected: event.target.checked })}
                  className="size-4 accent-[var(--color-accent-600)]"
                />
                <label htmlFor={`kembali-${item.id}`} className="flex-1 text-sm">
                  <span className="font-mono">{item.barcode}</span> · {item.bookTitle}
                </label>
                <label htmlFor={`kondisi-${item.id}`} className="sr-only">Kondisi {item.barcode}</label>
                <select
                  id={`kondisi-${item.id}`}
                  value={row.condition}
                  disabled={!row.selected}
                  onChange={(event) => update(item.id, { condition: event.target.value as ReturnCondition })}
                  className={CONTROL}
                >
                  {RETURN_CONDITION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              {row.selected && row.condition !== 'BAIK' && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor={`ganti-${item.id}`} className="mb-1 block text-xs font-medium">Biaya ganti (Rp)</label>
                    <input
                      id={`ganti-${item.id}`}
                      inputMode="numeric"
                      value={row.replacementFee}
                      onChange={(event) => update(item.id, { replacementFee: event.target.value })}
                      className={`${CONTROL} w-full`}
                    />
                    <p className="mt-1 text-xs text-[var(--color-ink-500)]">Harga katalog {formatRupiah(item.bookPrice)}.</p>
                  </div>
                  <div>
                    <label htmlFor={`catatan-${item.id}`} className="mb-1 block text-xs font-medium">Catatan kondisi</label>
                    <input
                      id={`catatan-${item.id}`}
                      value={row.note}
                      maxLength={500}
                      onChange={(event) => update(item.id, { note: event.target.value })}
                      className={`${CONTROL} w-full`}
                    />
                  </div>
                </div>
              )}
              {line && line.total > 0 && (
                <p className="mt-2 text-xs text-[var(--color-ink-700)]">
                  {line.daysLate > 0 && `Telat ${line.daysLate} hari · ${formatRupiah(line.lateFine)}`}
                  {line.daysLate > 0 && line.replacementFee > 0 && ' · '}
                  {line.replacementFee > 0 && `Biaya ganti ${formatRupiah(line.replacementFee)}`}
                </p>
              )}
            </fieldset>
          );
        })}
      </div>

      <aside className="h-fit rounded-lg border border-[var(--color-ink-100)] bg-white p-4" aria-live="polite">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-500)]">Denda pengembalian ini</p>
        <p className="tabular mt-1 text-2xl font-semibold">{formatRupiah(preview.total)}</p>
        <p className="mt-1 text-xs text-[var(--color-ink-500)]">{preview.lines.length} buku dikembalikan</p>
        {preview.warnings.map((warning) => (
          <p key={warning} className="mt-2 text-xs text-[var(--color-status-rusak)]">{warning}</p>
        ))}
        {preview.problems.map((problem) => (
          <p key={problem} role="alert" className="mt-2 text-xs text-[var(--color-status-terlambat)]">{problem}</p>
        ))}
        {error && <p role="alert" className="mt-2 text-sm text-[var(--color-status-terlambat)]">{error}</p>}
        <button
          type="submit"
          disabled={pending || preview.problems.length > 0}
          className={`${buttonClass('primary')} mt-4 w-full`}
        >
          {pending ? 'Menyimpan…' : 'Simpan Pengembalian'}
        </button>
      </aside>
    </form>
  );
}
