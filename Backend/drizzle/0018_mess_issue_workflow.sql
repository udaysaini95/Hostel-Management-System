ALTER TABLE "mess_issues" RENAME TO "legacy_mess_issues";
ALTER SEQUENCE IF EXISTS "mess_issues_id_seq" RENAME TO "legacy_mess_issues_id_seq";

COMMENT ON TABLE "legacy_mess_issues" IS
  'Archived by migration 0018 because old issues had no reliable hostel scope or workflow history.';

DO $$ BEGIN
  CREATE TYPE "mess_issue_type" AS ENUM (
    'food_quality', 'hygiene', 'quantity', 'staff_behavior', 'other'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "mess_issue_status" AS ENUM ('reported', 'in_progress', 'resolved');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE "mess_issues" (
  "id" serial PRIMARY KEY NOT NULL,
  "hostel_id" integer NOT NULL,
  "reported_by_user_id" integer NOT NULL,
  "issue_type" "mess_issue_type" NOT NULL,
  "meal_type" "mess_meal_type" NOT NULL,
  "description" text NOT NULL,
  "status" "mess_issue_status" DEFAULT 'reported' NOT NULL,
  "resolved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "mess_issues_description_check"
    CHECK (length(trim("description")) between 10 and 2000),
  CONSTRAINT "mess_issues_resolved_at_check"
    CHECK (("status" = 'resolved') = ("resolved_at" is not null))
);

CREATE TABLE "mess_issue_events" (
  "id" serial PRIMARY KEY NOT NULL,
  "mess_issue_id" integer NOT NULL,
  "actor_user_id" integer NOT NULL,
  "actor_name" varchar(255) NOT NULL,
  "actor_role" varchar(50) NOT NULL,
  "from_status" "mess_issue_status",
  "to_status" "mess_issue_status" NOT NULL,
  "note" varchar(1000),
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "mess_issue_events_actor_check"
    CHECK (length(trim("actor_name")) > 0 and length(trim("actor_role")) > 0),
  CONSTRAINT "mess_issue_events_note_check"
    CHECK ("note" is null or length(trim("note")) between 1 and 1000)
);

CREATE TABLE "mess_issue_attachments" (
  "id" serial PRIMARY KEY NOT NULL,
  "mess_issue_id" integer NOT NULL UNIQUE,
  "uploaded_by_user_id" integer NOT NULL,
  "storage_key" varchar(500) NOT NULL UNIQUE,
  "original_name" varchar(255) NOT NULL,
  "mime_type" varchar(100) NOT NULL,
  "size_bytes" integer NOT NULL,
  "sha256" varchar(64) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "mess_issue_attachments_storage_key_check"
    CHECK (length(trim("storage_key")) > 0),
  CONSTRAINT "mess_issue_attachments_original_name_check"
    CHECK (length(trim("original_name")) > 0),
  CONSTRAINT "mess_issue_attachments_mime_type_check"
    CHECK ("mime_type" in ('image/jpeg', 'image/png', 'image/webp')),
  CONSTRAINT "mess_issue_attachments_size_check"
    CHECK ("size_bytes" between 1 and 5242880),
  CONSTRAINT "mess_issue_attachments_sha256_check"
    CHECK ("sha256" ~ '^[a-f0-9]{64}$')
);

ALTER TABLE "mess_issues"
  ADD CONSTRAINT "mess_issues_hostel_id_hostels_id_fk"
  FOREIGN KEY ("hostel_id") REFERENCES "public"."hostels"("id")
  ON DELETE restrict ON UPDATE no action;
ALTER TABLE "mess_issues"
  ADD CONSTRAINT "mess_issues_reported_by_user_id_users_id_fk"
  FOREIGN KEY ("reported_by_user_id") REFERENCES "public"."users"("id")
  ON DELETE restrict ON UPDATE no action;
ALTER TABLE "mess_issue_events"
  ADD CONSTRAINT "mess_issue_events_mess_issue_id_mess_issues_id_fk"
  FOREIGN KEY ("mess_issue_id") REFERENCES "public"."mess_issues"("id")
  ON DELETE restrict ON UPDATE no action;
ALTER TABLE "mess_issue_events"
  ADD CONSTRAINT "mess_issue_events_actor_user_id_users_id_fk"
  FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id")
  ON DELETE restrict ON UPDATE no action;
ALTER TABLE "mess_issue_attachments"
  ADD CONSTRAINT "mess_issue_attachments_mess_issue_id_mess_issues_id_fk"
  FOREIGN KEY ("mess_issue_id") REFERENCES "public"."mess_issues"("id")
  ON DELETE restrict ON UPDATE no action;
ALTER TABLE "mess_issue_attachments"
  ADD CONSTRAINT "mess_issue_attachments_uploaded_by_user_id_users_id_fk"
  FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id")
  ON DELETE restrict ON UPDATE no action;

CREATE INDEX "mess_issues_hostel_queue_idx"
  ON "mess_issues" USING btree ("hostel_id", "status", "created_at");
CREATE INDEX "mess_issues_student_history_idx"
  ON "mess_issues" USING btree ("reported_by_user_id", "created_at");
CREATE INDEX "mess_issue_events_timeline_idx"
  ON "mess_issue_events" USING btree ("mess_issue_id", "occurred_at", "id");

CREATE OR REPLACE FUNCTION validate_mess_issue_reporter()
RETURNS trigger AS $$
BEGIN
  IF NEW."status" <> 'reported' OR NEW."resolved_at" IS NOT NULL THEN
    RAISE EXCEPTION 'New mess issues must start in reported status'
      USING ERRCODE = '23514', CONSTRAINT = 'mess_issue_initial_status_check';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "users" u
    INNER JOIN "student_profiles" sp ON sp."user_id" = u."id"
    WHERE u."id" = NEW."reported_by_user_id"
      AND u."role" = 'student'
      AND u."account_status" = 'active'
      AND sp."hostel_id" = NEW."hostel_id"
  ) THEN
    RAISE EXCEPTION 'Mess issue reporter must be an active student in the selected hostel'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "mess_issue_reporter_scope_guard"
