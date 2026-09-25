/** Pesan sukses yang dibawa `?pesan=` setelah form berpindah halaman. */
export function Flash({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p
      role="status"
      className="mb-4 rounded-md bg-[var(--color-status-tersedia)]/10 px-3 py-2 text-sm text-[var(--color-status-tersedia)]"
    >
      {message}
    </p>
  );
}
