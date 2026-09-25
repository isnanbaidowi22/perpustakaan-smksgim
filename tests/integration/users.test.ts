import { describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { usernameToEmail } from '@/server/auth/username';
import { auditLogs } from '@/server/db/schema';
import { getUser, listUsers } from '@/server/queries/users';
import { createUser, resetUserPassword, setUserStatus, updateUser } from '@/server/services/users';
import { fakeAuthAdmin, testActor, withRollback } from './helpers';

const input = {
  username: 'uji_petugas',
  fullName: 'UJI Petugas Baru',
  role: 'petugas' as const,
  password: 'rahasia-uji-1',
  passwordConfirm: 'rahasia-uji-1',
};

async function auditOf(tx: Parameters<Parameters<typeof withRollback>[0]>[0], entityId: string, action: string) {
  return tx.select().from(auditLogs).where(and(eq(auditLogs.entityId, entityId), eq(auditLogs.action, action)));
}

describe('createUser', () => {
  it('membuat akun autentikasi dan profil, lalu menulis audit tanpa kata sandi', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const auth = fakeAuthAdmin(tx);

      const result = await createUser(input, actor, auth, tx);

      if (!result.ok) throw new Error(result.message);
      expect(auth.created).toEqual([{ id: result.id, email: usernameToEmail('uji_petugas'), password: 'rahasia-uji-1' }]);
      expect(await getUser(result.id, tx)).toEqual({
        id: result.id, username: 'uji_petugas', fullName: 'UJI Petugas Baru', role: 'petugas', status: 'active',
      });
      const [audit] = await auditOf(tx, result.id, 'user.create');
      expect(audit?.metadata).toEqual({ username: 'uji_petugas', fullName: 'UJI Petugas Baru', role: 'petugas' });
    });
  });

  it('menolak username yang sudah dipakai tanpa menghubungi layanan autentikasi', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const auth = fakeAuthAdmin(tx);
      await createUser(input, actor, auth, tx);

      expect(await createUser(input, actor, auth, tx)).toEqual({
        ok: false, field: 'username', message: 'Username uji_petugas sudah dipakai. Pilih username lain.',
      });
      expect(auth.created).toHaveLength(1);
    });
  });

  it('menjelaskan username yang tertinggal di layanan autentikasi tanpa profil', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const auth = fakeAuthAdmin(tx, {
        createError: { code: 'email_exists', message: 'A user with this email address has already been registered' },
      });

      expect(await createUser(input, actor, auth, tx)).toEqual({
        ok: false,
        field: 'username',
        message: 'Username uji_petugas sudah terdaftar di layanan autentikasi, tetapi tidak ada di daftar pengguna. '
          + 'Pilih username lain, atau minta pengembang menghapus akun lama itu di dasbor Supabase.',
      });
    });
  });

  it('meneruskan galat layanan autentikasi lain dengan saran mencoba lagi', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const auth = fakeAuthAdmin(tx, { createError: { code: null, message: 'Service unavailable' } });

      expect(await createUser(input, actor, auth, tx)).toEqual({
        ok: false,
        message: 'Akun uji_petugas belum dapat dibuat di layanan autentikasi (Service unavailable). Coba lagi beberapa saat lagi.',
      });
    });
  });

  it('menghapus akun autentikasi bila profilnya gagal disimpan', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const auth = fakeAuthAdmin(tx, { withoutAuthRow: true });

      await expect(createUser(input, actor, auth, tx)).rejects.toThrow();

      expect(auth.deleted).toEqual([auth.created[0]?.id]);
    });
  });
});