BEFORE INSERT ON "mess_issues"
FOR EACH ROW EXECUTE FUNCTION validate_mess_issue_reporter();

CREATE OR REPLACE FUNCTION protect_mess_issue_workflow()
RETURNS trigger AS $$
BEGIN
  IF NEW."hostel_id" IS DISTINCT FROM OLD."hostel_id"
    OR NEW."reported_by_user_id" IS DISTINCT FROM OLD."reported_by_user_id"
    OR NEW."issue_type" IS DISTINCT FROM OLD."issue_type"
    OR NEW."meal_type" IS DISTINCT FROM OLD."meal_type"
    OR NEW."description" IS DISTINCT FROM OLD."description"
    OR NEW."created_at" IS DISTINCT FROM OLD."created_at" THEN
    RAISE EXCEPTION 'Mess issue report details are immutable'
      USING ERRCODE = '55000';
  END IF;

  IF NOT (
    (OLD."status" = 'reported' AND NEW."status" = 'in_progress')
    OR (OLD."status" = 'in_progress' AND NEW."status" = 'resolved')
  ) THEN
    RAISE EXCEPTION 'Invalid mess issue status transition'
      USING ERRCODE = '23514', CONSTRAINT = 'mess_issue_status_transition_check';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "mess_issue_workflow_guard"
BEFORE UPDATE ON "mess_issues"
FOR EACH ROW EXECUTE FUNCTION protect_mess_issue_workflow();

CREATE OR REPLACE FUNCTION validate_mess_issue_event()
RETURNS trigger AS $$
DECLARE
  current_status text;
  issue_hostel_id integer;
  reporter_id integer;
  actor_role text;
  actor_status text;
  actor_name text;
BEGIN
  SELECT "status"::text, "hostel_id", "reported_by_user_id"
  INTO current_status, issue_hostel_id, reporter_id
  FROM "mess_issues" WHERE "id" = NEW."mess_issue_id";

  SELECT "role"::text, "account_status"::text, "name"
  INTO actor_role, actor_status, actor_name
  FROM "users" WHERE "id" = NEW."actor_user_id";

  IF NEW."to_status"::text IS DISTINCT FROM current_status THEN
    RAISE EXCEPTION 'Mess issue event must match current issue status'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."actor_role" IS DISTINCT FROM actor_role
    OR NEW."actor_name" IS DISTINCT FROM actor_name THEN
    RAISE EXCEPTION 'Mess issue event actor snapshot is invalid'
      USING ERRCODE = '23514';
  END IF;

  IF (NEW."from_status" IS NULL AND NEW."to_status" <> 'reported')
    OR (NEW."from_status" = 'reported' AND NEW."to_status" <> 'in_progress')
    OR (NEW."from_status" = 'in_progress' AND NEW."to_status" <> 'resolved')
    OR NEW."from_status" = 'resolved' THEN
    RAISE EXCEPTION 'Mess issue event contains an invalid transition'
      USING ERRCODE = '23514';
  END IF;

  IF actor_status IS DISTINCT FROM 'active' OR NOT (
    (NEW."from_status" IS NULL AND actor_role = 'student' AND NEW."actor_user_id" = reporter_id)
    OR (NEW."from_status" IS NOT NULL AND actor_role = 'admin')
    OR (NEW."from_status" IS NOT NULL AND actor_role = 'warden' AND EXISTS (
      SELECT 1 FROM "hostel_memberships"
      WHERE "user_id" = NEW."actor_user_id" AND "hostel_id" = issue_hostel_id
    ))
  ) THEN
    RAISE EXCEPTION 'Mess issue event actor is outside the issue scope'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "mess_issue_event_scope_guard"
BEFORE INSERT ON "mess_issue_events"
FOR EACH ROW EXECUTE FUNCTION validate_mess_issue_event();

CREATE OR REPLACE FUNCTION validate_mess_issue_attachment()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "mess_issues"
    WHERE "id" = NEW."mess_issue_id"
      AND "reported_by_user_id" = NEW."uploaded_by_user_id"
      AND "status" = 'reported'
  ) THEN
    RAISE EXCEPTION 'Mess issue evidence must be uploaded by its reporter at submission'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "mess_issue_attachment_scope_guard"
BEFORE INSERT ON "mess_issue_attachments"
FOR EACH ROW EXECUTE FUNCTION validate_mess_issue_attachment();

CREATE OR REPLACE FUNCTION protect_mess_issue_history()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Mess issue history is immutable'
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "mess_issue_events_immutable"
BEFORE UPDATE OR DELETE ON "mess_issue_events"
FOR EACH ROW EXECUTE FUNCTION protect_mess_issue_history();
CREATE TRIGGER "mess_issue_attachments_immutable"
BEFORE UPDATE OR DELETE ON "mess_issue_attachments"
FOR EACH ROW EXECUTE FUNCTION protect_mess_issue_history();
