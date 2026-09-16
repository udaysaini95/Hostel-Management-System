CREATE TYPE "public"."hostel_resident_type" AS ENUM('boys', 'girls', 'co_ed');--> statement-breakpoint
ALTER TABLE "hostels" ADD COLUMN "resident_type" "hostel_resident_type" DEFAULT 'co_ed' NOT NULL;
