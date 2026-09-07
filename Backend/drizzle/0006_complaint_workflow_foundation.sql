CREATE TYPE "public"."complaint_attachment_purpose" AS ENUM('submission', 'resolution');--> statement-breakpoint
CREATE TYPE "public"."complaint_event_type" AS ENUM('created', 'assigned', 'reassigned', 'work_started', 'resolved', 'reopened', 'closed');--> statement-breakpoint
CREATE TYPE "public"."complaint_priority" AS ENUM('critical', 'high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."complaint_status" AS ENUM('created', 'assigned', 'in_progress', 'resolved', 'closed');--> statement-breakpoint

-- Keep the running legacy UI usable until CMP-02 moves its handlers to the
-- normalized workflow. PostgreSQL preserves the existing rows during rename.
ALTER TABLE "complaints" RENAME TO "legacy_complaints";--> statement-breakpoint
ALTER TABLE "complaint_timelines" RENAME TO "legacy_complaint_timelines";--> statement-breakpoint
ALTER SEQUENCE "complaints_id_seq" RENAME TO "legacy_complaints_id_seq";--> statement-breakpoint
ALTER SEQUENCE "complaint_timelines_id_seq" RENAME TO "legacy_complaint_timelines_id_seq";--> statement-breakpoint
ALTER TABLE "legacy_complaints" RENAME CONSTRAINT "complaints_pkey" TO "legacy_complaints_pkey";--> statement-breakpoint
ALTER TABLE "legacy_complaint_timelines" RENAME CONSTRAINT "complaint_timelines_pkey" TO "legacy_complaint_timelines_pkey";--> statement-breakpoint
ALTER TABLE "legacy_complaints" RENAME CONSTRAINT "complaints_user_id_users_id_fk" TO "legacy_complaints_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "legacy_complaint_timelines" RENAME CONSTRAINT "complaint_timelines_complaint_id_complaints_id_fk" TO "legacy_complaint_timelines_complaint_id_legacy_complaints_id_fk";--> statement-breakpoint

CREATE TABLE "complaint_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"default_priority" "complaint_priority" NOT NULL,
	"sla_minutes" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "complaint_categories_code_unique" UNIQUE("code"),
	CONSTRAINT "complaint_categories_name_unique" UNIQUE("name"),
	CONSTRAINT "complaint_categories_code_format_check" CHECK ("complaint_categories"."code" ~ '^[a-z][a-z0-9_]{1,49}$'),
	CONSTRAINT "complaint_categories_name_not_blank_check" CHECK (length(trim("complaint_categories"."name")) > 0),
	CONSTRAINT "complaint_categories_sla_bounds_check" CHECK ("complaint_categories"."sla_minutes" between 15 and 43200)
);--> statement-breakpoint

INSERT INTO "complaint_categories" ("code", "name", "default_priority", "sla_minutes")
VALUES
	('electrical', 'Electrical', 'high', 720),
	('plumbing', 'Plumbing', 'high', 720),
	('furniture', 'Furniture', 'medium', 2880),
	('internet', 'Wi-Fi / Internet', 'medium', 2880),
	('cleaning', 'Cleaning / Hygiene', 'medium', 2880),
	('other', 'Other', 'medium', 2880);--> statement-breakpoint

