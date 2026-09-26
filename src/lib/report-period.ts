import { diffDays, type IsoDate } from '@/domain/shared/date';
import { formatDate } from './format';
import { parseIsoDate } from './iso-date';

/** Batas baris per laporan agar halaman tetap ringan dan dapat dicetak. Ringkasan tetap menghitung seluruhnya. */
export const REPORT_ROW_LIMIT = 1000;

export const MAX_REPORT_DAYS = 366;

/** Pesan pemotongan baris, dengan saran yang sesuai kontrol laporan masing-masing (I1). */
export function truncatedMessage(advice: string): string {
  return `Laporan ini memuat lebih dari 1.000 baris; yang tampil 1.000 baris pertama. ${advice}`;
}

export interface ReportPeriod {
  from: IsoDate;
  to: IsoDate;
}

export type PeriodResult =
  | { ok: true; period: ReportPeriod }
  | { ok: false; period: ReportPeriod; message: string };

function monthStart(date: IsoDate): IsoDate {
  return `${date.slice(0, 8)}01`;
}

/**
 * Periode laporan dari `?dari=&sampai=`. Masukan yang salah tidak pernah
 * menggagalkan halaman: laporan tampil dengan periode bawaan (tanggal 1
 * bulan ini sampai hari ini) beserta pesan yang menyebut kesalahannya.
 */
export function parseReportPeriod(params: { dari: string; sampai: string }, today: IsoDate): PeriodResult {
  const fallback = { from: monthStart(today), to: today };
  const dari = params.dari.trim();
  const sampai = params.sampai.trim();
  if (!dari && !sampai) return { ok: true, period: fallback };

  const to = sampai ? parseIsoDate(sampai) : today;
  const from = dari ? parseIsoDate(dari) : to ? monthStart(to) : null;
  if (!from || !to) {
    return {
      ok: false,
      period: fallback,
      message: 'Tanggal tidak valid. Pilih tanggal dari kalender, misalnya 01/09/2026 sampai 30/09/2026.',
    };
  }
  if (from > to) {
    return {
      ok: false,
      period: fallback,
      message: `Periode terbalik: ${formatDate(from)} berada setelah ${formatDate(to)}. Tukar tanggal awal dan akhirnya.`,
    };
  }
  if (diffDays(from, to) + 1 > MAX_REPORT_DAYS) {
    return { ok: false, period: fallback, message: `Periode maksimal ${MAX_REPORT_DAYS} hari. Persempit rentang tanggalnya.` };
  }
  return { ok: true, period: { from, to } };
}

export function formatPeriod(period: ReportPeriod): string {
  return `${formatDate(period.from)} – ${formatDate(period.to)}`;
}
