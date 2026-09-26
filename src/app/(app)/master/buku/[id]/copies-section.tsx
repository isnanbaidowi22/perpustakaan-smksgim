import { ActionButton } from '@/components/ui/action-button';
import { ActionForm } from '@/components/ui/action-form';
import { TextAreaField, TextField } from '@/components/ui/fields';
import { StatusBadge } from '@/components/ui/status-badge';
import { ScrollTable } from '@/components/ui/scroll-table';
import { TD, TH } from '@/components/ui/table-styles';
import { availableManualActions, MANUAL_ACTION_LABELS } from '@/domain/copy/manual-status';
import { formatDate } from '@/lib/format';
import { addCopiesAction, changeCopyStatusAction } from '@/server/actions/copies';
import type { CopyRow } from '@/server/queries/copies';

export function CopiesSection({
  bookId,
  bookActive,
  copies,
}: {
  bookId: string;
  bookActive: boolean;
  copies: CopyRow[];
}) {
  const available = copies.filter((copy) => copy.status === 'TERSEDIA').length;

  return (
    <section aria-labelledby="eksemplar" className="mt-10 space-y-4">
      <div>
        <h2 id="eksemplar" className="text-xl font-semibold">Eksemplar</h2>
        <p className="text-sm text-[var(--color-ink-500)]">
          {available} dari {copies.length} eksemplar tersedia untuk dipinjam.
        </p>
      </div>

      <ScrollTable>
        <thead>
          <tr>
            <th className={TH}>Barcode</th>
            <th className={TH}>Status</th>
            <th className={TH}>Tanggal Pengadaan</th>
            <th className={TH}>Catatan</th>
            <th className={TH}><span className="sr-only">Aksi</span></th>
          </tr>
        </thead>
        <tbody>
          {copies.length === 0 && (
            <tr>
              <td colSpan={5} className={`${TD} text-center text-[var(--color-ink-500)]`}>
                Belum ada eksemplar. Buku ini baru dapat dipinjam setelah eksemplarnya ditambahkan.
              </td>
            </tr>
          )}
          {copies.map((copy) => (
            <tr key={copy.id}>
              <td className={`${TD} font-mono`}>{copy.barcode}</td>
              <td className={TD}><StatusBadge status={copy.status} /></td>
              <td className={TD}>{formatDate(copy.acquisitionDate)}</td>
              <td className={TD}>{copy.notes ?? '—'}</td>
              <td className={TD}>
                <div className="flex items-start justify-end gap-2">
                  {availableManualActions(copy.status).map((action) => (
                    <ActionButton
                      key={action}
                      action={changeCopyStatusAction.bind(null, bookId, copy.id, action)}
                      label={MANUAL_ACTION_LABELS[action]}
                      confirmText={`${MANUAL_ACTION_LABELS[action]}: eksemplar ${copy.barcode}?`}
                      variant={action === 'DEACTIVATE' ? 'danger' : 'secondary'}
                    />
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </ScrollTable>

      {bookActive ? (
        <ActionForm action={addCopiesAction.bind(null, bookId)} submitLabel="Tambah Eksemplar">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              name="count"
              label="Jumlah eksemplar"
              type="number"
              inputMode="numeric"
              defaultValue="1"
              hint="1–50. Barcode dibuat otomatis dan berurutan, misalnya BK-000123."
            />
            <TextField
              name="barcode"
              label="Barcode manual (opsional)"
              maxLength={30}
              hint="Hanya untuk buku yang sudah berlabel dari sistem lama. Jumlah harus 1."
            />
          </div>
          <TextField name="acquisitionDate" label="Tanggal pengadaan" type="date" />
          <TextAreaField name="notes" label="Catatan" rows={2} />
        </ActionForm>
      ) : (
        <p className="rounded-md bg-[var(--color-ink-100)] px-3 py-2 text-sm text-[var(--color-ink-700)]">
          Buku ini nonaktif. Aktifkan bukunya dari daftar buku untuk menambah eksemplar.
        </p>
      )}
    </section>
  );
}
