import { requireProfile } from '@/server/auth/guard';

export default async function DashboardPage() {
  await requireProfile();
  return <h1 className="page-title text-2xl font-semibold">Dashboard</h1>;
}
