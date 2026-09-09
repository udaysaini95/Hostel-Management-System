CREATE TYPE "notice_priority" AS ENUM ('normal', 'important', 'urgent');
CREATE TYPE "notice_audience_type" AS ENUM ('all_residents', 'role', 'hostel', 'block');

CREATE TABLE "notices" (
  "id" serial PRIMARY KEY NOT NULL,
  "published_by_user_id" integer NOT NULL,
  "title" varchar(200) NOT NULL,
  "body" text NOT NULL,
  "priority" "notice_priority" DEFAULT 'normal' NOT NULL,
  "audience_type" "notice_audience_type" NOT NULL,
  "audience_role" "user_role",
  "hostel_id" integer,
  "block_id" integer,
  "published_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone,
  CONSTRAINT "notices_title_check" CHECK (length(trim("title")) between 1 and 200),
  CONSTRAINT "notices_body_check" CHECK (length(trim("body")) between 1 and 5000),
  CONSTRAINT "notices_expiry_check" CHECK ("expires_at" is null or "expires_at" > "published_at"),
  CONSTRAINT "notices_audience_shape_check" CHECK (
    ("audience_type" = 'all_residents' and "audience_role" is null and "hostel_id" is null and "block_id" is null)
    or ("audience_type" = 'role' and "audience_role" is not null and "hostel_id" is null and "block_id" is null)
    or ("audience_type" = 'hostel' and "audience_role" is null and "hostel_id" is not null and "block_id" is null)
    or ("audience_type" = 'block' and "audience_role" is null and "hostel_id" is not null and "block_id" is not null)
  )
);

CREATE TABLE "notice_recipients" (
  "id" serial PRIMARY KEY NOT NULL,
  "notice_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "notice_recipients_notice_user_unique" UNIQUE("notice_id", "user_id"),
  CONSTRAINT "notice_recipients_read_date_check" CHECK ("read_at" is null or "read_at" >= "created_at")
);

ALTER TABLE "notices" ADD CONSTRAINT "notices_published_by_user_id_users_id_fk"
  FOREIGN KEY ("published_by_user_id") REFERENCES "public"."users"("id")
  ON DELETE restrict ON UPDATE no action;
ALTER TABLE "notices" ADD CONSTRAINT "notices_hostel_id_hostels_id_fk"
  FOREIGN KEY ("hostel_id") REFERENCES "public"."hostels"("id")
  ON DELETE restrict ON UPDATE no action;
ALTER TABLE "notices" ADD CONSTRAINT "notices_block_id_hostel_blocks_id_fk"
  FOREIGN KEY ("block_id") REFERENCES "public"."hostel_blocks"("id")
  ON DELETE restrict ON UPDATE no action;
ALTER TABLE "notice_recipients" ADD CONSTRAINT "notice_recipients_notice_id_notices_id_fk"
  FOREIGN KEY ("notice_id") REFERENCES "public"."notices"("id")
  ON DELETE restrict ON UPDATE no action;
ALTER TABLE "notice_recipients" ADD CONSTRAINT "notice_recipients_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE restrict ON UPDATE no action;

