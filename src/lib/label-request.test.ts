import { describe, expect, it } from 'vitest';
import { chunkSheets, LABEL_SHEET, LABELS_PER_SHEET, MAX_LABELS, parseLabelRequest } from './label-request';

const empty = { buku: '', dari: '', sampai: '' };

describe('parseLabelRequest', () => {
  it('tanpa pilihan: belum ada yang dicetak', () => {
    expect(parseLabelRequest(empty)).toEqual({ kind: 'none' });
  });

  it('per judul bila id buku diisi, mengabaikan rentang', () => {
    expect(parseLabelRequest({ buku: ' b1 ', dari: 'BK-000001', sampai: '' })).toEqual({ kind: 'book', bookId: 'b1' });
  });

  it('per rentang, dirapikan dan dijadikan huruf besar', () => {
    expect(parseLabelRequest({ ...empty, dari: ' bk-000001 ', sampai: 'bk-000021' }))
      .toEqual({ kind: 'range', from: 'BK-000001', to: 'BK-000021' });
    expect(parseLabelRequest({ ...empty, dari: 'BK-000005', sampai: 'BK-000005' }))
      .toEqual({ kind: 'range', from: 'BK-000005', to: 'BK-000005' });
  });

  it('menjelaskan rentang yang belum lengkap', () => {
    expect(parseLabelRequest({ ...empty, dari: 'BK-000001' })).toEqual({
      kind: 'invalid',
      message: 'Isi barcode awal dan akhir rentang, misalnya BK-000001 sampai BK-000021.',
    });
  });

  it('menjelaskan rentang yang terbalik', () => {
    expect(parseLabelRequest({ ...empty, dari: 'BK-000030', sampai: 'BK-000010' })).toEqual({
      kind: 'invalid',
      message: 'Rentang terbalik: BK-000030 berada setelah BK-000010. Tukar barcode awal dan akhirnya.',
    });
  });

  it('memakai lembar A4 berisi 21 label dan batas 10 lembar sekali cetak', () => {
    expect(LABELS_PER_SHEET).toBe(21);
    expect(MAX_LABELS).toBe(210);
  });
});

describe('LABEL_SHEET', () => {
  it('geometri 3 kolom pas dengan lebar A4 210 mm', () => {
    const { columns, labelWidthMm, columnGapMm, marginSideMm, widthMm } = LABEL_SHEET;
    const total = columns * labelWidthMm + (columns - 1) * columnGapMm + 2 * marginSideMm;
    expect(total).toBeCloseTo(widthMm, 0);
  });

  it('geometri 7 baris pas dengan tinggi A4 297 mm, sisa margin bawah minimal 10 mm', () => {
    const { rows, labelHeightMm, marginTopMm, heightMm } = LABEL_SHEET;
    const bottomMargin = heightMm - marginTopMm - rows * labelHeightMm;
    expect(bottomMargin).toBeGreaterThanOrEqual(10);
  });
});

describe('chunkSheets', () => {
  it('mengelompokkan item per lembar (21 label per lembar)', () => {
    expect(chunkSheets([])).toEqual([]);
    expect(chunkSheets(Array.from({ length: 21 }, (_, i) => i))).toHaveLength(1);
    expect(chunkSheets(Array.from({ length: 22 }, (_, i) => i))).toHaveLength(2);
    expect(chunkSheets(Array.from({ length: 45 }, (_, i) => i))).toHaveLength(3);
  });

  it('lembar terakhir bisa lebih sedikit dari 21', () => {
    const sheets = chunkSheets(Array.from({ length: 22 }, (_, i) => i));
    expect(sheets[0]).toHaveLength(21);
    expect(sheets[1]).toHaveLength(1);
  });
});
