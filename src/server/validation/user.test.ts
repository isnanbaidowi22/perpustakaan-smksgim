import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { newUserSchema, passwordSchema, userSchema } from './user';

const valid = {
  username: ' Siti.Aminah ',
  fullName: 'Siti Aminah',
  password: 'rahasia123',
  passwordConfirm: 'rahasia123',
};

function messagesOf(result: z.ZodSafeParseResult<unknown>): string[] {
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe('newUserSchema', () => {
  it('menormalkan username ke huruf kecil tanpa mengubah kata sandi', () => {
    expect(newUserSchema.parse({ ...valid, password: ' Rahasia123 ', passwordConfirm: ' Rahasia123 ' })).toEqual({
      username: 'siti.aminah',
      fullName: 'Siti Aminah',
      password: ' Rahasia123 ',
      passwordConfirm: ' Rahasia123 ',
    });
  });

  it('menolak username berspasi atau bertanda hubung dengan contoh yang benar', () => {
    for (const username of ['siti aminah', 'siti-aminah']) {
      expect(messagesOf(newUserSchema.safeParse({ ...valid, username }))).toEqual([
        'Username hanya boleh berisi huruf kecil, angka, titik, dan garis bawah, misalnya siti.aminah.',
      ]);
    }
  });

  it('menolak username yang berawal, berakhir, atau berisi titik berurutan', () => {
    for (const username of ['...', 'siti.', '.siti', 'a..b', '_siti']) {
      expect(messagesOf(newUserSchema.safeParse({ ...valid, username }))).toEqual([
        'Username harus diawali dan diakhiri huruf atau angka, tanpa titik berurutan, misalnya siti.aminah.',
      ]);
    }
  });

  it('menerima username yang berawal dan berakhir huruf atau angka tanpa titik berurutan', () => {
    for (const username of ['siti.aminah', 'uji_petugas', 'budi2']) {
      expect(newUserSchema.safeParse({ ...valid, username }).success).toBe(true);
    }
  });

  it('menolak username terlalu pendek', () => {
    expect(messagesOf(newUserSchema.safeParse({ ...valid, username: 'ab' }))).toEqual([
      'Username minimal 3 karakter.',
    ]);
  });

  it('menolak kata sandi pendek dan pengulangan yang berbeda', () => {
    expect(messagesOf(newUserSchema.safeParse({ ...valid, password: 'pendek', passwordConfirm: 'pendek' }))).toEqual([
      'Kata sandi minimal 8 karakter.',
    ]);
    expect(messagesOf(newUserSchema.safeParse({ ...valid, passwordConfirm: 'rahasia124' }))).toEqual([
      'Ulangi kata sandi yang sama persis.',
    ]);
  });
});

describe('userSchema', () => {
  it('hanya menerima nama lengkap; kolom peran dari form lama diabaikan', () => {
    expect(userSchema.parse({ fullName: '  Siti Aminah ', role: 'petugas' })).toEqual({ fullName: 'Siti Aminah' });
  });

  it('akun baru tidak membawa kolom peran walau form lama mengirimnya', () => {
    const parsed = newUserSchema.parse({
      username: 'siti.aminah', fullName: 'Siti Aminah', role: 'petugas', password: 'rahasia123', passwordConfirm: 'rahasia123',
    });
    expect(parsed).not.toHaveProperty('role');
  });
});

describe('passwordSchema', () => {
  it('menandai kolom pengulangan bila berbeda', () => {
    const result = passwordSchema.safeParse({ password: 'rahasia123', passwordConfirm: 'rahasia12' });
    expect(result.error?.issues[0]?.path).toEqual(['passwordConfirm']);
  });
});
