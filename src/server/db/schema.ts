import { sql } from 'drizzle-orm';
import {
  bigint, boolean, check, date, index, integer, jsonb,
  numeric, pgTable, text, timestamp, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core';
import type {
  CopyStatus, LoanStatus, RecordStatus, ReturnCondition, UserRole,
} from '@/domain/shared/types';

const stamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const profiles = pgTable('profiles', {
  // Foreign key ke auth.users ditambahkan migrasi kustom di Step 6;
  // Drizzle tidak memodelkan skema auth milik Supabase.
  id: uuid('id').primaryKey(),
  username: text('username').notNull().unique(),
  fullName: text('full_name').notNull(),
  role: text('role').$type<UserRole>().notNull().default('admin'),
  status: text('status').$type<RecordStatus>().notNull().default('active'),
  ...stamps,
}, (t) => [
  check('profiles_role_valid', sql`${t.role} = 'admin'`),
  check('profiles_status_valid', sql`${t.status} in ('active','inactive')`),
]);

export const academicYears = pgTable('academic_years', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  isActive: boolean('is_active').notNull().default(false),
  createdAt: stamps.createdAt,
}, (t) => [
  check('academic_years_range_valid', sql`${t.endDate} > ${t.startDate}`),
  // Tepat satu tahun ajaran aktif, ditegakkan database.
  uniqueIndex('one_active_academic_year').on(t.isActive).where(sql`${t.isActive}`),
]);

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  status: text('status').$type<RecordStatus>().notNull().default('active'),
});

export const racks = pgTable('racks', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  location: text('location'),
  status: text('status').$type<RecordStatus>().notNull().default('active'),
});

export const books = pgTable('books', {
  id: uuid('id').primaryKey().defaultRandom(),
  isbn: text('isbn'),
  title: text('title').notNull(),
  author: text('author').notNull(),
  publisher: text('publisher'),
  publishYear: integer('publish_year'),
  categoryId: uuid('category_id').references(() => categories.id),
  rackId: uuid('rack_id').references(() => racks.id),
  /** Dasar biaya ganti saat eksemplar rusak atau hilang. */
  price: numeric('price', { precision: 12, scale: 2 }).notNull().default('0'),
  coverUrl: text('cover_url'),
  description: text('description'),
  status: text('status').$type<RecordStatus>().notNull().default('active'),
  ...stamps,
}, (t) => [
  check('books_status_valid', sql`${t.status} in ('active','inactive')`),
]);

export const bookCopies = pgTable('book_copies', {
  id: uuid('id').primaryKey().defaultRandom(),
  bookId: uuid('book_id').notNull().references(() => books.id, { onDelete: 'restrict' }),
  barcode: text('barcode').notNull().unique(),
  status: text('status').$type<CopyStatus>().notNull().default('TERSEDIA'),
  acquisitionDate: date('acquisition_date'),
  notes: text('notes'),
  ...stamps,
}, (t) => [
  check('book_copies_status_valid',
    sql`${t.status} in ('TERSEDIA','DIPINJAM','RUSAK','HILANG','NONAKTIF')`),
  index('book_copies_status').on(t.status),
  index('book_copies_book').on(t.bookId),
]);

export const students = pgTable('students', {
  id: uuid('id').primaryKey().defaultRandom(),
  nis: text('nis').notNull().unique(),
  name: text('name').notNull(),
  className: text('class_name').notNull(),
  major: text('major'),
  gender: text('gender').$type<'L' | 'P'>(),
  phone: text('phone'),
  academicYearId: uuid('academic_year_id').references(() => academicYears.id),
  status: text('status').$type<RecordStatus>().notNull().default('active'),
  ...stamps,
}, (t) => [
  check('students_gender_valid', sql`${t.gender} is null or ${t.gender} in ('L','P')`),
  check('students_status_valid', sql`${t.status} in ('active','inactive')`),
]);

