import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // Nilai sementara; Task 9 menggantinya dengan sesi dan tahun ajaran sungguhan.
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar academicYear="2026/2027" userName="Petugas" />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
