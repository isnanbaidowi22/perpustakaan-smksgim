import { TextField } from '@/components/ui/fields';
import type { Rack } from '@/server/queries/racks';

/** Kolom form rak, dipakai bersama halaman tambah dan ubah. */
export function RackFields({ rack }: { rack?: Rack }) {
  return (
    <>
      <TextField
        name="code"
        label="Kode rak"
        defaultValue={rack?.code}
        required
        autoFocus={!rack}
        maxLength={20}
        hint="Huruf, angka, dan tanda hubung, misalnya A-3. Dicetak pada label buku."
      />
      <TextField name="name" label="Nama rak" defaultValue={rack?.name} required maxLength={100} />
      <TextField name="location" label="Lokasi" defaultValue={rack?.location ?? ''} maxLength={100} />
    </>
  );
}
