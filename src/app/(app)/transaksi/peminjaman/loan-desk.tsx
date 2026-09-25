'use client';

import Link from 'next/link';
import { useReducer, useRef, useState, useTransition, type FormEvent, type KeyboardEvent } from 'react';
import { buttonClass } from '@/components/ui/button-styles';
import type { CreateLoanState } from '@/lib/circulation-results';
import { formatDate } from '@/lib/format';
import { describeViolation } from '@/lib/violation-message';
import {
  createLoanAction, getBorrowerCardAction, lookupCopyAction, searchBorrowersAction,
} from '@/server/actions/loans';
import type { BorrowerCard, BorrowerOption } from '@/server/queries/circulation';
import { cardWarnings, deskReducer, INITIAL_DESK, remainingSlots } from './desk-state';

const INPUT = 'w-full rounded-md border border-[var(--color-ink-300)] bg-white px-3 py-2 text-sm';
const PANEL = 'rounded-lg border border-[var(--color-ink-100)] bg-white p-4';
const HEADING = 'mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-500)]';
const ALERT = 'text-sm text-[var(--color-status-terlambat)]';

const TONE_CLASS = {
  block: 'text-[var(--color-status-terlambat)]',
  warn: 'text-[var(--color-status-rusak)]',
  ok: 'text-[var(--color-status-tersedia)]',
};
const TONE_ICON = { block: '⛔', warn: '!', ok: '✓' };

function StudentCard({ card, onChange }: { card: BorrowerCard; onChange: () => void }) {
  const used = Math.min(card.activeCount, card.maxActiveLoans);
  const dots = '●'.repeat(used) + '○'.repeat(Math.max(0, card.maxActiveLoans - used));
  return (
    <div>
      <p className="font-semibold">{card.student.name}</p>
      <p className="text-sm text-[var(--color-ink-500)]">{card.student.nis} · {card.student.className}</p>
      <p className="mt-2 text-sm">
        <span aria-hidden="true" className="tracking-widest">{dots}</span>{' '}
        Sedang dipinjam {card.activeCount} dari {card.maxActiveLoans}
      </p>
      <ul className="mt-2 space-y-1 text-sm">
        {cardWarnings(card).map((warning) => (
          <li key={warning.text} className={TONE_CLASS[warning.tone]}>
            <span aria-hidden="true">{TONE_ICON[warning.tone]}</span> {warning.text}
          </li>
        ))}
      </ul>
      <button type="button" onClick={onChange} className={`${buttonClass('secondary', 'sm')} mt-3`}>Ganti siswa</button>
    </div>
  );
}

