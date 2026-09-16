ALTER TABLE "rooms" ADD COLUMN "hostel_id" integer;
--> statement-breakpoint
UPDATE "rooms" room
SET "hostel_id" = block."hostel_id"
FROM "hostel_blocks" block
WHERE room."block_id" = block."id";
--> statement-breakpoint
ALTER TABLE "rooms" ALTER COLUMN "hostel_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_hostel_id_hostels_id_fk"
  FOREIGN KEY ("hostel_id") REFERENCES "public"."hostels"("id")
  ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
WITH duplicate_rooms AS (
  SELECT room."id", block."code"
  FROM "rooms" room
  INNER JOIN "hostel_blocks" block ON block."id" = room."block_id"
  WHERE EXISTS (
    SELECT 1
    FROM "rooms" other
    WHERE other."hostel_id" = room."hostel_id"
      AND other."room_number" = room."room_number"
      AND other."id" <> room."id"
  )
)
UPDATE "rooms" room
SET "room_number" = left(duplicate_rooms."code", 4)
  || '-' || left(room."room_number", 4)
  || '-' || room."id"::text
FROM duplicate_rooms
WHERE room."id" = duplicate_rooms."id";
--> statement-breakpoint
DROP INDEX "rooms_block_number_unique";
--> statement-breakpoint
DROP INDEX "rooms_block_id_idx";
--> statement-breakpoint
ALTER TABLE "rooms" DROP CONSTRAINT "rooms_block_id_hostel_blocks_id_fk";
--> statement-breakpoint
ALTER TABLE "rooms" DROP COLUMN "block_id";
--> statement-breakpoint
CREATE UNIQUE INDEX "rooms_hostel_number_unique"
  ON "rooms" USING btree ("hostel_id", "room_number");
--> statement-breakpoint
CREATE INDEX "rooms_hostel_id_idx" ON "rooms" USING btree ("hostel_id");
--> statement-breakpoint
UPDATE "users" account
SET "room_no" = room."room_number", "updated_at" = now()
FROM "student_profiles" profile
INNER JOIN "room_allocations" allocation
  ON allocation."student_profile_id" = profile."id"
  AND allocation."vacated_at" IS NULL
INNER JOIN "rooms" room ON room."id" = allocation."room_id"
WHERE account."id" = profile."user_id";
--> statement-breakpoint

CREATE OR REPLACE FUNCTION validate_complaint_scope()
RETURNS trigger AS $$
DECLARE
  reporter_role text;
  profile_user_id integer;
  profile_hostel_id integer;
  room_hostel_id integer;
BEGIN
  SELECT "role"::text INTO reporter_role FROM "users" WHERE "id" = NEW."reported_by_user_id";

  IF reporter_role NOT IN ('student', 'warden', 'admin') THEN
    RAISE EXCEPTION 'Only students, wardens, and administrators may report complaints' USING ERRCODE = '23514';
  END IF;

  IF NEW."student_profile_id" IS NOT NULL THEN
    SELECT "user_id", "hostel_id" INTO profile_user_id, profile_hostel_id
    FROM "student_profiles" WHERE "id" = NEW."student_profile_id";

    IF profile_hostel_id IS DISTINCT FROM NEW."hostel_id" THEN
      RAISE EXCEPTION 'Complaint student profile must belong to the complaint hostel' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF reporter_role = 'student' AND (NEW."student_profile_id" IS NULL OR profile_user_id IS DISTINCT FROM NEW."reported_by_user_id") THEN
    RAISE EXCEPTION 'A student complaint must use the reporting student profile' USING ERRCODE = '23514';
  END IF;

  IF reporter_role = 'warden' AND NOT EXISTS (
    SELECT 1 FROM "hostel_memberships"
    WHERE "user_id" = NEW."reported_by_user_id" AND "hostel_id" = NEW."hostel_id"
  ) THEN
    RAISE EXCEPTION 'The reporting warden must belong to the complaint hostel' USING ERRCODE = '23514';
  END IF;

  IF NEW."room_id" IS NOT NULL THEN
    SELECT "hostel_id" INTO room_hostel_id
    FROM "rooms" WHERE "id" = NEW."room_id";

    IF room_hostel_id IS DISTINCT FROM NEW."hostel_id" THEN
      RAISE EXCEPTION 'Complaint room must belong to the complaint hostel' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER "notice_recipient_scope_guard" ON "notice_recipients";
