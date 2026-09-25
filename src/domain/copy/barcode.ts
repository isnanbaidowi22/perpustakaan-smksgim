/** Awalan barcode yang dibuat sistem. Dicadangkan: barcode manual tidak boleh memakainya. */
export const AUTO_BARCODE_PREFIX = 'BK-';

const MIN_DIGITS = 6;

export function formatAutoBarcode(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error(`Nomor urut barcode harus bilangan bulat positif, diterima: ${sequence}`);
  }
  return `${AUTO_BARCODE_PREFIX}${String(sequence).padStart(MIN_DIGITS, '0')}`;
}

/**
 * Barcode untuk `count` nomor terakhir yang dialokasikan penghitung.
 * Penghitung mengembalikan nomor terakhirnya, jadi rentangnya dihitung mundur.
 */
export function autoBarcodeRange(lastSequence: number, count: number): string[] {
  return Array.from({ length: count }, (_, index) => formatAutoBarcode(lastSequence - count + 1 + index));
}

export function isReservedBarcode(barcode: string): boolean {
  return barcode.toUpperCase().startsWith(AUTO_BARCODE_PREFIX);
}
