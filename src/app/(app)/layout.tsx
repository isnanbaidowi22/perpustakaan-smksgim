import { eq } from 'drizzle-orm';
import { AppShell } from '@/components/layout/app-shell';
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
    <AppShell
      sidebar={<Sidebar role={profile.role} />}
      topbar={<Topbar academicYear={year?.name ?? null} userName={profile.fullName} />}
    >
      {children}
    </AppShell>
  );
}