--> statement-breakpoint
DROP TRIGGER "notice_publication_guard" ON "notices";
--> statement-breakpoint
DROP TRIGGER "notice_update_guard" ON "notices";
--> statement-breakpoint
ALTER TABLE "notices" DROP CONSTRAINT "notices_audience_shape_check";
--> statement-breakpoint
ALTER TABLE "notices" DROP CONSTRAINT "notices_block_id_hostel_blocks_id_fk";
--> statement-breakpoint
UPDATE "notices" SET "audience_type" = 'hostel' WHERE "audience_type" = 'block';
--> statement-breakpoint
ALTER TABLE "notices" ALTER COLUMN "audience_type" TYPE text USING "audience_type"::text;
--> statement-breakpoint
DROP TYPE "notice_audience_type";
--> statement-breakpoint
CREATE TYPE "notice_audience_type" AS ENUM ('all_residents', 'role', 'hostel');
--> statement-breakpoint
ALTER TABLE "notices" ALTER COLUMN "audience_type" TYPE "notice_audience_type"
  USING "audience_type"::"notice_audience_type";
--> statement-breakpoint
ALTER TABLE "notices" DROP COLUMN "block_id";
--> statement-breakpoint
ALTER TABLE "notices" ADD CONSTRAINT "notices_audience_shape_check" CHECK (
  ("audience_type" = 'all_residents' and "audience_role" is null and "hostel_id" is null)
  or ("audience_type" = 'role' and "audience_role" is not null and "hostel_id" is null)
  or ("audience_type" = 'hostel' and "audience_role" is null and "hostel_id" is not null)
);
--> statement-breakpoint

CREATE OR REPLACE FUNCTION validate_notice_publication()
RETURNS trigger AS $$
DECLARE
  publisher_role text;
  publisher_status text;
BEGIN
  SELECT "role"::text, "account_status"::text
  INTO publisher_role, publisher_status
  FROM "users"
  WHERE "id" = NEW."published_by_user_id";

  IF publisher_status IS DISTINCT FROM 'active'
    OR publisher_role NOT IN ('warden', 'admin') THEN
    RAISE EXCEPTION 'Notices require an active warden or administrator publisher'
      USING ERRCODE = '42501';
  END IF;

  IF NEW."hostel_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "hostels"
    WHERE "id" = NEW."hostel_id" AND "is_active" = true
  ) THEN
    RAISE EXCEPTION 'Notice hostel must be active'
      USING ERRCODE = '23514';
  END IF;

  IF publisher_role = 'warden' THEN
    IF NEW."audience_type" <> 'hostel' OR NOT EXISTS (
      SELECT 1 FROM "hostel_memberships"
      WHERE "user_id" = NEW."published_by_user_id"
        AND "hostel_id" = NEW."hostel_id"
    ) THEN
      RAISE EXCEPTION 'Warden notice audience is outside assigned hostels'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "notice_publication_guard"
BEFORE INSERT ON "notices"
FOR EACH ROW EXECUTE FUNCTION validate_notice_publication();
--> statement-breakpoint
CREATE TRIGGER "notice_update_guard"
BEFORE UPDATE ON "notices"
FOR EACH ROW EXECUTE FUNCTION protect_notice_publication();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION validate_notice_recipient()
RETURNS trigger AS $$
DECLARE
  target_notice "notices"%ROWTYPE;
BEGIN
  SELECT * INTO target_notice FROM "notices" WHERE "id" = NEW."notice_id";

  IF NEW."read_at" IS NOT NULL THEN
    RAISE EXCEPTION 'New notice recipients must start unread' USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "users"
    WHERE "id" = NEW."user_id" AND "account_status" = 'active'
  ) THEN
    RAISE EXCEPTION 'Notice recipient must have an active account' USING ERRCODE = '42501';
  END IF;

  IF target_notice."audience_type" = 'all_residents' AND NOT EXISTS (
    SELECT 1 FROM "users" u
    INNER JOIN "student_profiles" sp ON sp."user_id" = u."id"
    WHERE u."id" = NEW."user_id" AND u."role" = 'student'
  ) THEN
    RAISE EXCEPTION 'Notice recipient is outside the resident audience' USING ERRCODE = '42501';
  ELSIF target_notice."audience_type" = 'role' AND NOT EXISTS (
    SELECT 1 FROM "users" u
    WHERE u."id" = NEW."user_id" AND u."role" = target_notice."audience_role"
  ) THEN
    RAISE EXCEPTION 'Notice recipient is outside the role audience' USING ERRCODE = '42501';
  ELSIF target_notice."audience_type" = 'hostel' AND NOT EXISTS (
    SELECT 1 FROM "hostel_memberships" hm
    WHERE hm."user_id" = NEW."user_id"
      AND hm."hostel_id" = target_notice."hostel_id"
  ) THEN
    RAISE EXCEPTION 'Notice recipient is outside the hostel audience' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "notice_recipient_scope_guard"
BEFORE INSERT ON "notice_recipients"
FOR EACH ROW EXECUTE FUNCTION validate_notice_recipient();
--> statement-breakpoint

DROP TABLE "hostel_blocks";
