import type { db } from './client';

/** Instance Drizzle utama. */
export type Database = typeof db;

/** Transaksi Drizzle. Bila bersarang, Drizzle menjadikannya savepoint. */
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * Apa pun yang dapat menjalankan kueri. Service dan query menerima tipe ini
 * agar uji integrasi dapat menyuntikkan transaksi yang di-rollback, sementara
 * Server Action cukup memakai nilai bawaan `db`.
 */
export type Executor = Database | Transaction;
