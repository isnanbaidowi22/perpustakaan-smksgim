export function Topbar({
  academicYear,
  userName,
}: {
  academicYear: string | null;
  userName: string;
}) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-[var(--color-ink-100)] bg-white px-6">
      {/* Tahun ajaran selalu terlihat: petugas harus tahu ke tahun mana
          transaksinya masuk, tanpa perlu membuka halaman lain. */}
      {academicYear ? (
        <span className="text-sm text-[var(--color-ink-700)]">
          Tahun Ajaran <strong className="font-semibold">{academicYear}</strong>
        </span>
      ) : (
        <span className="text-sm font-medium text-[var(--color-status-terlambat)]">
          Belum ada tahun ajaran aktif — transaksi tidak dapat dibuat
        </span>
      )}
      <span className="text-sm text-[var(--color-ink-700)]">{userName}</span>
    </header>
  );
}
