import { describe, expect, it } from 'vitest';
import {
  formatPeriod, MAX_REPORT_DAYS, parseReportPeriod, REPORT_ROW_LIMIT, truncatedMessage,
} from './report-period';

const today = '2026-09-26';
const monthSoFar = { from: '2026-09-01', to: '2026-09-26' };

describe('parseReportPeriod', () => {
  it('memakai tanggal 1 bulan ini sampai hari ini bila tidak diisi', () => {
    expect(parseReportPeriod({ dari: '', sampai: '' }, today)).toEqual({ ok: true, period: monthSoFar });
  });

  it('memakai rentang yang diisi', () => {
    expect(parseReportPeriod({ dari: '2026-08-01', sampai: '2026-08-31' }, today))
      .toEqual({ ok: true, period: { from: '2026-08-01', to: '2026-08-31' } });
  });

  it('melengkapi ujung yang kosong: sampai hari ini, atau dari tanggal 1 bulan yang sama', () => {
    expect(parseReportPeriod({ dari: '2026-09-10', sampai: '' }, today))
      .toEqual({ ok: true, period: { from: '2026-09-10', to: today } });
    expect(parseReportPeriod({ dari: '', sampai: '2026-08-15' }, today))
      .toEqual({ ok: true, period: { from: '2026-08-01', to: '2026-08-15' } });
  });

  it('kembali ke periode bawaan dengan pesan bila tanggal tidak sah', () => {
    expect(parseReportPeriod({ dari: '2026-02-30', sampai: '' }, today)).toEqual({
      ok: false,
      period: monthSoFar,
      message: 'Tanggal tidak valid. Pilih tanggal dari kalender, misalnya 01/09/2026 sampai 30/09/2026.',
    });
  });

  it('kembali ke periode bawaan dengan pesan bila periode terbalik', () => {
    expect(parseReportPeriod({ dari: '2026-09-20', sampai: '2026-09-10' }, today)).toEqual({
      ok: false,
      period: monthSoFar,
      message: 'Periode terbalik: 20/09/2026 berada setelah 10/09/2026. Tukar tanggal awal dan akhirnya.',
    });
  });

  it('kembali ke periode bawaan dengan pesan bila tahun kurang dari 1000, tanpa melempar galat', () => {
    expect(parseReportPeriod({ dari: '0026-09-01', sampai: '' }, today)).toEqual({
      ok: false,
      period: monthSoFar,
      message: 'Tanggal tidak valid. Pilih tanggal dari kalender, misalnya 01/09/2026 sampai 30/09/2026.',
    });
    expect(parseReportPeriod({ dari: '', sampai: '0026-09-30' }, today)).toEqual({
      ok: false,
      period: monthSoFar,
      message: 'Tanggal tidak valid. Pilih tanggal dari kalender, misalnya 01/09/2026 sampai 30/09/2026.',
    });
  });

  it('menolak periode lebih dari 366 hari', () => {
    expect(MAX_REPORT_DAYS).toBe(366);
    expect(parseReportPeriod({ dari: '2025-01-01', sampai: '2026-01-01' }, today).ok).toBe(true);
    expect(parseReportPeriod({ dari: '2025-01-01', sampai: '2026-01-02' }, today)).toEqual({
      ok: false,
      period: monthSoFar,
      message: 'Periode maksimal 366 hari. Persempit rentang tanggalnya.',
    });
  });
});

describe('formatPeriod dan batas baris', () => {
  it('menulis periode dengan tanggal Indonesia', () => {
    expect(formatPeriod(monthSoFar)).toBe('01/09/2026 – 26/09/2026');
  });

  it('membatasi 1.000 baris dengan pesan yang menyertakan saran tiap laporan', () => {
    expect(REPORT_ROW_LIMIT).toBe(1000);
    expect(truncatedMessage('Persempit periode atau pilih satu kelas agar lengkap.')).toBe(
      'Laporan ini memuat lebih dari 1.000 baris; yang tampil 1.000 baris pertama. Persempit periode atau pilih satu kelas agar lengkap.',
    );
    expect(truncatedMessage('Saring per kategori atau kata kunci agar lengkap.')).toBe(
      'Laporan ini memuat lebih dari 1.000 baris; yang tampil 1.000 baris pertama. Saring per kategori atau kata kunci agar lengkap.',
    );
  });
});
