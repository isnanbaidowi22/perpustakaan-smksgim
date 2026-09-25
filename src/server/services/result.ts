/**
 * Hasil setiap service penulis data. Kegagalan yang dapat diperbaiki petugas
 * (nama ganda, data tidak ditemukan) dikembalikan sebagai nilai berisi pesan
 * siap tampil. Galat tak terduga tetap dilempar.
 */
export type ServiceResult =
  | { ok: true; id: string; notice?: string }
  | { ok: false; message: string; field?: string };

/** `notice` adalah catatan tambahan yang ditampilkan bersama pesan sukses. */
export function ok(id: string, notice?: string): ServiceResult {
  return notice ? { ok: true, id, notice } : { ok: true, id };
}

/** `field` adalah nama kolom form yang menyebabkan kegagalan, bila ada. */
export function fail(message: string, field?: string): ServiceResult {
  return field ? { ok: false, message, field } : { ok: false, message };
}
