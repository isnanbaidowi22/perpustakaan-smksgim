import { describe, expect, it } from 'vitest';
import { nextCopyStatus, resolveLoanStatus } from './copy-status';

describe('nextCopyStatus', () => {
  it('mengembalikan eksemplar berkondisi baik menjadi tersedia', () => {
    expect(nextCopyStatus('BAIK')).toBe('TERSEDIA');
  });

  it('tidak membuat eksemplar rusak menjadi tersedia', () => {
    expect(nextCopyStatus('RUSAK')).toBe('RUSAK');
  });

  it('tidak membuat eksemplar hilang menjadi tersedia', () => {
    expect(nextCopyStatus('HILANG')).toBe('HILANG');
  });
});

describe('resolveLoanStatus', () => {
  it('tetap aktif bila belum ada satu pun yang kembali', () => {
    expect(resolveLoanStatus([{ returned: false }, { returned: false }])).toBe('AKTIF');
  });

  it('menjadi sebagian kembali bila baru sebagian yang kembali', () => {
    expect(resolveLoanStatus([{ returned: true }, { returned: false }])).toBe('SEBAGIAN_KEMBALI');
  });

  it('menjadi selesai bila seluruhnya sudah kembali', () => {
    expect(resolveLoanStatus([{ returned: true }, { returned: true }])).toBe('SELESAI');
  });

  it('menganggap peminjaman satu buku yang sudah kembali sebagai selesai', () => {
    expect(resolveLoanStatus([{ returned: true }])).toBe('SELESAI');
  });

  it('menolak peminjaman tanpa item', () => {
    expect(() => resolveLoanStatus([])).toThrow('minimal satu eksemplar');
  });
});
