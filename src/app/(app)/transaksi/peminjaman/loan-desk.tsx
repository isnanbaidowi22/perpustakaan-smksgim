'use client';

import Link from 'next/link';
import { useReducer, useRef, useState, useTransition, type FormEvent, type KeyboardEvent } from 'react';
import { buttonClass } from '@/components/ui/button-styles';
import { CARD } from '@/components/ui/card-styles';
import { CONTROL } from '@/components/ui/form-styles';
import { LOAN_SAVE_FAILED, SUGGEST_MIN_LENGTH, type CreateLoanState } from '@/lib/circulation-results';
import { formatDate } from '@/lib/format';
import { describeViolation } from '@/lib/violation-message';
import {
  createLoanAction, getBorrowerCardAction, lookupCopyAction, pickCopyAction, searchBorrowersAction, suggestBooksAction,
} from '@/server/actions/loans';
import type { BorrowerCard, BorrowerOption, LoanableBook } from '@/server/queries/circulation';
import { cardWarnings, deskReducer, INITIAL_DESK, moveHighlight, remainingSlots } from './desk-state';
import { NewStudentForm } from './new-student-form';

const INPUT = `w-full ${CONTROL}`;
const PANEL = `p-5 ${CARD}`;
const HEADING = 'mb-3 text-base font-bold text-[var(--color-ink-900)]';
/** Jeda setelah ketikan terakhir sebelum saran judul dicari. */
const SUGGEST_DELAY_MS = 250;
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
      <p className="text-sm text-[var(--color-ink-500)]">{card.student.className}</p>
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
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={onChange} className={buttonClass('secondary', 'sm')}>Ganti siswa</button>
        <Link href={`/master/siswa/${card.student.id}`} className={buttonClass('secondary', 'sm')}>Ubah data siswa</Link>
      </div>
    </div>
  );
}

