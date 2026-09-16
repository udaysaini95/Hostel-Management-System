CREATE TYPE "public"."student_housing_type" AS ENUM('boys', 'girls');--> statement-breakpoint
ALTER TABLE "approved_students" ADD COLUMN "housing_type" "student_housing_type";--> statement-breakpoint
ALTER TABLE "student_profiles" ADD COLUMN "housing_type" "student_housing_type";
