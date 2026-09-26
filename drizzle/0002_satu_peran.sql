-- Revisi satu peran (26 September 2026): akun petugas yang ada menjadi admin
-- SEBELUM constraint baru dipasang, agar migrasi tidak gagal pada data lama.
UPDATE "profiles" SET "role" = 'admin' WHERE "role" <> 'admin';--> statement-breakpoint
ALTER TABLE "profiles" DROP CONSTRAINT "profiles_role_valid";--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_role_valid" CHECK ("profiles"."role" = 'admin');--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "role" SET DEFAULT 'admin';