export const loans = pgTable('loans', {
  id: uuid('id').primaryKey().defaultRandom(),
  transactionNumber: text('transaction_number').notNull().unique(),
  studentId: uuid('student_id').notNull().references(() => students.id, { onDelete: 'restrict' }),
  /** Snapshot kelas siswa saat meminjam; kelas berubah tiap tahun ajaran. */
  studentClass: text('student_class').notNull(),
  academicYearId: uuid('academic_year_id').notNull().references(() => academicYears.id),
  loanDate: date('loan_date').notNull(),
  dueDate: date('due_date').notNull(),
  status: text('status').$type<LoanStatus>().notNull().default('AKTIF'),
  totalFine: numeric('total_fine', { precision: 12, scale: 2 }).notNull().default('0'),
  notes: text('notes'),
  createdBy: uuid('created_by').notNull().references(() => profiles.id),
  ...stamps,
}, (t) => [
  check('loans_status_valid', sql`${t.status} in ('AKTIF','SEBAGIAN_KEMBALI','SELESAI')`),
  index('loans_student').on(t.studentId),
  index('loans_open_due').on(t.dueDate).where(sql`${t.status} <> 'SELESAI'`),
]);

export const loanItems = pgTable('loan_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  loanId: uuid('loan_id').notNull().references(() => loans.id, { onDelete: 'restrict' }),
  bookCopyId: uuid('book_copy_id').notNull().references(() => bookCopies.id, { onDelete: 'restrict' }),
  returnedAt: timestamp('returned_at', { withTimezone: true }),
  returnCondition: text('return_condition').$type<ReturnCondition>(),
  daysLate: integer('days_late').notNull().default(0),
  lateFine: numeric('late_fine', { precision: 12, scale: 2 }).notNull().default('0'),
  replacementFee: numeric('replacement_fee', { precision: 12, scale: 2 }).notNull().default('0'),
  conditionNote: text('condition_note'),
  returnedBy: uuid('returned_by').references(() => profiles.id),
  createdAt: stamps.createdAt,
}, (t) => [
  check('loan_items_condition_valid',
    sql`${t.returnCondition} is null or ${t.returnCondition} in ('BAIK','RUSAK','HILANG')`),
  index('loan_items_loan').on(t.loanId),
  // Jaring pengaman tingkat database: satu eksemplar hanya boleh berada
  // dalam satu peminjaman terbuka, bahkan bila logika aplikasi cacat.
  uniqueIndex('one_open_loan_per_copy').on(t.bookCopyId).where(sql`${t.returnedAt} is null`),
]);

export const finePayments = pgTable('fine_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  loanId: uuid('loan_id').notNull().references(() => loans.id, { onDelete: 'restrict' }),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  paidAt: timestamp('paid_at', { withTimezone: true }).notNull().defaultNow(),
  receivedBy: uuid('received_by').notNull().references(() => profiles.id),
  note: text('note'),
}, (t) => [
  check('fine_payments_amount_positive', sql`${t.amount} > 0`),
  index('fine_payments_loan').on(t.loanId),
]);

export const librarySettings = pgTable('library_settings', {
  id: integer('id').primaryKey().default(1),
  maxActiveLoans: integer('max_active_loans').notNull().default(3),
  loanDurationDays: integer('loan_duration_days').notNull().default(3),
  finePerDay: numeric('fine_per_day', { precision: 12, scale: 2 }).notNull().default('1000'),
  blockWhenOverdue: boolean('block_when_overdue').notNull().default(true),
  blockWhenUnpaidFine: boolean('block_when_unpaid_fine').notNull().default(false),
  schoolName: text('school_name'),
  schoolLogoUrl: text('school_logo_url'),
  receiptFooter: text('receipt_footer'),
  updatedBy: uuid('updated_by').references(() => profiles.id),
  updatedAt: stamps.updatedAt,
}, (t) => [
  check('library_settings_single_row', sql`${t.id} = 1`),
]);

export const counters = pgTable('counters', {
  scope: text('scope').primaryKey(),
  value: bigint('value', { mode: 'number' }).notNull().default(0),
});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => profiles.id),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: uuid('entity_id'),
  metadata: jsonb('metadata'),
  createdAt: stamps.createdAt,
}, (t) => [
  index('audit_logs_entity').on(t.entity, t.entityId),
]);
