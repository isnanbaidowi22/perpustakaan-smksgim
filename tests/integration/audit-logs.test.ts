import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { Transaction } from '@/server/db/executor';
import { auditLogs, profiles } from '@/server/db/schema';
import { listAuditLogs } from '@/server/queries/audit-logs';
import { testActor, withRollback } from './helpers';

/** Catatan uji bertanggal 2090 dan bertanda UJI-AUD: tidak ada data sungguhan yang cocok. */
async function seedAudit(tx: Transaction) {
  const actor = await testActor(tx);
  const [profile] = await tx.select({ username: profiles.username }).from(profiles).where(eq(profiles.id, actor.id));
  await tx.insert(auditLogs).values([
    {
      userId: actor.id, action: 'loan.create', entity: 'loans', entityId: crypto.randomUUID(),
      metadata: { transactionNumber: 'UJI-AUD-0001' }, createdAt: new Date('2090-03-01T17:30:00Z'),
    },
    {
      userId: actor.id, action: 'book.update', entity: 'books', entityId: crypto.randomUUID(),
      metadata: { before: { title: 'UJI-AUD Buku' }, after: { title: 'UJI-AUD Buku Baru' } },
      createdAt: new Date('2090-03-02T02:00:00Z'),
    },
    {
      userId: actor.id, action: 'student.create', entity: 'students', entityId: crypto.randomUUID(),
      metadata: { nis: 'UJI-AUD-S1', name: 'UJI Siswa Audit' }, createdAt: new Date('2090-03-01T16:59:00Z'),
    },
  ]);
  return { actor, username: profile?.username ?? '' };
}

const base = { q: '', kind: 'all' as const, date: null, page: 1 };

describe('listAuditLogs', () => {
  it('mencari di isi catatan, terbaru lebih dulu, beserta pelakunya', async () => {
    await withRollback(async (tx) => {
      const { username } = await seedAudit(tx);

      const { rows, total } = await listAuditLogs({ ...base, q: 'uji-aud' }, tx);

      expect(total).toBe(3);
      expect(rows.map((row) => row.action)).toEqual(['book.update', 'loan.create', 'student.create']);
      expect(rows[0]).toMatchObject({ entity: 'books', username });
      expect(rows[0].createdAt).toBeInstanceOf(Date);
      expect(rows[1].metadata).toEqual({ transactionNumber: 'UJI-AUD-0001' });
    });
  });

  it('menyaring menurut jenis data', async () => {
    await withRollback(async (tx) => {
      await seedAudit(tx);

      const { rows } = await listAuditLogs({ ...base, q: 'UJI-AUD', kind: 'transaksi' }, tx);

      expect(rows.map((row) => row.action)).toEqual(['loan.create']);
    });
  });

  it('menyaring menurut tanggal WIB, bukan tanggal UTC', async () => {
    await withRollback(async (tx) => {
      await seedAudit(tx);

      // 2090-03-01T17:30Z = 02/03 00.30 WIB (masuk); 2090-03-02T02:00Z = 02/03 09.00 WIB (masuk);
      // 2090-03-01T16:59Z = 01/03 23.59 WIB (tidak).
      const { rows, total } = await listAuditLogs({ ...base, date: '2090-03-02' }, tx);

      expect(total).toBe(2);
      expect(rows.map((row) => row.action)).toEqual(['book.update', 'loan.create']);
    });
  });

  it('mencari menurut username pelaku', async () => {
    await withRollback(async (tx) => {
      const { username } = await seedAudit(tx);

      const { total } = await listAuditLogs({ ...base, q: username, date: '2090-03-02' }, tx);

      expect(total).toBe(2);
    });
  });
});
