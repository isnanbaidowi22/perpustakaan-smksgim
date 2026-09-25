import { z } from 'zod';
import type { RecordStatus } from '@/domain/shared/types';

/** Teks wajib. Spasi di ujung dibuang sebelum diperiksa. */
export function requiredText(message: string, max = 200) {
  return z
    .string({ error: message })
    .trim()
    .min(1, message)
    .max(max, `Maksimal ${max} karakter.`);
}

/** Teks opsional. Isian kosong disimpan sebagai null, bukan ''. */
export function optionalText(max = 500) {
  return z
    .string()
    .optional()
    .transform((value) => (value ?? '').trim())
    .pipe(z.string().max(max, `Maksimal ${max} karakter.`))
    .transform((value) => (value === '' ? null : value));
}

/** Pilihan opsional dari `<select>`. Opsi kosong berarti null. */
export function optionalUuid(message: string) {
  return z
    .string()
    .optional()
    .transform((value) => (value ?? '').trim() || null)
    .pipe(z.uuid(message).nullable());
}

/** Bilangan bulat opsional dalam rentang tertutup. Isian kosong berarti null. */
export function optionalInteger(message: string, min: number, max: number) {
  return z
    .string()
    .optional()
    .transform((value) => {
      const trimmed = (value ?? '').trim();
      return trimmed === '' ? null : Number(trimmed);
    })
    .pipe(z.number({ error: message }).int(message).min(min, message).max(max, message).nullable());
}

/** Bilangan bulat wajib dalam rentang tertutup, dengan satu pesan untuk semua kesalahan. */
export function requiredInteger(message: string, min: number, max: number) {
  return z
    .string({ error: message })
    .trim()
    .min(1, message)
    .transform(Number)
    .pipe(z.number({ error: message }).int(message).min(min, message).max(max, message));
}

/** Tanggal dari `<input type="date">`, yang selalu mengirim 'YYYY-MM-DD'. */
export function isoDate(message: string) {
  return z.string({ error: message }).trim().pipe(z.iso.date({ error: message }));
}

/**
 * Nilai `CheckboxField`. Kolom tersembunyinya mengirim 'off' dan kotaknya
 * mengirim 'on' bila dicentang; `formToObject` menyimpan nilai terakhir.
 * Isian yang tidak dikirim sama sekali berarti tidak dicentang.
 */
export function checkbox() {
  return z.string().optional().transform((value) => value === 'on');
}

/**
 * Nominal rupiah tanpa desimal. Titik pemisah ribuan diterima karena
 * petugas terbiasa mengetik "85.000". Isian kosong berarti 0.
 */
export function rupiah(message: string) {
  return z
    .string()
    .optional()
    .transform((value) => {
      const digits = (value ?? '').replace(/[.\s]/g, '');
      return digits === '' ? 0 : Number(digits);
    })
    .pipe(z.number({ error: message }).int(message).min(0, message).max(9_999_999_999, message));
}

const uuidSchema = z.uuid();

/**
 * Id yang datang dari URL atau argumen Server Action dapat diubah siapa saja.
 * Memeriksanya lebih dulu mencegah Postgres melempar galat sintaks UUID.
 */
export function isUuid(value: unknown): value is string {
  return uuidSchema.safeParse(value).success;
}

export function isRecordStatus(value: unknown): value is RecordStatus {
  return value === 'active' || value === 'inactive';
}