CREATE TABLE "complaints" (
	"id" serial PRIMARY KEY NOT NULL,
	"hostel_id" integer NOT NULL,
	"reported_by_user_id" integer NOT NULL,
	"student_profile_id" integer,
	"category_id" integer NOT NULL,
	"room_id" integer,
	"location" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"requested_priority" "complaint_priority",
	"priority" "complaint_priority" NOT NULL,
	"sla_policy_minutes" integer NOT NULL,
	"sla_deadline" timestamp with time zone NOT NULL,
	"status" "complaint_status" DEFAULT 'created' NOT NULL,
	"resolution_note" text,
	"resolved_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "complaints_location_not_blank_check" CHECK (length(trim("complaints"."location")) > 0),
	CONSTRAINT "complaints_description_length_check" CHECK (length(trim("complaints"."description")) between 10 and 2000),
	CONSTRAINT "complaints_sla_policy_bounds_check" CHECK ("complaints"."sla_policy_minutes" between 15 and 43200),
	CONSTRAINT "complaints_sla_deadline_check" CHECK ("complaints"."sla_deadline" > "complaints"."created_at"),
	CONSTRAINT "complaints_resolution_details_check" CHECK (("complaints"."resolved_at" is null and "complaints"."resolution_note" is null) or ("complaints"."resolved_at" is not null and "complaints"."resolved_at" >= "complaints"."created_at" and length(trim("complaints"."resolution_note")) > 0)),
	CONSTRAINT "complaints_resolved_state_check" CHECK ("complaints"."status" not in ('resolved', 'closed') or "complaints"."resolved_at" is not null),
	CONSTRAINT "complaints_closed_state_check" CHECK (("complaints"."status" = 'closed' and "complaints"."closed_at" is not null and "complaints"."closed_at" >= "complaints"."resolved_at") or ("complaints"."status" <> 'closed' and "complaints"."closed_at" is null)),
	CONSTRAINT "complaints_updated_at_check" CHECK ("complaints"."updated_at" >= "complaints"."created_at")
);--> statement-breakpoint

CREATE TABLE "complaint_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"complaint_id" integer NOT NULL,
	"assignee_user_id" integer NOT NULL,
	"assigned_by_user_id" integer NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"ended_by_user_id" integer,
	"end_reason" varchar(500),
	CONSTRAINT "complaint_assignments_end_details_check" CHECK (("complaint_assignments"."ended_at" is null and "complaint_assignments"."ended_by_user_id" is null and "complaint_assignments"."end_reason" is null) or ("complaint_assignments"."ended_at" is not null and "complaint_assignments"."ended_at" > "complaint_assignments"."assigned_at" and "complaint_assignments"."ended_by_user_id" is not null and length(trim("complaint_assignments"."end_reason")) > 0))
);--> statement-breakpoint

CREATE TABLE "complaint_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"complaint_id" integer NOT NULL,
	"event_type" "complaint_event_type" NOT NULL,
	"from_status" "complaint_status",
	"to_status" "complaint_status" NOT NULL,
	"actor_user_id" integer,
	"actor_name" varchar(255) NOT NULL,
	"actor_role" varchar(50) NOT NULL,
	"note" varchar(1000),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "complaint_events_created_state_check" CHECK (("complaint_events"."event_type" = 'created' and "complaint_events"."from_status" is null and "complaint_events"."to_status" = 'created') or ("complaint_events"."event_type" <> 'created' and "complaint_events"."from_status" is not null)),
	CONSTRAINT "complaint_events_actor_snapshot_check" CHECK (length(trim("complaint_events"."actor_name")) > 0 and length(trim("complaint_events"."actor_role")) > 0),
	CONSTRAINT "complaint_events_note_not_blank_check" CHECK ("complaint_events"."note" is null or length(trim("complaint_events"."note")) > 0),
	CONSTRAINT "complaint_events_metadata_object_check" CHECK (jsonb_typeof("complaint_events"."metadata") = 'object')
);--> statement-breakpoint

CREATE TABLE "complaint_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"complaint_id" integer NOT NULL,
	"event_id" integer,
	"uploaded_by_user_id" integer NOT NULL,
	"purpose" "complaint_attachment_purpose" NOT NULL,
	"storage_key" varchar(500) NOT NULL,
	"original_name" varchar(255) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "complaint_attachments_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "complaint_attachments_storage_key_check" CHECK (length(trim("complaint_attachments"."storage_key")) > 0),
	CONSTRAINT "complaint_attachments_original_name_check" CHECK (length(trim("complaint_attachments"."original_name")) > 0),
	CONSTRAINT "complaint_attachments_mime_type_check" CHECK ("complaint_attachments"."mime_type" in ('image/jpeg', 'image/png', 'image/webp')),
	CONSTRAINT "complaint_attachments_size_check" CHECK ("complaint_attachments"."size_bytes" between 1 and 5242880),
	CONSTRAINT "complaint_attachments_sha256_check" CHECK ("complaint_attachments"."sha256" ~ '^[a-f0-9]{64}$')
);--> statement-breakpoint

