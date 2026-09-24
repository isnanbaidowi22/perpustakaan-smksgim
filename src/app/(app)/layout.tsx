import { eq } from 'drizzle-orm';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { requireProfile } from '@/server/auth/guard';
import { db, schema } from '@/server/db/client';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();

  const [year] = await db
    .select({ name: schema.academicYears.name })
    .from(schema.academicYears)
    .where(eq(schema.academicYears.isActive, true))
    .limit(1);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar academicYear={year?.name ?? null} userName={profile.fullName} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
