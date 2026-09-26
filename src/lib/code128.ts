/**
 * Encoder Code128 subset B (spec 8.5), murni: tanpa DOM, tanpa pustaka.
 * Subset B mencakup ASCII 32–126 — seluruh karakter yang dapat diketik
 * pada barcode manual, termasuk barcode otomatis `BK-000123` dan nomor
 * transaksi `PJM-20260925-0001`.
 */

/**
 * Lebar bar dan spasi (dalam modul) untuk nilai simbol 0–106, dimulai
 * dengan bar. Indeks 103–105 adalah START A/B/C; 106 adalah STOP (7 elemen).
 */
export const CODE128_PATTERNS: readonly string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

const START_B = 104;
const START_C = 105;
const STOP = 106;
const FIRST_CODE = 32;
const LAST_CODE = 126;

/** Angka genap ≥ 2 digit: subset C memasangkan dua digit per simbol (lebih pendek dan lebih tebal per modul). */
const ALL_DIGITS_EVEN = /^(\d\d)+$/;

/** Zona sepi di kiri dan kanan barcode, dalam modul (standar: minimal 10). */
export const QUIET_ZONE_MODULES = 10;

export function code128Values(text: string): number[] | null {
  if (text.length === 0) return null;
  if (ALL_DIGITS_EVEN.test(text)) {
    const data: number[] = [];
    for (let i = 0; i < text.length; i += 2) {
      data.push(Number(text.slice(i, i + 2)));
    }
    const checksum = data.reduce((total, value, index) => total + value * (index + 1), START_C) % 103;
    return [START_C, ...data, checksum, STOP];
  }
  const data: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0) ?? -1;
    if (code < FIRST_CODE || code > LAST_CODE) return null;
    data.push(code - FIRST_CODE);
  }
  const checksum = data.reduce((total, value, index) => total + value * (index + 1), START_B) % 103;
  return [START_B, ...data, checksum, STOP];
}

export function encodeCode128(text: string): number[] | null {
  const values = code128Values(text);
  if (!values) return null;
  return values.flatMap((value) => [...CODE128_PATTERNS[value]].map(Number));
}

export interface BarcodeBars {
  bars: { x: number; width: number }[];
  /** Lebar seluruh barcode termasuk kedua zona sepi. */
  totalModules: number;
}

export function code128Bars(text: string): BarcodeBars | null {
  const widths = encodeCode128(text);
  if (!widths) return null;
  const bars: { x: number; width: number }[] = [];
  let x = QUIET_ZONE_MODULES;
  widths.forEach((width, index) => {
    if (index % 2 === 0) bars.push({ x, width });
    x += width;
  });
  return { bars, totalModules: x + QUIET_ZONE_MODULES };
}
