import { calculateItemFine } from '@/domain/return/fine';
import type { IsoDate } from '@/domain/shared/date';
import type { ReturnCondition } from '@/domain/shared/types';

export interface ReturnableItem {
  id: string;
  barcode: string;
  bookTitle: string;
  bookPrice: number;
}

export interface ReturnRowState {
  selected: boolean;
  condition: ReturnCondition;
  /** Isian mentah kolom biaya ganti, misalnya '85.000'. */
  replacementFee: string;
  note: string;
}

export interface PreviewLine {
  itemId: string;
  daysLate: number;
  lateFine: number;
  replacementFee: number;
  total: number;
}

export interface ReturnPreview {
  lines: PreviewLine[];
  total: number;
  /** Menahan penyimpanan. */
  problems: string[];
  /** Diperlihatkan, tetapi tidak menahan penyimpanan. */
  warnings: string[];
}

/**
 * Mengembalikan semua buku adalah kasus tersering, jadi semuanya tercentang
 * secara bawaan. Tetapi bila `query` (kolom pencarian pinjaman) sama persis
 * dengan barcode salah satu buku dalam pinjaman ini, petugas baru saja
 * memindai satu buku yang benar-benar dikembalikan — pencentangan lain
 * (nomor transaksi, NIS, nama) tetap mencentang semuanya (I1).
 */
export function initialRows(items: ReturnableItem[], query?: string): Record<string, ReturnRowState> {
  const normalized = query?.trim().toUpperCase();
  const matchedId = normalized
    ? items.find((item) => item.barcode.toUpperCase() === normalized)?.id
    : undefined;
  return Object.fromEntries(items.map((item) => [
    item.id,
    {
      selected: matchedId ? item.id === matchedId : true,
      condition: 'BAIK' as ReturnCondition,
      replacementFee: String(item.bookPrice),
      note: '',
    },
  ]));
}

/** '30.000' → 30000; kosong → null; selain angka → NaN. */
export function parseRupiahInput(raw: string): number | null {
  const digits = raw.replace(/[.\s]/g, '');
  if (digits === '') return null;
  return /^\d+$/.test(digits) ? Number(digits) : Number.NaN;
}

function feeOf(row: ReturnRowState): number | null {
  return row.condition === 'BAIK' ? null : parseRupiahInput(row.replacementFee);
}

/**
 * Denda dihitung di peramban dengan fungsi domain yang sama dengan server,
 * sehingga nominalnya terlihat SEBELUM tombol ditekan (spec 8.3). Server tetap
 * menghitung ulang saat menyimpan.
 */
export function previewReturn(
  items: ReturnableItem[],
  rows: Record<string, ReturnRowState>,
  context: { dueDate: IsoDate; today: IsoDate; finePerDay: number },
): ReturnPreview {
  const lines: PreviewLine[] = [];
  const problems: string[] = [];
  const warnings: string[] = [];

  for (const item of items) {
    const row = rows[item.id];
    if (!row?.selected) continue;
    const fee = feeOf(row);
    if (row.condition !== 'BAIK' && (fee === null || Number.isNaN(fee))) {
      problems.push(`Isi biaya ganti ${item.barcode} dengan angka, misalnya 50.000.`);
      continue;
    }
    if (row.condition !== 'BAIK' && fee === 0) {
      warnings.push(`Biaya ganti ${item.barcode} Rp0. Isi biaya ganti bila buku ini memang harus diganti.`);
    }
    const fine = calculateItemFine({
      dueDate: context.dueDate,
      returnDate: context.today,
      condition: row.condition,
      finePerDay: context.finePerDay,
      bookPrice: item.bookPrice,
      replacementFeeOverride: fee ?? undefined,
    });
    lines.push({ itemId: item.id, ...fine });
  }

  if (lines.length === 0 && problems.length === 0) problems.push('Centang minimal satu buku yang dikembalikan.');
  return { lines, total: lines.reduce((sum, line) => sum + line.total, 0), problems, warnings };
}

export function toReturnInput(loanId: string, items: ReturnableItem[], rows: Record<string, ReturnRowState>) {
  return {
    loanId,
    items: items
      .filter((item) => rows[item.id]?.selected)
      .map((item) => {
        const row = rows[item.id];
        return {
          loanItemId: item.id,
          condition: row.condition,
          replacementFee: feeOf(row),
          note: row.note.trim() || null,
        };
      }),
  };
}
