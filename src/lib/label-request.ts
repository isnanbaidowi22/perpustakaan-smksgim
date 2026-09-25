/** Lembar label A4 3 × 7, tiap label 63,5 × 38,1 mm. */
export const LABELS_PER_SHEET = 21;

/** Sepuluh lembar sekali cetak: halaman tetap ringan dan printer tidak macet di tengah antrean panjang. */
export const MAX_LABELS = LABELS_PER_SHEET * 10;

export type LabelRequest =
  | { kind: 'none' }
  | { kind: 'book'; bookId: string }
  | { kind: 'range'; from: string; to: string }
  | { kind: 'invalid'; message: string };

/**
 * Membaca pilihan label dari URL. Perbandingan rentang memakai urutan
 * byte (sama dengan `collate "C"` di query), sehingga BK-000010 berada
 * setelah BK-000009 selama jumlah digitnya sama.
 */
export function parseLabelRequest(params: { buku: string; dari: string; sampai: string }): LabelRequest {
  const bookId = params.buku.trim();
  if (bookId) return { kind: 'book', bookId };

  const from = params.dari.trim().toUpperCase();
  const to = params.sampai.trim().toUpperCase();
  if (!from && !to) return { kind: 'none' };
  if (!from || !to) {
    return { kind: 'invalid', message: 'Isi barcode awal dan akhir rentang, misalnya BK-000001 sampai BK-000021.' };
  }
  if (from > to) {
    return { kind: 'invalid', message: `Rentang terbalik: ${from} berada setelah ${to}. Tukar barcode awal dan akhirnya.` };
  }
  return { kind: 'range', from, to };
}
