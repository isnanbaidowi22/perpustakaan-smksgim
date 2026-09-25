import { describe, expect, it } from 'vitest';
import {
  AUDIT_KIND_ENTITIES, auditActionLabel, auditEntityHref, parseAuditKind, parseDateFilter, redactSecrets, summarizeAudit,
} from './audit-labels';

describe('auditActionLabel', () => {
  it('menerjemahkan aksi yang dikenal dan menampilkan kode untuk yang tidak dikenal', () => {
    expect(auditActionLabel('loan.create')).toBe('Peminjaman dicatat');
    expect(auditActionLabel('return.process')).toBe('Pengembalian diproses');
    expect(auditActionLabel('fine.pay')).toBe('Pembayaran denda');
    expect(auditActionLabel('copy.restore')).toBe('Eksemplar dipulihkan');
    expect(auditActionLabel('user.reset_password')).toBe('Password pengguna direset');
    expect(auditActionLabel('report.export')).toBe('report.export');
    expect(auditActionLabel('constructor')).toBe('constructor');
  });
});

describe('parseAuditKind dan parseDateFilter', () => {
  it('menerima jenis yang dikenal saja', () => {
    expect(parseAuditKind('transaksi')).toBe('transaksi');
    expect(parseAuditKind('pengaturan')).toBe('pengaturan');
    expect(parseAuditKind('toString')).toBe('all');
    expect(parseAuditKind('')).toBe('all');
    expect(AUDIT_KIND_ENTITIES.koleksi).toEqual(['books', 'book_copies', 'categories', 'racks']);
  });

  it('menerima tanggal kalender yang sah saja', () => {
    expect(parseDateFilter('2026-09-25')).toBe('2026-09-25');
    expect(parseDateFilter('2026-02-30')).toBeNull();
    expect(parseDateFilter('25/09/2026')).toBeNull();
    expect(parseDateFilter('')).toBeNull();
  });
});

describe('auditEntityHref', () => {
  it('menautkan entitas yang punya halaman', () => {
    expect(auditEntityHref('loans', 'l1')).toBe('/transaksi/riwayat/l1');
    expect(auditEntityHref('books', 'b1')).toBe('/master/buku/b1');
    expect(auditEntityHref('students', 's1')).toBe('/master/siswa/s1');
    expect(auditEntityHref('profiles', 'u1')).toBe('/pengaturan/pengguna/u1');
    expect(auditEntityHref('library_settings', null)).toBe('/pengaturan/konfigurasi');
  });

  it('tidak menautkan eksemplar, entitas tak dikenal, atau id kosong', () => {
    expect(auditEntityHref('book_copies', 'c1')).toBeNull();
    expect(auditEntityHref('constructor', 'x')).toBeNull();
    expect(auditEntityHref('loans', null)).toBeNull();
  });
});

describe('summarizeAudit', () => {
  it('peminjaman: nomor transaksi, jumlah buku, NIS, dan jatuh tempo', () => {
    expect(summarizeAudit('loan.create', {
      transactionNumber: 'PJM-20260925-0001', studentNis: '202600123', barcodes: ['BK-000001', 'BK-000004'], dueDate: '2026-09-28',
    })).toEqual({
      subject: 'PJM-20260925-0001',
      details: ['2 buku: BK-000001, BK-000004', 'NIS 202600123', 'Jatuh tempo 28/09/2026'],
    });
  });

  it('pengembalian: kondisi yang tidak baik dan total denda', () => {
    expect(summarizeAudit('return.process', {
      transactionNumber: 'PJM-20260925-0001',
      items: [
        { barcode: 'BK-000001', condition: 'RUSAK', daysLate: 0, lateFine: 0, replacementFee: 60000 },
        { barcode: 'BK-000004', condition: 'BAIK', daysLate: 0, lateFine: 0, replacementFee: 0 },
      ],
      totalFine: 60000,
      status: 'SEBAGIAN_KEMBALI',
    })).toEqual({
      subject: 'PJM-20260925-0001',
      details: ['2 buku kembali', 'BK-000001 rusak', 'Total denda transaksi Rp60.000'],
    });
  });

  it('pembayaran denda: nominal dan sisa atau lunas', () => {
    expect(summarizeAudit('fine.pay', { transactionNumber: 'PJM-1', amount: 20000, remaining: 40000 }))
      .toEqual({ subject: 'PJM-1', details: ['Dibayar Rp20.000', 'Sisa tagihan Rp40.000'] });
    expect(summarizeAudit('fine.pay', { transactionNumber: 'PJM-1', amount: 40000, remaining: 0 }))
      .toEqual({ subject: 'PJM-1', details: ['Dibayar Rp40.000', 'Lunas'] });
  });

  it('perubahan data: subjek dari nilai baru dan daftar kolom yang berubah', () => {
    expect(summarizeAudit('book.update', {
      before: { title: 'Pemrograman Web', price: 85000, author: 'Budi' },
      after: { title: 'Pemrograman Web Lanjut', price: 90000, author: 'Budi' },
    })).toEqual({ subject: 'Pemrograman Web Lanjut', details: ['Diubah: judul, harga'] });

    expect(summarizeAudit('settings.update', {
      before: { finePerDay: 1000, schoolName: 'SMK' },
      after: { finePerDay: 1000, schoolName: 'SMK' },
    })).toEqual({ subject: null, details: ['Tidak ada kolom yang berubah'] });
  });

  it('perubahan status eksemplar dan eksemplar baru', () => {
    expect(summarizeAudit('copy.restore', { barcode: 'BK-000001', from: 'RUSAK', to: 'TERSEDIA' }))
      .toEqual({ subject: 'BK-000001', details: ['RUSAK → TERSEDIA'] });
    expect(summarizeAudit('copy.create', { barcodes: ['BK-000010', 'BK-000011', 'BK-000012'] }))
      .toEqual({ subject: 'BK-000010 s.d. BK-000012', details: ['3 eksemplar'] });
  });

  it('siswa, rak, dan pengguna: subjek dari nama, NIS, kode, atau username', () => {
    expect(summarizeAudit('student.create', { nis: '202600123', name: 'Ahmad Fauzi', className: 'XI RPL 1' }))
      .toEqual({ subject: 'Ahmad Fauzi (NIS 202600123)', details: [] });
    expect(summarizeAudit('rack.deactivate', { code: 'A-3' })).toEqual({ subject: 'Rak A-3', details: [] });
    expect(summarizeAudit('user.create', { username: 'qa_petugas', fullName: 'QA', role: 'petugas' }))
      .toEqual({ subject: 'qa_petugas', details: [] });
  });

  it('tidak pernah mengarang isi dari kolom rahasia dan tahan terhadap catatan kosong', () => {
    expect(summarizeAudit('user.reset_password', { username: 'budi', password: 'rahasia123' }))
      .toEqual({ subject: 'budi', details: [] });
    expect(summarizeAudit('loan.create', null)).toEqual({ subject: null, details: [] });
    expect(summarizeAudit('loan.create', 'teks')).toEqual({ subject: null, details: [] });
  });
});

describe('redactSecrets', () => {
  it('menyamarkan kolom rahasia di tingkat mana pun', () => {
    expect(redactSecrets({ username: 'budi', password: 'x', nested: { newPassword: 'y', token: 'z' }, list: [{ secret: 1 }] }))
      .toEqual({ username: 'budi', password: '••••', nested: { newPassword: '••••', token: '••••' }, list: [{ secret: '••••' }] });
    expect(redactSecrets(null)).toBeNull();
  });
});