export function LoanDesk({ loanDate, dueDate, durationDays }: { loanDate: string; dueDate: string; durationDays: number }) {
  const [desk, dispatch] = useReducer(deskReducer, INITIAL_DESK);
  const [candidates, setCandidates] = useState<BorrowerOption[]>([]);
  const [studentMessage, setStudentMessage] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState('');
  /** Terisi (kata kunci pencarian terakhir) selama form siswa baru terbuka. */
  const [newStudentQuery, setNewStudentQuery] = useState<string | null>(null);
  const [bookCandidates, setBookCandidates] = useState<LoanableBook[]>([]);
  /** Indeks saran judul yang disorot lewat ↑/↓; -1 bila tidak ada. */
  const [highlight, setHighlight] = useState(-1);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Setiap ketikan, submit, atau pilihan menaikkan nomor ini; jawaban saran
  // yang tiba sesudahnya sudah basi dan diabaikan.
  const suggestSeq = useRef(0);
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
    pickStudent(result.data);
  }

  function pickStudent(card: BorrowerCard) {
    dispatch({ type: 'selectStudent', card });
    setNewStudentQuery(null);
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
    setLastQuery(query);
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
      setStudentMessage(result.data.length === 0 ? 'Siswa tidak ditemukan. Periksa ejaan nama, atau tambahkan sebagai siswa baru.' : null);
    });
  }

  function scanCopy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const query = String(new FormData(form).get('barcode') ?? '');
    // F1: bersihkan kolom SEBELUM menunggu jawaban server. Pemindai barcode
    // menembakkan scan+Enter berturut-turut; kolom yang masih terisi saat
    // pindaian kedua tiba akan menambahkan barcode itu di belakang barcode
    // pertama, dan pindaian keduanya jadi tidak valid.
    form.reset();
    copyInput.current?.focus();
    clearSuggestions();
    const scanGeneration = studentGeneration.current;
    const listed = desk.copies.map((copy) => copy.id);
    startTransition(async () => {
      const result = await lookupCopyAction(query, listed);
      // F2: siswa yang dipilih berubah selagi pindaian ini ditunggu — hasilnya sudah tidak relevan.
      if (scanGeneration !== studentGeneration.current) return;
      if (!result.ok) dispatch({ type: 'notice', message: result.message });
      else if (result.data.kind === 'copy') dispatch({ type: 'addCopy', copy: result.data.copy });
      else setBookCandidates(result.data.books);
      // M3: daftar buku baru saja berubah (atau ditolak lagi) — panel penolakan/galat lama sudah basi.
      setOutcome(null);
    });
  }

  /** Judul dipilih dari hasil pencarian: sistem mengambilkan satu eksemplar yang tersedia. */
  function pickBook(bookId: string) {
    clearSuggestions();
    if (copyInput.current) copyInput.current.value = '';
    const scanGeneration = studentGeneration.current;
    const listed = desk.copies.map((copy) => copy.id);
    startTransition(async () => {
      const result = await pickCopyAction(bookId, listed);
      if (scanGeneration !== studentGeneration.current) return;
      dispatch(result.ok ? { type: 'addCopy', copy: result.data } : { type: 'notice', message: result.message });
      setOutcome(null);
      copyInput.current?.focus();
    });
  }

  function clearSuggestions() {
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    suggestSeq.current += 1;
    setBookCandidates([]);
    setHighlight(-1);
  }

  /**
   * Saran judul muncul selagi petugas mengetik. Ditunda sebentar agar tidak
   * setiap huruf memanggil server, dan agar pemindai barcode (scan+Enter
   * dalam hitungan milidetik) sudah selesai sebelum saran sempat dicari.
   * Sengaja di luar startTransition: tombol simpan tidak ikut berkedip "Memproses…".
   */
  function suggestBooks(text: string) {
    clearSuggestions();
    if (text.trim().length < SUGGEST_MIN_LENGTH) return;
    const mySeq = suggestSeq.current;
    suggestTimer.current = setTimeout(async () => {
      const result = await suggestBooksAction(text);
      if (mySeq !== suggestSeq.current || !result.ok) return;
      setBookCandidates(result.data);
    }, SUGGEST_DELAY_MS);
  }

  function onCopyKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (bookCandidates.length === 0) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((current) => moveHighlight(bookCandidates, current, event.key === 'ArrowDown' ? 1 : -1));
    } else if (event.key === 'Escape') {
      event.preventDefault();
      clearSuggestions();
    } else if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey && highlight >= 0) {
      event.preventDefault();
      pickBook(bookCandidates[highlight].bookId);
    }
  }

  function save() {
    if (!canSave || !desk.student) return;
    const input = { studentId: desk.student.student.id, copyIds: desk.copies.map((copy) => copy.id), notes };
    startTransition(async () => {
      let result: CreateLoanState;
      try {
        result = await createLoanAction(input);
      } catch {
        // Jawaban server tidak pernah tiba: daftar buku dan siswa dipertahankan
        // agar petugas dapat memeriksa riwayat lalu menyimpan ulang.
        result = { status: 'error', message: LOAN_SAVE_FAILED };
      }
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
        <h2 className="page-title text-xl font-bold text-[var(--color-ink-900)]">Peminjaman tersimpan</h2>
        <p className="mt-2 text-sm">
          Nomor transaksi <strong className="font-mono">{outcome.transactionNumber}</strong>. Jatuh tempo{' '}
          <strong>{formatDate(outcome.dueDate)}</strong>.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" autoFocus onClick={() => setOutcome(null)} className={buttonClass('primary')}>
            Peminjaman Baru
          </button>
          <Link
            href={`/cetak/struk/${outcome.loanId}`}
            target="_blank"
            rel="noopener"
            className={buttonClass('secondary')}
          >
            Cetak Struk
          </Link>
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
          ) : newStudentQuery !== null ? (
            <NewStudentForm
              query={newStudentQuery}
              onCreated={(card) => {
                // Pencarian/pemuatan siswa lama yang masih ditunggu tidak boleh menimpa siswa baru ini.
                studentGeneration.current += 1;
                pickStudent(card);
              }}
              onCancel={() => setNewStudentQuery(null)}
            />
          ) : (
            <>
              <form role="search" onSubmit={searchStudent}>
                <label htmlFor="student" className="sr-only">Nama siswa</label>
                <input id="student" name="student" autoFocus autoComplete="off" placeholder="Ketik nama siswa" className={INPUT} />
              </form>
              {studentMessage && <p role="alert" className={`${ALERT} mt-2`}>{studentMessage}</p>}
              {candidates.length > 0 && (
                <ul className="mt-2 divide-y divide-[var(--color-divider)] overflow-hidden rounded-lg border border-[var(--color-ink-100)]">
                  {candidates.map((candidate) => (
                    <li key={candidate.id}>
                      <button
                        type="button"
                        onClick={() => startTransition(() => loadCard(candidate.id))}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-ink-50)]"
                      >
                        {candidate.name}
                        <span className="text-[var(--color-ink-500)]">
                          {' '}· {candidate.className}{candidate.status === 'active' ? '' : ' · nonaktif'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                onClick={() => {
                  setStudentMessage(null);
                  setNewStudentQuery(lastQuery);
                }}
                className={`${buttonClass(studentMessage ? 'primary' : 'secondary', 'sm')} mt-3`}
              >
                Tambah siswa baru
              </button>
            </>
          )}
        </section>

        <section aria-labelledby="buku-heading" className={PANEL}>
          <h2 id="buku-heading" className={HEADING}>Buku</h2>
          <form onSubmit={scanCopy}>
            <label htmlFor="barcode" className="sr-only">Scan barcode, atau ketik judul atau ISBN buku</label>
            <input
              ref={copyInput}
              id="barcode"
              name="barcode"
              autoComplete="off"
              placeholder="Scan barcode / judul / ISBN buku"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={bookCandidates.length > 0}
              aria-controls="saran-buku"
              aria-activedescendant={highlight >= 0 ? `saran-buku-${highlight}` : undefined}
              onChange={(event) => suggestBooks(event.target.value)}
              onKeyDown={onCopyKeyDown}
              className={INPUT}
            />
          </form>
          {desk.notice && <p role="alert" className={`${ALERT} mt-2`}>{desk.notice}</p>}
          {bookCandidates.length > 0 && (
            <ul id="saran-buku" role="listbox" aria-label="Saran judul buku" className="mt-2 divide-y divide-[var(--color-divider)] overflow-hidden rounded-lg border border-[var(--color-ink-100)]">
              {bookCandidates.map((book, index) => (
                <li key={book.bookId} id={`saran-buku-${index}`} role="option" aria-selected={index === highlight} aria-disabled={book.availableCount === 0}>
                  <button
                    type="button"
                    tabIndex={-1}
                    disabled={book.availableCount === 0}
                    // mousedown, bukan click: fokus tetap di kolom buku.
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => pickBook(book.bookId)}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-ink-50)] disabled:cursor-not-allowed disabled:opacity-60 ${index === highlight ? 'bg-[var(--color-ink-50)]' : ''}`}
                  >
                    {book.title}
                    <span className="text-[var(--color-ink-500)]">
                      {' '}· {book.author}
                      {' '}· {book.availableCount === 0 ? 'tidak ada yang tersedia' : `tersedia ${book.availableCount}`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {desk.copies.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-ink-500)]">Belum ada buku. Pindai barcode eksemplar, atau ketik judul atau ISBN.</p>
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
        <label htmlFor="notes" className="mb-1.5 mt-3 block text-sm font-medium text-[var(--color-ink-900)]">Catatan</label>
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
        <div role="alert" className="rounded-lg bg-[var(--color-status-terlambat)]/8 px-4 py-3 text-sm text-[var(--color-status-terlambat)]">
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