ALTER TABLE "complaints" ADD CONSTRAINT "complaints_hostel_id_hostels_id_fk" FOREIGN KEY ("hostel_id") REFERENCES "public"."hostels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_reported_by_user_id_users_id_fk" FOREIGN KEY ("reported_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_category_id_complaint_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."complaint_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaint_assignments" ADD CONSTRAINT "complaint_assignments_complaint_id_complaints_id_fk" FOREIGN KEY ("complaint_id") REFERENCES "public"."complaints"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaint_assignments" ADD CONSTRAINT "complaint_assignments_assignee_user_id_users_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaint_assignments" ADD CONSTRAINT "complaint_assignments_assigned_by_user_id_users_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaint_assignments" ADD CONSTRAINT "complaint_assignments_ended_by_user_id_users_id_fk" FOREIGN KEY ("ended_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaint_events" ADD CONSTRAINT "complaint_events_complaint_id_complaints_id_fk" FOREIGN KEY ("complaint_id") REFERENCES "public"."complaints"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaint_events" ADD CONSTRAINT "complaint_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaint_attachments" ADD CONSTRAINT "complaint_attachments_complaint_id_complaints_id_fk" FOREIGN KEY ("complaint_id") REFERENCES "public"."complaints"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaint_attachments" ADD CONSTRAINT "complaint_attachments_event_id_complaint_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."complaint_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaint_attachments" ADD CONSTRAINT "complaint_attachments_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "complaints_hostel_status_created_idx" ON "complaints" USING btree ("hostel_id", "status", "created_at");--> statement-breakpoint
CREATE INDEX "complaints_open_sla_idx" ON "complaints" USING btree ("hostel_id", "sla_deadline") WHERE "complaints"."status" <> 'closed';--> statement-breakpoint
CREATE INDEX "complaints_student_profile_idx" ON "complaints" USING btree ("student_profile_id", "created_at");--> statement-breakpoint
CREATE INDEX "complaints_reporter_idx" ON "complaints" USING btree ("reported_by_user_id");--> statement-breakpoint
CREATE INDEX "complaints_category_idx" ON "complaints" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "complaint_assignments_one_active_per_complaint" ON "complaint_assignments" USING btree ("complaint_id") WHERE "complaint_assignments"."ended_at" is null;--> statement-breakpoint
CREATE INDEX "complaint_assignments_active_assignee_idx" ON "complaint_assignments" USING btree ("assignee_user_id", "assigned_at") WHERE "complaint_assignments"."ended_at" is null;--> statement-breakpoint
CREATE INDEX "complaint_assignments_history_idx" ON "complaint_assignments" USING btree ("complaint_id", "assigned_at");--> statement-breakpoint
CREATE INDEX "complaint_events_timeline_idx" ON "complaint_events" USING btree ("complaint_id", "occurred_at", "id");--> statement-breakpoint
CREATE INDEX "complaint_events_actor_idx" ON "complaint_events" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "complaint_attachments_complaint_idx" ON "complaint_attachments" USING btree ("complaint_id", "created_at");--> statement-breakpoint

CREATE OR REPLACE FUNCTION prevent_complaint_event_mutation()
RETURNS trigger AS $$
BEGIN
	RAISE EXCEPTION 'Complaint timeline events are immutable' USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER complaint_events_immutable
BEFORE UPDATE OR DELETE ON "complaint_events"
FOR EACH ROW EXECUTE FUNCTION prevent_complaint_event_mutation();--> statement-breakpoint

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
		SELECT blocks."hostel_id" INTO room_hostel_id
		FROM "rooms" room
		JOIN "hostel_blocks" blocks ON blocks."id" = room."block_id"
		WHERE room."id" = NEW."room_id";

		IF room_hostel_id IS DISTINCT FROM NEW."hostel_id" THEN
			RAISE EXCEPTION 'Complaint room must belong to the complaint hostel' USING ERRCODE = '23514';
		END IF;
	END IF;

	RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER complaints_scope_guard
BEFORE INSERT OR UPDATE OF "hostel_id", "reported_by_user_id", "student_profile_id", "room_id" ON "complaints"
FOR EACH ROW EXECUTE FUNCTION validate_complaint_scope();--> statement-breakpoint

CREATE OR REPLACE FUNCTION validate_complaint_assignment()
RETURNS trigger AS $$
DECLARE
	complaint_hostel_id integer;
	assignee_role text;
	assigner_role text;
	ending_actor_role text;
BEGIN
	SELECT "hostel_id" INTO complaint_hostel_id FROM "complaints" WHERE "id" = NEW."complaint_id";
	SELECT "role"::text INTO assignee_role FROM "users" WHERE "id" = NEW."assignee_user_id";
	SELECT "role"::text INTO assigner_role FROM "users" WHERE "id" = NEW."assigned_by_user_id";

	IF assignee_role IS DISTINCT FROM 'maintenance' THEN
		RAISE EXCEPTION 'Complaint assignee must have the maintenance role' USING ERRCODE = '23514';
	END IF;

	IF assigner_role NOT IN ('warden', 'admin') THEN
		RAISE EXCEPTION 'Only wardens and administrators may assign complaints' USING ERRCODE = '23514';
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM "hostel_memberships"
		WHERE "user_id" = NEW."assignee_user_id" AND "hostel_id" = complaint_hostel_id
	) THEN
		RAISE EXCEPTION 'Complaint assignee must belong to the complaint hostel' USING ERRCODE = '23514';
	END IF;

	IF assigner_role = 'warden' AND NOT EXISTS (
		SELECT 1 FROM "hostel_memberships"
		WHERE "user_id" = NEW."assigned_by_user_id" AND "hostel_id" = complaint_hostel_id
	) THEN
		RAISE EXCEPTION 'Assigning warden must belong to the complaint hostel' USING ERRCODE = '23514';
	END IF;

	IF TG_OP = 'UPDATE' THEN
		IF NEW."complaint_id" IS DISTINCT FROM OLD."complaint_id"
			OR NEW."assignee_user_id" IS DISTINCT FROM OLD."assignee_user_id"
			OR NEW."assigned_by_user_id" IS DISTINCT FROM OLD."assigned_by_user_id"
			OR NEW."assigned_at" IS DISTINCT FROM OLD."assigned_at" THEN
			RAISE EXCEPTION 'Assignment identity and start details are immutable' USING ERRCODE = '55000';
		END IF;

		IF OLD."ended_at" IS NOT NULL AND ROW(NEW."ended_at", NEW."ended_by_user_id", NEW."end_reason")
			IS DISTINCT FROM ROW(OLD."ended_at", OLD."ended_by_user_id", OLD."end_reason") THEN
			RAISE EXCEPTION 'A completed assignment cannot be changed' USING ERRCODE = '55000';
		END IF;
	END IF;

	IF NEW."ended_by_user_id" IS NOT NULL THEN
		SELECT "role"::text INTO ending_actor_role FROM "users" WHERE "id" = NEW."ended_by_user_id";
		IF ending_actor_role NOT IN ('warden', 'admin') THEN
			RAISE EXCEPTION 'Only wardens and administrators may end assignments' USING ERRCODE = '23514';
		END IF;
	END IF;

	RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER complaint_assignments_guard
BEFORE INSERT OR UPDATE ON "complaint_assignments"
FOR EACH ROW EXECUTE FUNCTION validate_complaint_assignment();
