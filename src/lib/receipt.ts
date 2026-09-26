/** Lebar kertas printer thermal yang didukung (spec 8.5). */
export type ReceiptWidth = 58 | 80;

export function parseReceiptWidth(value: string): ReceiptWidth {
  return value === '80' ? 80 : 58;
}

const BASE_HEIGHT_MM = 110;
/** Lebar taksiran judul dalam karakter per baris pada struk 52 mm, 11px. */
const TITLE_CHARS_PER_LINE = 28;
const LINE_MM = 5;
const FOOTER_MM = 14;
const NOTES_MM = 10;

/**
 * Tinggi halaman struk. CSS `@page` tidak mengenal tinggi "otomatis",
 * jadi tingginya diperkirakan dari isi struk: setiap judul memakai
 * `ceil(panjang / 28)` baris (minimal 1) ditambah satu baris untuk barcodenya.
 * Sisa kertas kosong di bawah struk lebih baik daripada struk yang
 * terpotong ke halaman kedua.
 */
export function receiptPageHeightMm(titles: string[], hasFooter: boolean, hasNotes: boolean): number {
  const itemsHeight = titles.reduce((total, title) => {
    const titleLines = Math.max(1, Math.ceil(title.length / TITLE_CHARS_PER_LINE));
    return total + (titleLines + 1) * LINE_MM;
  }, 0);
  return BASE_HEIGHT_MM + itemsHeight + (hasFooter ? FOOTER_MM : 0) + (hasNotes ? NOTES_MM : 0);
}

export function receiptPageCss(width: ReceiptWidth, heightMm: number): string {
  return `@page { size: ${width}mm ${heightMm}mm; margin: 0; }`;
}
