CREATE TABLE "hostel_blocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"hostel_id" integer NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hostel_blocks_code_format_check" CHECK ("hostel_blocks"."code" ~ '^[A-Z][A-Z0-9-]{0,19}$'),
	CONSTRAINT "hostel_blocks_name_not_blank_check" CHECK (length(trim("hostel_blocks"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "room_allocations" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_profile_id" integer NOT NULL,
	"room_id" integer NOT NULL,
	"allocated_by_user_id" integer NOT NULL,
	"allocated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"vacated_at" timestamp with time zone,
	"vacated_by_user_id" integer,
	"vacate_reason" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "room_allocations_dates_check" CHECK ("room_allocations"."vacated_at" is null or "room_allocations"."vacated_at" > "room_allocations"."allocated_at"),
	CONSTRAINT "room_allocations_vacancy_details_check" CHECK (("room_allocations"."vacated_at" is null and "room_allocations"."vacated_by_user_id" is null and "room_allocations"."vacate_reason" is null) or ("room_allocations"."vacated_at" is not null and "room_allocations"."vacated_by_user_id" is not null and length(trim("room_allocations"."vacate_reason")) > 0))
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" serial PRIMARY KEY NOT NULL,
	"block_id" integer NOT NULL,
	"room_number" varchar(20) NOT NULL,
	"floor" integer NOT NULL,
	"capacity" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rooms_number_format_check" CHECK ("rooms"."room_number" ~ '^[A-Z0-9][A-Z0-9-]{0,19}$'),
	CONSTRAINT "rooms_floor_bounds_check" CHECK ("rooms"."floor" between 0 and 99),
	CONSTRAINT "rooms_capacity_bounds_check" CHECK ("rooms"."capacity" between 1 and 20)
);
--> statement-breakpoint
CREATE TABLE "staff_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"employee_no" varchar(50),
	"phone" varchar(20),
	"job_title" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_profiles_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "staff_profiles_employee_no_unique" UNIQUE("employee_no"),
	CONSTRAINT "staff_profiles_employee_no_not_blank_check" CHECK ("staff_profiles"."employee_no" is null or length(trim("staff_profiles"."employee_no")) > 0),
	CONSTRAINT "staff_profiles_phone_format_check" CHECK ("staff_profiles"."phone" is null or "staff_profiles"."phone" ~ '^[0-9+() -]{7,20}$'),
	CONSTRAINT "staff_profiles_job_title_not_blank_check" CHECK ("staff_profiles"."job_title" is null or length(trim("staff_profiles"."job_title")) > 0)
);
--> statement-breakpoint
CREATE TABLE "student_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"hostel_id" integer NOT NULL,
	"roll_no" varchar(50) NOT NULL,
	"phone" varchar(20),
	"guardian_name" varchar(255),
	"guardian_phone" varchar(20),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_profiles_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "student_profiles_roll_no_unique" UNIQUE("roll_no"),
	CONSTRAINT "student_profiles_roll_no_format_check" CHECK ("student_profiles"."roll_no" ~ '^[A-Z0-9][A-Z0-9 /-]{1,49}$'),
	CONSTRAINT "student_profiles_phone_format_check" CHECK ("student_profiles"."phone" is null or "student_profiles"."phone" ~ '^[0-9+() -]{7,20}$'),
	CONSTRAINT "student_profiles_guardian_name_not_blank_check" CHECK ("student_profiles"."guardian_name" is null or length(trim("student_profiles"."guardian_name")) > 0),
	CONSTRAINT "student_profiles_guardian_phone_format_check" CHECK ("student_profiles"."guardian_phone" is null or "student_profiles"."guardian_phone" ~ '^[0-9+() -]{7,20}$')
);
--> statement-breakpoint
-- Preserve existing account data where it already satisfies the normalized
-- profile rules. Students without a roll number remain eligible to complete a
-- profile later instead of receiving an invented institutional identity.
INSERT INTO "staff_profiles" ("user_id", "phone")
SELECT
	"id",
	CASE
		WHEN "phone" ~ '^[0-9+() -]{7,20}$' THEN "phone"
		ELSE NULL
	END
FROM "users"
WHERE "role" <> 'student'
ON CONFLICT ("user_id") DO NOTHING;--> statement-breakpoint
INSERT INTO "student_profiles" ("user_id", "hostel_id", "roll_no", "phone")
SELECT
	"users"."id",
	"hostel_memberships"."hostel_id",
	"users"."roll_no",
	CASE
		WHEN "users"."phone" ~ '^[0-9+() -]{7,20}$' THEN "users"."phone"
		ELSE NULL
	END
