import type { IsoDate } from '@/domain/shared/date';
import { formatDate, formatRupiah } from './format';
import { parseIsoDate } from './iso-date';
import type { Option } from './options';

/** Map, bukan objek literal: kunci dari database seperti "constructor" tidak boleh cocok dengan properti prototipe. */
const ACTION_LABELS = new Map<string, string>([
  ['loan.create', 'Peminjaman dicatat'],
  ['return.process', 'Pengembalian diproses'],
  ['fine.pay', 'Pembayaran denda'],
  ['book.create', 'Buku ditambahkan'],
  ['book.update', 'Buku diubah'],
  ['book.activate', 'Buku diaktifkan'],
  ['book.deactivate', 'Buku dinonaktifkan'],
  ['copy.create', 'Eksemplar ditambahkan'],
  ['copy.restore', 'Eksemplar dipulihkan'],
  ['copy.deactivate', 'Eksemplar dinonaktifkan'],
  ['copy.reactivate', 'Eksemplar diaktifkan kembali'],
  ['category.create', 'Kategori ditambahkan'],
  ['category.update', 'Kategori diubah'],
  ['category.activate', 'Kategori diaktifkan'],
  ['category.deactivate', 'Kategori dinonaktifkan'],
  ['rack.create', 'Rak ditambahkan'],
  ['rack.update', 'Rak diubah'],
  ['rack.activate', 'Rak diaktifkan'],
  ['rack.deactivate', 'Rak dinonaktifkan'],
  ['student.create', 'Siswa ditambahkan'],
  ['student.update', 'Siswa diubah'],
  ['student.activate', 'Siswa diaktifkan'],
  ['student.deactivate', 'Siswa dinonaktifkan'],
  ['academic_year.create', 'Tahun ajaran ditambahkan'],
  ['academic_year.update', 'Tahun ajaran diubah'],
  ['academic_year.activate', 'Tahun ajaran diaktifkan'],
  ['settings.update', 'Konfigurasi diubah'],
  ['user.create', 'Pengguna ditambahkan'],
  ['user.update', 'Pengguna diubah'],
  ['user.reset_password', 'Password pengguna direset'],
  ['user.activate', 'Pengguna diaktifkan'],
  ['user.deactivate', 'Pengguna dinonaktifkan'],
]);

export function auditActionLabel(action: string): string {
  return ACTION_LABELS.get(action) ?? action;
}

export type AuditKind = 'all' | 'transaksi' | 'koleksi' | 'siswa' | 'pengaturan';

export const AUDIT_KIND_ENTITIES: Record<Exclude<AuditKind, 'all'>, string[]> = {
  transaksi: ['loans'],
  koleksi: ['books', 'book_copies', 'categories', 'racks'],
  siswa: ['students'],
  pengaturan: ['academic_years', 'library_settings', 'profiles'],
};

export const AUDIT_KIND_OPTIONS: Option[] = [
  { value: 'all', label: 'Semua jenis data' },
  { value: 'transaksi', label: 'Transaksi' },
  { value: 'koleksi', label: 'Buku, eksemplar, kategori, rak' },
  { value: 'siswa', label: 'Siswa' },
  { value: 'pengaturan', label: 'Pengaturan dan pengguna' },
];

export function parseAuditKind(value: string): AuditKind {
  const match = AUDIT_KIND_OPTIONS.find((option) => option.value === value);
  return match ? (match.value as AuditKind) : 'all';
}

/** '2026-02-30' ditolak: tanggal harus ada di kalender, bukan hanya berpola benar. */
export function parseDateFilter(value: string): IsoDate | null {
  return parseIsoDate(value);
}

const ENTITY_PATHS = new Map<string, string>([
  ['loans', '/transaksi/riwayat/'],
  ['books', '/master/buku/'],
  ['students', '/master/siswa/'],
  ['categories', '/master/kategori/'],
  ['racks', '/master/rak/'],
  ['academic_years', '/pengaturan/tahun-ajaran/'],
  ['profiles', '/pengaturan/pengguna/'],
]);

/** `book_copies` tidak punya halaman sendiri; barcode-nya tampil di ringkasan. */
export function auditEntityHref(entity: string, entityId: string | null): string | null {
  if (entity === 'library_settings') return '/pengaturan/konfigurasi';
  const base = ENTITY_PATHS.get(entity);
  return base && entityId ? `${base}${entityId}` : null;
}

