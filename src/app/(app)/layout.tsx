import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { AppShell } from '@/components/layout/app-shell';
import { Sidebar } from '@/components/layout/sidebar';
import { SIDEBAR_COOKIE, SIDEBAR_RAIL } from '@/components/layout/sidebar-state';
import { Topbar } from '@/components/layout/topbar';
import { requireProfile } from '@/server/auth/guard';
import { db, schema } from '@/server/db/client';
import { getLibrarySettings } from '@/server/queries/settings';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();

  const [[year], settings, cookieStore] = await Promise.all([
    db
      .select({ name: schema.academicYears.name })
      .from(schema.academicYears)
      .where(eq(schema.academicYears.isActive, true))
      .limit(1),
    getLibrarySettings(),
    cookies(),
  ]);

  return (
    <AppShell
      sidebar={(
        <Sidebar
          schoolName={settings.schoolName}
          defaultRail={cookieStore.get(SIDEBAR_COOKIE)?.value === SIDEBAR_RAIL}
        />
      )}
      topbar={<Topbar academicYear={year?.name ?? null} userName={profile.fullName} />}
    >
      {children}
    </AppShell>
  );
}
