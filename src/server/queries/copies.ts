import { asc, eq } from 'drizzle-orm';
import type { CopyStatus } from '@/domain/shared/types';
import { db } from '@/server/db/client';
import type { Executor } from '@/server/db/executor';
import { bookCopies } from '@/server/db/schema';
import { isUuid } from '@/server/validation/common';

export interface CopyRow {
  id: string;
  barcode: string;
  status: CopyStatus;
  acquisitionDate: string | null;
  notes: string | null;
}

export async function listCopiesOfBook(bookId: string, executor: Executor = db): Promise<CopyRow[]> {
  if (!isUuid(bookId)) return [];
  return executor
    .select({
      id: bookCopies.id,
      barcode: bookCopies.barcode,
      status: bookCopies.status,
      acquisitionDate: bookCopies.acquisitionDate,
      notes: bookCopies.notes,
    })
    .from(bookCopies)
    .where(eq(bookCopies.bookId, bookId))
    .orderBy(asc(bookCopies.barcode));
}
