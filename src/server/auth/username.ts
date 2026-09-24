const VALID_USERNAME = /^[a-z0-9._]+$/;

/**
 * Supabase Auth bekerja dengan surel, sementara petugas memakai username.
 * Pemetaan ini tidak pernah terlihat pengguna, dan domainnya sengaja
 * tidak dapat dirutekan agar tidak pernah menerima surel sungguhan.
 */
export function usernameToEmail(username: string): string {
  const normalized = username.trim().toLowerCase();

  if (normalized.length === 0) {
    throw new Error('Username wajib diisi.');
  }
  if (!VALID_USERNAME.test(normalized)) {
    throw new Error('Username hanya boleh berisi huruf, angka, titik, dan garis bawah.');
  }

  const domain = process.env.INTERNAL_EMAIL_DOMAIN ?? 'perpus.local';
  return `${normalized}@${domain}`;
}
