import { describe, expect, it } from 'vitest';
import { usernameToEmail } from './username';

describe('usernameToEmail', () => {
  it('menambahkan domain internal pada username', () => {
    expect(usernameToEmail('budi')).toBe('budi@perpus.local');
  });

  it('menormalkan huruf besar', () => {
    expect(usernameToEmail('Budi')).toBe('budi@perpus.local');
  });

  it('membuang spasi di ujung', () => {
    expect(usernameToEmail('  budi  ')).toBe('budi@perpus.local');
  });

  it('menolak username kosong', () => {
    expect(() => usernameToEmail('   ')).toThrow('Username wajib diisi');
  });

  it('menolak karakter di luar huruf, angka, titik, dan garis bawah', () => {
    expect(() => usernameToEmail('budi santoso')).toThrow('Username hanya boleh');
    expect(() => usernameToEmail('budi@sekolah.id')).toThrow('Username hanya boleh');
  });
});
