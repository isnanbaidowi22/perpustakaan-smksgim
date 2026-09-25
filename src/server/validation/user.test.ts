import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { newUserSchema, passwordSchema, userSchema } from './user';

const valid = {
  username: ' Siti.Aminah ',
  fullName: 'Siti Aminah',
  role: 'petugas',
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
      role: 'petugas',
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

  it('menolak username terlalu pendek dan peran yang tidak dikenal', () => {
    expect(messagesOf(newUserSchema.safeParse({ ...valid, username: 'ab', role: 'kepala' }))).toEqual([
      'Username minimal 3 karakter.',
      'Peran harus admin atau petugas.',
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
  it('hanya menerima nama lengkap dan peran', () => {
    expect(userSchema.parse({ fullName: ' Siti Aminah ', role: 'admin', username: 'lain' })).toEqual({
      fullName: 'Siti Aminah',
      role: 'admin',
    });
  });
});

describe('passwordSchema', () => {
  it('menandai kolom pengulangan bila berbeda', () => {
    const result = passwordSchema.safeParse({ password: 'rahasia123', passwordConfirm: 'rahasia12' });
    expect(result.error?.issues[0]?.path).toEqual(['passwordConfirm']);
  });
});