export function LoanDesk({ loanDate, dueDate, durationDays }: { loanDate: string; dueDate: string; durationDays: number }) {
  const [desk, dispatch] = useReducer(deskReducer, INITIAL_DESK);
  const [candidates, setCandidates] = useState<BorrowerOption[]>([]);
  const [studentMessage, setStudentMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [outcome, setOutcome] = useState<CreateLoanState | null>(null);
  const [pending, startTransition] = useTransition();
  const copyInput = useRef<HTMLInputElement>(null);

  const slots = remainingSlots(desk);
  const canSave = desk.student !== null && desk.copies.length > 0 && !pending;

  // F2: setiap pencarian/pemuatan/pembatalan siswa menaikkan generasi ini.
  // Sebuah jawaban async yang datang setelah generasinya kedaluwarsa
  // (siswa lain sudah dipilih, atau sudah dibatalkan sementara jawaban itu
  // masih ditunggu) diabaikan alih-alih menimpa keadaan yang lebih baru.
  // Perbandingan `!==` sederhana ini tidak dipindah ke modul murni karena
  // tidak ada logika bercabang untuk diuji di luar ketaksamaan itu sendiri;
  // diverifikasi lewat `npm run build` (kompilasi tipe strict) dan review manual.
  const studentGeneration = useRef(0);

  async function loadCard(studentId: string) {
    const myGeneration = ++studentGeneration.current;
    const result = await getBorrowerCardAction(studentId);
    if (myGeneration !== studentGeneration.current) return;
    if (!result.ok) {
      setStudentMessage(result.message);
      return;
    }
    dispatch({ type: 'selectStudent', card: result.data });
    setCandidates([]);
    setStudentMessage(null);
    // M3: siswa berganti — panel penolakan/galat dari peminjaman sebelumnya sudah basi.
    setOutcome(null);
    // Spec 8.2: begitu siswa terpilih, fokus pindah ke kolom scan buku.
    copyInput.current?.focus();
  }

  function changeStudent() {
    studentGeneration.current += 1;
    dispatch({ type: 'clearStudent' });
    setOutcome(null);
  }

  function searchStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = String(new FormData(event.currentTarget).get('student') ?? '');
    const myGeneration = ++studentGeneration.current;
    startTransition(async () => {
      const result = await searchBorrowersAction(query);
      if (myGeneration !== studentGeneration.current) return;
      if (!result.ok) {
        setStudentMessage(result.message);
        return;
      }
      if (result.data.length === 1) {
        await loadCard(result.data[0].id);
        return;
      }
      setCandidates(result.data);
      setStudentMessage(result.data.length === 0 ? 'Siswa tidak ditemukan. Periksa NIS atau ejaan nama.' : null);
    });
  }

  function scanCopy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const barcode = String(new FormData(form).get('barcode') ?? '');
    // F1: bersihkan kolom SEBELUM menunggu jawaban server. Pemindai barcode
    // menembakkan scan+Enter berturut-turut; kolom yang masih terisi saat
    // pindaian kedua tiba akan menambahkan barcode itu di belakang barcode
    // pertama, dan pindaian keduanya jadi tidak valid.
    form.reset();
    copyInput.current?.focus();
    const scanGeneration = studentGeneration.current;
    startTransition(async () => {
      const result = await lookupCopyAction(barcode);
      // F2: siswa yang dipilih berubah selagi pindaian ini ditunggu — hasilnya sudah tidak relevan.
      if (scanGeneration !== studentGeneration.current) return;
      dispatch(result.ok ? { type: 'addCopy', copy: result.data } : { type: 'notice', message: result.message });
      // M3: daftar buku baru saja berubah (atau ditolak lagi) — panel penolakan/galat lama sudah basi.
      setOutcome(null);
    });
  }

  function save() {
    if (!canSave || !desk.student) return;
    const input = { studentId: desk.student.student.id, copyIds: desk.copies.map((copy) => copy.id), notes };
    startTransition(async () => {
      const result = await createLoanAction(input);
      setOutcome(result);
      if (result.status === 'success') {
        dispatch({ type: 'reset' });
        setNotes('');
      }
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      save();
    }
  }

  if (outcome?.status === 'success') {
    return (
      <div role="status" className={`${PANEL} max-w-xl`}>
        <h2 className="page-title text-xl font-semibold">Peminjaman tersimpan</h2>
        <p className="mt-2 text-sm">
          Nomor transaksi <strong className="font-mono">{outcome.transactionNumber}</strong>. Jatuh tempo{' '}
          <strong>{formatDate(outcome.dueDate)}</strong>.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" autoFocus onClick={() => setOutcome(null)} className={buttonClass('primary')}>
            Peminjaman Baru
          </button>
          <Link href={`/transaksi/riwayat/${outcome.loanId}`} className={buttonClass('secondary')}>Lihat Transaksi</Link>
        </div>
      </div>
    );
  }

  return (
    <div onKeyDown={onKeyDown} className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="siswa-heading" className={PANEL}>
          <h2 id="siswa-heading" className={HEADING}>Siswa</h2>
          {desk.student ? (
            <StudentCard card={desk.student} onChange={changeStudent} />
          ) : (
            <>
              <form role="search" onSubmit={searchStudent}>
                <label htmlFor="student" className="sr-only">Scan kartu, NIS, atau nama siswa</label>
                <input id="student" name="student" autoFocus autoComplete="off" placeholder="Scan kartu / NIS / nama siswa" className={INPUT} />
              </form>
              {studentMessage && <p role="alert" className={`${ALERT} mt-2`}>{studentMessage}</p>}
              {candidates.length > 0 && (
                <ul className="mt-2 divide-y divide-[var(--color-ink-100)] rounded-md border border-[var(--color-ink-100)]">
                  {candidates.map((candidate) => (
                    <li key={candidate.id}>
                      <button
                        type="button"
                        onClick={() => startTransition(() => loadCard(candidate.id))}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-ink-50)]"
                      >
                        {candidate.name}
                        <span className="text-[var(--color-ink-500)]">
                          {' '}· {candidate.nis} · {candidate.className}{candidate.status === 'active' ? '' : ' · nonaktif'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

        <section aria-labelledby="buku-heading" className={PANEL}>
          <h2 id="buku-heading" className={HEADING}>Buku</h2>
          <form onSubmit={scanCopy}>
            <label htmlFor="barcode" className="sr-only">Scan barcode buku</label>
            <input ref={copyInput} id="barcode" name="barcode" autoComplete="off" placeholder="Scan barcode buku" className={INPUT} />
          </form>
          {desk.notice && <p role="alert" className={`${ALERT} mt-2`}>{desk.notice}</p>}
          {desk.copies.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-ink-500)]">Belum ada buku. Pindai barcode pada eksemplar.</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {desk.copies.map((copy, index) => (
                <li key={copy.id} className="flex items-start justify-between gap-2 text-sm">
                  <span>
                    {index + 1}. {copy.bookTitle}
                    <span className="block text-xs text-[var(--color-ink-500)]">
                      <span className="font-mono">{copy.barcode}</span>{copy.rackCode ? ` · Rak ${copy.rackCode}` : ''}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      dispatch({ type: 'removeCopy', id: copy.id });
                      // M3: daftar buku berubah — panel penolakan/galat lama sudah basi.
                      setOutcome(null);
                    }}
                    aria-label={`Hapus ${copy.barcode} dari daftar`}
                    className={buttonClass('secondary', 'sm')}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className={PANEL}>
        <p className="text-sm">
          Pinjam: <strong>{formatDate(loanDate)}</strong> · Jatuh tempo: <strong>{formatDate(dueDate)}</strong> ({durationDays} hari)
        </p>
        <label htmlFor="notes" className="mb-1 mt-3 block text-sm font-medium">Catatan</label>
        <textarea
          id="notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
          maxLength={500}
          className={INPUT}
        />
      </section>

      {outcome?.status === 'rejected' && (
        <div role="alert" className="rounded-md bg-[var(--color-status-terlambat)]/10 p-3 text-sm text-[var(--color-status-terlambat)]">
          <p className="font-semibold">Peminjaman ditolak</p>
          <ul className="mt-1 space-y-1">
            {outcome.violations.map((violation, index) => {
              const message = describeViolation(violation);
              return (
                <li key={`${violation.code}-${index}`}>
                  <span aria-hidden="true">⛔</span> <strong>{message.title}</strong> — {message.detail}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {outcome?.status === 'error' && <p role="alert" className={ALERT}>{outcome.message}</p>}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <span className="text-sm text-[var(--color-ink-500)]">
          {desk.copies.length} buku{slots === null ? '' : ` · slot tersisa ${slots}`}
        </span>
        <button type="button" onClick={save} disabled={!canSave} className={buttonClass('primary')}>
          {pending ? 'Memproses…' : 'Simpan Peminjaman'}
          <kbd className="ml-2 text-xs opacity-80">Ctrl+Enter</kbd>
        </button>
      </div>
    </div>
  );
}
