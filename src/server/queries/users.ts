import { asc, eq } from 'drizzle-orm';
import type { RecordStatus, UserRole } from '@/domain/shared/types';
import { db } from '@/server/db/client';
import type { Executor } from '@/server/db/executor';
import { profiles } from '@/server/db/schema';
import { isUuid } from '@/server/validation/common';

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  status: RecordStatus;
}

const userColumns = {
  id: profiles.id,
  username: profiles.username,
  fullName: profiles.fullName,
  role: profiles.role,
  status: profiles.status,
};

/** Staf perpustakaan hanya segelintir, jadi tanpa paginasi dan filter. */
export async function listUsers(executor: Executor = db): Promise<User[]> {
  return executor.select(userColumns).from(profiles).orderBy(asc(profiles.username));
}

export async function getUser(id: string, executor: Executor = db): Promise<User | null> {
  if (!isUuid(id)) return null;
  const [user] = await executor.select(userColumns).from(profiles).where(eq(profiles.id, id)).limit(1);
  return user ?? null;
}