FROM "users"
INNER JOIN "hostel_memberships"
	ON "hostel_memberships"."user_id" = "users"."id"
	AND "hostel_memberships"."is_primary" = true
WHERE "users"."role" = 'student'
	AND "users"."roll_no" ~ '^[A-Z0-9][A-Z0-9 /-]{1,49}$'
ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "hostel_blocks" ADD CONSTRAINT "hostel_blocks_hostel_id_hostels_id_fk" FOREIGN KEY ("hostel_id") REFERENCES "public"."hostels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_allocations" ADD CONSTRAINT "room_allocations_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_allocations" ADD CONSTRAINT "room_allocations_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_allocations" ADD CONSTRAINT "room_allocations_allocated_by_user_id_users_id_fk" FOREIGN KEY ("allocated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_allocations" ADD CONSTRAINT "room_allocations_vacated_by_user_id_users_id_fk" FOREIGN KEY ("vacated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_block_id_hostel_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."hostel_blocks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_hostel_id_hostels_id_fk" FOREIGN KEY ("hostel_id") REFERENCES "public"."hostels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_membership_fk" FOREIGN KEY ("user_id","hostel_id") REFERENCES "public"."hostel_memberships"("user_id","hostel_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "hostel_blocks_hostel_code_unique" ON "hostel_blocks" USING btree ("hostel_id","code");--> statement-breakpoint
CREATE INDEX "hostel_blocks_hostel_id_idx" ON "hostel_blocks" USING btree ("hostel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "room_allocations_one_active_per_student" ON "room_allocations" USING btree ("student_profile_id") WHERE "room_allocations"."vacated_at" is null;--> statement-breakpoint
CREATE INDEX "room_allocations_active_room_idx" ON "room_allocations" USING btree ("room_id") WHERE "room_allocations"."vacated_at" is null;--> statement-breakpoint
CREATE INDEX "room_allocations_student_history_idx" ON "room_allocations" USING btree ("student_profile_id","allocated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "rooms_block_number_unique" ON "rooms" USING btree ("block_id","room_number");--> statement-breakpoint
CREATE INDEX "rooms_block_id_idx" ON "rooms" USING btree ("block_id");--> statement-breakpoint
CREATE INDEX "student_profiles_hostel_id_idx" ON "student_profiles" USING btree ("hostel_id");--> statement-breakpoint
CREATE FUNCTION "enforce_profile_user_role"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
	account_role "user_role";
BEGIN
	SELECT "role" INTO account_role FROM "users" WHERE "id" = NEW."user_id";

	IF TG_TABLE_NAME = 'student_profiles' AND account_role <> 'student' THEN
		RAISE EXCEPTION 'Student profiles require a student account' USING ERRCODE = '23514';
	END IF;

	IF TG_TABLE_NAME = 'staff_profiles' AND account_role = 'student' THEN
		RAISE EXCEPTION 'Staff profiles require a staff account' USING ERRCODE = '23514';
	END IF;

	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "student_profiles_role_check"
BEFORE INSERT OR UPDATE OF "user_id" ON "student_profiles"
FOR EACH ROW EXECUTE FUNCTION "enforce_profile_user_role"();--> statement-breakpoint
CREATE TRIGGER "staff_profiles_role_check"
BEFORE INSERT OR UPDATE OF "user_id" ON "staff_profiles"
FOR EACH ROW EXECUTE FUNCTION "enforce_profile_user_role"();--> statement-breakpoint
CREATE FUNCTION "prevent_incompatible_profile_role_change"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF NEW."role" = OLD."role" THEN
		RETURN NEW;
	END IF;

	IF NEW."role" = 'student' AND EXISTS (
		SELECT 1 FROM "staff_profiles" WHERE "user_id" = NEW."id"
	) THEN
		RAISE EXCEPTION 'Remove the staff profile before changing this account to student' USING ERRCODE = '23514';
	END IF;

	IF NEW."role" <> 'student' AND EXISTS (
		SELECT 1 FROM "student_profiles" WHERE "user_id" = NEW."id"
	) THEN
		RAISE EXCEPTION 'Remove the student profile before changing this account to staff' USING ERRCODE = '23514';
	END IF;

	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "users_profile_role_change_check"
BEFORE UPDATE OF "role" ON "users"
FOR EACH ROW EXECUTE FUNCTION "prevent_incompatible_profile_role_change"();