describe('updateUser', () => {
  it('mengubah nama dan peran, dan mencatat nilai sebelum dan sesudah', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const created = await createUser(input, actor, fakeAuthAdmin(tx), tx);
      if (!created.ok) throw new Error(created.message);
      const changed = { fullName: 'UJI Admin Baru', role: 'admin' as const };

      expect(await updateUser(created.id, changed, actor, tx)).toEqual({ ok: true, id: created.id });

      expect(await getUser(created.id, tx)).toMatchObject(changed);
      const [audit] = await auditOf(tx, created.id, 'user.update');
      expect(audit?.metadata).toEqual({
        username: 'uji_petugas',
        before: { fullName: 'UJI Petugas Baru', role: 'petugas' },
        after: changed,
      });
    });
  });

  it('menolak admin mengubah perannya sendiri, tetapi mengizinkan mengubah namanya', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);

      expect(await updateUser(actor.id, { fullName: 'UJI Nama Admin', role: 'petugas' }, actor, tx)).toEqual({
        ok: false,
        field: 'role',
        message: 'Anda tidak dapat mengubah peran akun Anda sendiri. Minta admin lain melakukannya bila perlu.',
      });
      expect(await updateUser(actor.id, { fullName: 'UJI Nama Admin', role: 'admin' }, actor, tx)).toEqual({
        ok: true, id: actor.id,
      });
    });
  });

  it('melaporkan pengguna yang tidak ada', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      expect(await updateUser(crypto.randomUUID(), { fullName: 'UJI', role: 'petugas' }, actor, tx)).toEqual({
        ok: false, message: 'Pengguna tidak ditemukan. Muat ulang halaman daftar pengguna.',
      });
    });
  });
});

describe('setUserStatus', () => {
  it('menonaktifkan pengguna lain dan mencatat audit', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const created = await createUser(input, actor, fakeAuthAdmin(tx), tx);
      if (!created.ok) throw new Error(created.message);

      expect(await setUserStatus(created.id, 'inactive', actor, tx)).toEqual({ ok: true, id: created.id });

      expect((await getUser(created.id, tx))?.status).toBe('inactive');
      const [audit] = await auditOf(tx, created.id, 'user.deactivate');
      expect(audit?.metadata).toEqual({ username: 'uji_petugas' });
    });
  });

  it('menolak admin menonaktifkan akunnya sendiri', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);

      expect(await setUserStatus(actor.id, 'inactive', actor, tx)).toEqual({
        ok: false,
        message: 'Anda tidak dapat menonaktifkan akun Anda sendiri. Minta admin lain melakukannya bila perlu.',
      });
      expect((await getUser(actor.id, tx))?.status).toBe('active');
    });
  });
});

describe('resetUserPassword', () => {
  it('mengganti kata sandi di layanan autentikasi dan mencatat audit tanpa kata sandinya', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const auth = fakeAuthAdmin(tx);
      const created = await createUser(input, actor, auth, tx);
      if (!created.ok) throw new Error(created.message);

      const result = await resetUserPassword(
        created.id, { password: 'baru-uji-12', passwordConfirm: 'baru-uji-12' }, actor, auth, tx,
      );

      expect(result).toEqual({ ok: true, id: created.id });
      expect(auth.passwords).toEqual([{ userId: created.id, password: 'baru-uji-12' }]);
      const [audit] = await auditOf(tx, created.id, 'user.reset_password');
      expect(audit?.metadata).toEqual({ username: 'uji_petugas' });
    });
  });

  it('tidak menulis audit bila layanan autentikasi menolak', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      const created = await createUser(input, actor, fakeAuthAdmin(tx), tx);
      if (!created.ok) throw new Error(created.message);
      const failing = fakeAuthAdmin(tx, { passwordError: { code: null, message: 'Service unavailable' } });

      expect(await resetUserPassword(
        created.id, { password: 'baru-uji-12', passwordConfirm: 'baru-uji-12' }, actor, failing, tx,
      )).toEqual({
        ok: false,
        message: 'Kata sandi uji_petugas belum dapat diganti (Service unavailable). Coba lagi beberapa saat lagi.',
      });
      expect(await auditOf(tx, created.id, 'user.reset_password')).toHaveLength(0);
    });
  });
});

describe('listUsers', () => {
  it('mengurutkan berdasarkan username', async () => {
    await withRollback(async (tx) => {
      const actor = await testActor(tx);
      await createUser(input, actor, fakeAuthAdmin(tx), tx);

      const usernames = (await listUsers(tx)).map((user) => user.username);

      expect(usernames).toContain('uji_petugas');
      expect(usernames).toEqual([...usernames].sort());
    });
  });
});
