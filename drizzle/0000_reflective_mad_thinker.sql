CREATE TABLE "academic_years" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "academic_years_name_unique" UNIQUE("name"),
	CONSTRAINT "academic_years_range_valid" CHECK ("academic_years"."end_date" > "academic_years"."start_date")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book_copies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"barcode" text NOT NULL,
	"status" text DEFAULT 'TERSEDIA' NOT NULL,
	"acquisition_date" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "book_copies_barcode_unique" UNIQUE("barcode"),
	CONSTRAINT "book_copies_status_valid" CHECK ("book_copies"."status" in ('TERSEDIA','DIPINJAM','RUSAK','HILANG','NONAKTIF'))
);
--> statement-breakpoint
CREATE TABLE "books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"isbn" text,
	"title" text NOT NULL,
	"author" text NOT NULL,
	"publisher" text,
	"publish_year" integer,
	"category_id" uuid,
	"rack_id" uuid,
	"price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"cover_url" text,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "books_status_valid" CHECK ("books"."status" in ('active','inactive'))
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "counters" (
	"scope" text PRIMARY KEY NOT NULL,
	"value" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fine_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"received_by" uuid NOT NULL,
	"note" text,
	CONSTRAINT "fine_payments_amount_positive" CHECK ("fine_payments"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "library_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"max_active_loans" integer DEFAULT 3 NOT NULL,
	"loan_duration_days" integer DEFAULT 3 NOT NULL,
	"fine_per_day" numeric(12, 2) DEFAULT '1000' NOT NULL,
	"block_when_overdue" boolean DEFAULT true NOT NULL,
	"block_when_unpaid_fine" boolean DEFAULT false NOT NULL,
	"school_name" text,
	"school_logo_url" text,
	"receipt_footer" text,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "library_settings_single_row" CHECK ("library_settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "loan_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"book_copy_id" uuid NOT NULL,
	"returned_at" timestamp with time zone,
	"return_condition" text,
	"days_late" integer DEFAULT 0 NOT NULL,
	"late_fine" numeric(12, 2) DEFAULT '0' NOT NULL,
	"replacement_fee" numeric(12, 2) DEFAULT '0' NOT NULL,
	"condition_note" text,
	"returned_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loan_items_condition_valid" CHECK ("loan_items"."return_condition" is null or "loan_items"."return_condition" in ('BAIK','RUSAK','HILANG'))
);
--> statement-breakpoint
CREATE TABLE "loans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_number" text NOT NULL,
	"student_id" uuid NOT NULL,
	"student_class" text NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"loan_date" date NOT NULL,
	"due_date" date NOT NULL,
	"status" text DEFAULT 'AKTIF' NOT NULL,
	"total_fine" numeric(12, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loans_transaction_number_unique" UNIQUE("transaction_number"),
	CONSTRAINT "loans_status_valid" CHECK ("loans"."status" in ('AKTIF','SEBAGIAN_KEMBALI','SELESAI'))
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"full_name" text NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_username_unique" UNIQUE("username"),
	CONSTRAINT "profiles_role_valid" CHECK ("profiles"."role" in ('admin','petugas')),
	CONSTRAINT "profiles_status_valid" CHECK ("profiles"."status" in ('active','inactive'))
);
--> statement-breakpoint
CREATE TABLE "racks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"location" text,
	"status" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "racks_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nis" text NOT NULL,
	"name" text NOT NULL,
	"class_name" text NOT NULL,
	"major" text,
	"gender" text,
	"phone" text,
	"academic_year_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "students_nis_unique" UNIQUE("nis"),
	CONSTRAINT "students_gender_valid" CHECK ("students"."gender" is null or "students"."gender" in ('L','P')),
	CONSTRAINT "students_status_valid" CHECK ("students"."status" in ('active','inactive'))
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_copies" ADD CONSTRAINT "book_copies_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_rack_id_racks_id_fk" FOREIGN KEY ("rack_id") REFERENCES "public"."racks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fine_payments" ADD CONSTRAINT "fine_payments_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fine_payments" ADD CONSTRAINT "fine_payments_received_by_profiles_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_settings" ADD CONSTRAINT "library_settings_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_items" ADD CONSTRAINT "loan_items_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_items" ADD CONSTRAINT "loan_items_book_copy_id_book_copies_id_fk" FOREIGN KEY ("book_copy_id") REFERENCES "public"."book_copies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_items" ADD CONSTRAINT "loan_items_returned_by_profiles_id_fk" FOREIGN KEY ("returned_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "one_active_academic_year" ON "academic_years" USING btree ("is_active") WHERE "academic_years"."is_active";--> statement-breakpoint
CREATE INDEX "audit_logs_entity" ON "audit_logs" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "book_copies_status" ON "book_copies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "book_copies_book" ON "book_copies" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "fine_payments_loan" ON "fine_payments" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "loan_items_loan" ON "loan_items" USING btree ("loan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "one_open_loan_per_copy" ON "loan_items" USING btree ("book_copy_id") WHERE "loan_items"."returned_at" is null;--> statement-breakpoint
CREATE INDEX "loans_student" ON "loans" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "loans_open_due" ON "loans" USING btree ("due_date") WHERE "loans"."status" <> 'SELESAI';