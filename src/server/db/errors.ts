interface PostgresErrorLike {
  code?: unknown;
  constraint_name?: unknown;
  cause?: unknown;
}

/**
 * Drizzle membungkus galat Postgres di dalam `DrizzleQueryError.cause`,
 * sedangkan galat dari klien `postgres` langsung tidak dibungkus.
 * Fungsi ini menelusuri rantai `cause` sampai menemukan kode SQLSTATE.
 */
function postgresError(error: unknown): PostgresErrorLike | null {
  if (typeof error !== 'object' || error === null) return null;
  const candidate = error as PostgresErrorLike;
  if (typeof candidate.code === 'string') return candidate;
  return postgresError(candidate.cause);
}

/** Nama constraint unik yang dilanggar, atau null bila galatnya bukan pelanggaran unik. */
export function uniqueViolation(error: unknown): string | null {
  const pg = postgresError(error);
  if (pg?.code !== '23505') return null;
  return typeof pg.constraint_name === 'string' ? pg.constraint_name : null;
}
