import { Notice } from './notice';

/** Pesan sukses yang dibawa `?pesan=` setelah form berpindah halaman. */
export function Flash({ message }: { message: string }) {
  if (!message) return null;
  return <Notice tone="success" role="status" className="mb-4">{message}</Notice>;
}
