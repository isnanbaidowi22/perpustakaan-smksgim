import { describe, expect, it } from 'vitest';
import { LABELS_PER_SHEET, MAX_LABELS, parseLabelRequest } from './label-request';

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