const FIELD_LABELS = new Map<string, string>([
  ['name', 'nama'],
  ['title', 'judul'],
  ['author', 'penulis'],
  ['publisher', 'penerbit'],
  ['publishYear', 'tahun terbit'],
  ['isbn', 'ISBN'],
  ['price', 'harga'],
  ['description', 'deskripsi'],
  ['categoryId', 'kategori'],
  ['rackId', 'rak'],
  ['code', 'kode'],
  ['location', 'lokasi'],
  ['nis', 'NIS'],
  ['className', 'kelas'],
  ['gender', 'jenis kelamin'],
  ['phone', 'telepon'],
  ['fullName', 'nama lengkap'],
  ['role', 'peran'],
  ['status', 'status'],
  ['startDate', 'tanggal mulai'],
  ['endDate', 'tanggal selesai'],
  ['maxActiveLoans', 'batas pinjam'],
  ['loanDurationDays', 'durasi pinjam'],
  ['finePerDay', 'denda per hari'],
  ['blockWhenOverdue', 'blokir keterlambatan'],
  ['blockWhenUnpaidFine', 'blokir tunggakan'],
  ['schoolName', 'nama sekolah'],
  ['receiptFooter', 'catatan kaki struk'],
]);

const SECRET_KEY = /password|secret|token/i;
const REDACTED = '••••';

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function amount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/** Subjek catatan: hal yang paling mungkin dicari admin. Hanya dari kolom yang dikenal. */
function subjectOf(record: Json): string | null {
  const barcodes = strings(record.barcodes);
  const name = text(record.name);
  const nis = text(record.nis);
  return text(record.transactionNumber)
    ?? text(record.barcode)
    ?? (barcodes.length > 1 && !text(record.dueDate) ? `${barcodes[0]} s.d. ${barcodes.at(-1)}` : null)
    ?? (barcodes.length === 1 && !text(record.dueDate) ? barcodes[0] : null)
    ?? text(record.username)
    ?? text(record.title)
    ?? (name && nis ? `${name} (NIS ${nis})` : name)
    ?? (nis ? `NIS ${nis}` : null)
    ?? (text(record.code) ? `Rak ${text(record.code)}` : null);
}

function changedFields(before: Json, after: Json): string[] {
  return Object.keys(after)
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map((key) => FIELD_LABELS.get(key) ?? key);
}

export interface AuditSummary {
  subject: string | null;
  details: string[];
}

/**
 * Ringkasan satu baris audit untuk tabel. Hanya kolom yang dikenal yang
 * dibaca, sehingga kolom rahasia tidak pernah muncul di ringkasan (password
 * memang tidak pernah diaudit; lihat `secretFields` di run-action.ts).
 */
export function summarizeAudit(action: string, metadata: unknown): AuditSummary {
  if (!isRecord(metadata)) return { subject: null, details: [] };

  const details: string[] = [];
  const before = metadata.before;
  const after = metadata.after;
  let subject = subjectOf(metadata);

  if (isRecord(after)) {
    subject = subject ?? subjectOf(after);
    if (isRecord(before)) {
      const changed = changedFields(before, after);
      details.push(changed.length > 0 ? `Diubah: ${changed.join(', ')}` : 'Tidak ada kolom yang berubah');
    }
  }

  const barcodes = strings(metadata.barcodes);
  if (action === 'loan.create' && barcodes.length > 0) details.push(`${barcodes.length} buku: ${barcodes.join(', ')}`);
  if (action === 'copy.create' && barcodes.length > 0) details.push(`${barcodes.length} eksemplar`);
  if (text(metadata.studentNis)) details.push(`NIS ${text(metadata.studentNis)}`);
  if (text(metadata.dueDate)) details.push(`Jatuh tempo ${formatDate(text(metadata.dueDate))}`);

  if (text(metadata.from) && text(metadata.to)) details.push(`${text(metadata.from)} → ${text(metadata.to)}`);

  if (Array.isArray(metadata.items)) {
    const items = metadata.items.filter(isRecord);
    details.push(`${items.length} buku kembali`);
    for (const item of items) {
      const condition = text(item.condition);
      if (condition && condition !== 'BAIK') details.push(`${text(item.barcode) ?? 'Eksemplar'} ${condition.toLowerCase()}`);
    }
  }
  const totalFine = amount(metadata.totalFine);
  if (totalFine !== null && totalFine > 0) details.push(`Total denda transaksi ${formatRupiah(totalFine)}`);

  const paid = amount(metadata.amount);
  if (paid !== null) details.push(`Dibayar ${formatRupiah(paid)}`);
  const remaining = amount(metadata.remaining);
  if (remaining !== null) details.push(remaining > 0 ? `Sisa tagihan ${formatRupiah(remaining)}` : 'Lunas');

  return { subject, details };
}

/** Untuk tampilan "isi lengkap": kolom yang namanya tampak rahasia disamarkan di tingkat mana pun. */
export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, inner]) => [key, SECRET_KEY.test(key) ? REDACTED : redactSecrets(inner)]),
  );
}
