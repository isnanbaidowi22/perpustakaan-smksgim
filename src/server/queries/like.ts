/**
 * Pola ILIKE "mengandung" untuk kata kunci pengguna. Karakter %, _, dan \
 * di-escape agar diperlakukan harfiah: mencari "50%" tidak boleh
 * mencocokkan seluruh baris. Backslash adalah karakter escape bawaan ILIKE.
 */
export function containsPattern(keyword: string): string {
  return `%${keyword.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}
