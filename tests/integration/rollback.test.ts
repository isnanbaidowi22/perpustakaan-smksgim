import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { categories } from '@/server/db/schema';
import { testActor, withRollback } from './helpers';

describe('withRollback', () => {
  it('tidak meninggalkan data apa pun setelah uji selesai', async () => {
    const name = `UJI-${crypto.randomUUID()}`;

    await withRollback(async (tx) => {
      await tx.insert(categories).values({ name });
      const inside = await tx.select().from(categories).where(eq(categories.name, name));
      expect(inside).toHaveLength(1);
    });

    const after = await db.select().from(categories).where(eq(categories.name, name));
    expect(after).toEqual([]);
  });

  it('meneruskan kegagalan asersi di dalamnya', async () => {
    await expect(
      withRollback(async () => {
        expect(1).toBe(2);
      }),
    ).rejects.toThrow();
  });
});

describe('testActor', () => {
  it('mengembalikan profil admin aktif dari data seed', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      expect(actor.role).toBe('admin');
      expect(actor.id).toMatch(/^[0-9a-f-]{36}$/);
    });
  });
});
