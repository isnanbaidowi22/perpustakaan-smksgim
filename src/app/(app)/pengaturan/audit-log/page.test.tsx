import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { mockList, mockRequireProfile } = vi.hoisted(() => ({ mockList: vi.fn(), mockRequireProfile: vi.fn() }));

vi.mock('@/server/queries/audit-logs', () => ({ listAuditLogs: mockList }));
vi.mock('@/server/auth/guard', () => ({ requireProfile: mockRequireProfile }));
vi.mock('@/lib/school-date', () => ({ formatSchoolDateTime: () => '25/09/2026 14.03' }));

import AuditLogPage from './page';

const row = {
  id: 'a1',
  createdAt: new Date('2026-09-25T07:03:00Z'),
  action: 'fine.pay',
  entity: 'loans',
  entityId: 'l1',
  metadata: { transactionNumber: 'PJM-20260925-0001', amount: 20000, remaining: 40000 },
  username: 'petugas',
  fullName: 'Siti Petugas',
};

async function render(params: Record<string, string> = {}) {
  return renderToStaticMarkup(await AuditLogPage({ searchParams: Promise.resolve(params) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireProfile.mockResolvedValue({ id: 'u1', role: 'admin', fullName: 'Admin', status: 'active' });
  mockList.mockResolvedValue({ rows: [row], total: 1 });
});

describe('AuditLogPage', () => {
  it('menampilkan waktu, pelaku, aksi, tautan data, dan ringkasan', async () => {
    const html = await render({ q: 'PJM-20260925-0001', jenis: 'transaksi', tanggal: '2026-09-25', hal: '2' });

    expect(mockList).toHaveBeenCalledWith({ q: 'PJM-20260925-0001', kind: 'transaksi', date: '2026-09-25', page: 2 });
    expect(html).toContain('25/09/2026 14.03');
    expect(html).toContain('Siti Petugas');
    expect(html).toContain('petugas');
    expect(html).toContain('Pembayaran denda');
    expect(html).toContain('fine.pay');
    expect(html).toContain('href="/transaksi/riwayat/l1"');
    expect(html).toContain('Dibayar Rp20.000');
    expect(html).toContain('Sisa tagihan Rp40.000');
    expect(html).toContain('Lihat isi lengkap');
  });

  it('mengabaikan tanggal yang tidak sah dengan pemberitahuan', async () => {
    const html = await render({ tanggal: '2026-02-30' });

    expect(mockList).toHaveBeenCalledWith({ q: '', kind: 'all', date: null, page: 1 });
    expect(html).toContain('Tanggal 2026-02-30 tidak valid; filter tanggal diabaikan.');
  });

  it('menampilkan pesan kosong dan pelaku sistem', async () => {
    mockList.mockResolvedValueOnce({ rows: [{ ...row, username: null, fullName: null, entityId: null }], total: 1 });
    const html = await render();
    expect(html).toContain('Sistem');

    mockList.mockResolvedValueOnce({ rows: [], total: 0 });
    expect(await render()).toContain('Belum ada catatan yang cocok.');
  });

  it('menyamarkan kolom rahasia di isi lengkap', async () => {
    mockList.mockResolvedValueOnce({
      rows: [{ ...row, action: 'user.reset_password', entity: 'profiles', metadata: { username: 'budi', password: 'rahasia123' } }],
      total: 1,
    });

    const html = await render();

    expect(html).not.toContain('rahasia123');
    expect(html).toContain('••••');
  });
});
