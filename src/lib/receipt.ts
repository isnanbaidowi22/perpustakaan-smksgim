/** Lebar kertas printer thermal yang didukung (spec 8.5). */
export type ReceiptWidth = 58 | 80;

export function parseReceiptWidth(value: string): ReceiptWidth {
  return value === '80' ? 80 : 58;
}

const BASE_HEIGHT_MM = 110;
const PER_ITEM_MM = 12;
const FOOTER_MM = 14;
const NOTES_MM = 10;

/**
 * Tinggi halaman struk. CSS `@page` tidak mengenal tinggi "otomatis",
 * jadi tingginya diperkirakan dari isi struk. Sisa kertas kosong di bawah
 * struk lebih baik daripada struk yang terpotong ke halaman kedua.
 */
export function receiptPageHeightMm(itemCount: number, hasFooter: boolean, hasNotes: boolean): number {
  return BASE_HEIGHT_MM + itemCount * PER_ITEM_MM + (hasFooter ? FOOTER_MM : 0) + (hasNotes ? NOTES_MM : 0);
}

export function receiptPageCss(width: ReceiptWidth, heightMm: number): string {
  return `@page { size: ${width}mm ${heightMm}mm; margin: 0; }`;
}