CREATE INDEX "notices_active_idx" ON "notices" ("published_at", "expires_at");
CREATE INDEX "notices_hostel_idx" ON "notices" ("hostel_id", "published_at");
CREATE INDEX "notices_publisher_idx" ON "notices" ("published_by_user_id", "published_at");
CREATE INDEX "notice_recipients_user_unread_idx"
  ON "notice_recipients" ("user_id", "read_at", "notice_id");

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

  IF NEW."block_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "hostel_blocks"
    WHERE "id" = NEW."block_id"
      AND "hostel_id" = NEW."hostel_id"
      AND "is_active" = true
  ) THEN
    RAISE EXCEPTION 'Notice block must belong to the selected hostel and be active'
      USING ERRCODE = '23514';
  END IF;

  IF publisher_role = 'warden' THEN
    IF NEW."audience_type" NOT IN ('hostel', 'block') OR NOT EXISTS (
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

CREATE TRIGGER "notice_publication_guard"
BEFORE INSERT ON "notices"
FOR EACH ROW EXECUTE FUNCTION validate_notice_publication();

CREATE OR REPLACE FUNCTION protect_notice_publication()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Published notices are immutable'
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "notice_update_guard"
BEFORE UPDATE ON "notices"
FOR EACH ROW EXECUTE FUNCTION protect_notice_publication();

CREATE TRIGGER "notice_delete_guard"
BEFORE DELETE ON "notices"
FOR EACH ROW EXECUTE FUNCTION protect_notice_publication();

CREATE OR REPLACE FUNCTION validate_notice_recipient()
RETURNS trigger AS $$
DECLARE
  target_notice "notices"%ROWTYPE;
BEGIN
  SELECT * INTO target_notice FROM "notices" WHERE "id" = NEW."notice_id";

  IF NEW."read_at" IS NOT NULL THEN
    RAISE EXCEPTION 'New notice recipients must start unread'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "users"
    WHERE "id" = NEW."user_id" AND "account_status" = 'active'
  ) THEN
    RAISE EXCEPTION 'Notice recipient must have an active account'
      USING ERRCODE = '42501';
  END IF;

  IF target_notice."audience_type" = 'all_residents' AND NOT EXISTS (
    SELECT 1 FROM "users" u
    INNER JOIN "student_profiles" sp ON sp."user_id" = u."id"
    WHERE u."id" = NEW."user_id" AND u."role" = 'student'
  ) THEN
    RAISE EXCEPTION 'Notice recipient is outside the resident audience'
      USING ERRCODE = '42501';
  ELSIF target_notice."audience_type" = 'role' AND NOT EXISTS (
    SELECT 1 FROM "users" u
    WHERE u."id" = NEW."user_id" AND u."role" = target_notice."audience_role"
  ) THEN
    RAISE EXCEPTION 'Notice recipient is outside the role audience'
      USING ERRCODE = '42501';
  ELSIF target_notice."audience_type" = 'hostel' AND NOT EXISTS (
    SELECT 1 FROM "hostel_memberships" hm
    WHERE hm."user_id" = NEW."user_id"
      AND hm."hostel_id" = target_notice."hostel_id"
  ) THEN
    RAISE EXCEPTION 'Notice recipient is outside the hostel audience'
      USING ERRCODE = '42501';
  ELSIF target_notice."audience_type" = 'block' AND NOT EXISTS (
    SELECT 1
    FROM "users" u
    INNER JOIN "student_profiles" sp ON sp."user_id" = u."id"
    INNER JOIN "room_allocations" ra
      ON ra."student_profile_id" = sp."id" AND ra."vacated_at" IS NULL
    INNER JOIN "rooms" r ON r."id" = ra."room_id"
    WHERE u."id" = NEW."user_id"
      AND u."role" = 'student'
      AND sp."hostel_id" = target_notice."hostel_id"
      AND r."block_id" = target_notice."block_id"
  ) THEN
    RAISE EXCEPTION 'Notice recipient is outside the block audience'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "notice_recipient_scope_guard"
BEFORE INSERT ON "notice_recipients"
FOR EACH ROW EXECUTE FUNCTION validate_notice_recipient();

CREATE OR REPLACE FUNCTION protect_notice_recipient()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Notice recipients cannot be deleted'
      USING ERRCODE = '55000';
  END IF;

  IF NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."notice_id" IS DISTINCT FROM OLD."notice_id"
    OR NEW."user_id" IS DISTINCT FROM OLD."user_id"
    OR NEW."created_at" IS DISTINCT FROM OLD."created_at"
    OR OLD."read_at" IS NOT NULL
    OR NEW."read_at" IS NULL THEN
    RAISE EXCEPTION 'Only the first notice read timestamp may be recorded'
      USING ERRCODE = '55000';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "notice_recipient_update_guard"
BEFORE UPDATE ON "notice_recipients"
FOR EACH ROW EXECUTE FUNCTION protect_notice_recipient();

CREATE TRIGGER "notice_recipient_delete_guard"
BEFORE DELETE ON "notice_recipients"
FOR EACH ROW EXECUTE FUNCTION protect_notice_recipient();
