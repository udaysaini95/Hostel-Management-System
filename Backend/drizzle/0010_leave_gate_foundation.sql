CREATE TYPE "public"."leave_status" AS ENUM('pending', 'rejected', 'approved', 'exited', 'returned', 'expired');--> statement-breakpoint
CREATE TYPE "public"."leave_decision_outcome" AS ENUM('approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."leave_event_type" AS ENUM('submitted', 'approved', 'rejected', 'pass_issued', 'exited', 'returned', 'expired', 'override');--> statement-breakpoint
CREATE TYPE "public"."gate_movement" AS ENUM('exit', 'return');--> statement-breakpoint
CREATE TYPE "public"."gate_verification_method" AS ENUM('qr', 'manual', 'override');--> statement-breakpoint

-- Keep the existing screens usable until LEV-04 and LEV-05 move them to the
-- normalized API. Renaming preserves every current leave and gate-log row.
ALTER TABLE "leaves" RENAME TO "legacy_leaves";--> statement-breakpoint
ALTER TABLE "gate_logs" RENAME TO "legacy_gate_logs";--> statement-breakpoint
ALTER SEQUENCE "leaves_id_seq" RENAME TO "legacy_leaves_id_seq";--> statement-breakpoint
ALTER SEQUENCE "gate_logs_id_seq" RENAME TO "legacy_gate_logs_id_seq";--> statement-breakpoint
ALTER TABLE "legacy_leaves" RENAME CONSTRAINT "leaves_pkey" TO "legacy_leaves_pkey";--> statement-breakpoint
ALTER TABLE "legacy_leaves" RENAME CONSTRAINT "leaves_student_id_users_id_fk" TO "legacy_leaves_student_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "legacy_gate_logs" RENAME CONSTRAINT "gate_logs_pkey" TO "legacy_gate_logs_pkey";--> statement-breakpoint
ALTER TABLE "legacy_gate_logs" RENAME CONSTRAINT "gate_logs_leave_id_leaves_id_fk" TO "legacy_gate_logs_leave_id_legacy_leaves_id_fk";--> statement-breakpoint
ALTER TABLE "legacy_gate_logs" RENAME CONSTRAINT "gate_logs_student_id_users_id_fk" TO "legacy_gate_logs_student_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "legacy_gate_logs" RENAME CONSTRAINT "gate_logs_guard_id_users_id_fk" TO "legacy_gate_logs_guard_id_users_id_fk";--> statement-breakpoint

CREATE TABLE "leave_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"hostel_id" integer NOT NULL,
	"student_user_id" integer NOT NULL,
	"student_profile_id" integer NOT NULL,
	"room_allocation_id" integer,
	"reason" text NOT NULL,
	"departure_at" timestamp with time zone NOT NULL,
	"expected_return_at" timestamp with time zone NOT NULL,
	"is_emergency" boolean DEFAULT false NOT NULL,
	"status" "leave_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leave_requests_reason_length_check" CHECK (length(trim("leave_requests"."reason")) between 5 and 1000),
	CONSTRAINT "leave_requests_departure_future_check" CHECK ("leave_requests"."departure_at" > "leave_requests"."created_at"),
	CONSTRAINT "leave_requests_date_order_check" CHECK ("leave_requests"."expected_return_at" > "leave_requests"."departure_at"),
	CONSTRAINT "leave_requests_updated_at_check" CHECK ("leave_requests"."updated_at" >= "leave_requests"."created_at")
);--> statement-breakpoint

CREATE TABLE "leave_decisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"leave_request_id" integer NOT NULL,
	"outcome" "leave_decision_outcome" NOT NULL,
	"decided_by_user_id" integer NOT NULL,
	"actor_name" varchar(255) NOT NULL,
	"actor_role" varchar(50) NOT NULL,
	"note" varchar(1000) NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leave_decisions_leave_request_id_unique" UNIQUE("leave_request_id"),
	CONSTRAINT "leave_decisions_actor_snapshot_check" CHECK (length(trim("leave_decisions"."actor_name")) > 0 and length(trim("leave_decisions"."actor_role")) > 0),
	CONSTRAINT "leave_decisions_note_length_check" CHECK (length(trim("leave_decisions"."note")) between 5 and 1000)
);--> statement-breakpoint

CREATE TABLE "gate_passes" (
	"id" serial PRIMARY KEY NOT NULL,
	"leave_request_id" integer NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"issued_by_user_id" integer NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"pdf_storage_key" varchar(500),
	"revoked_at" timestamp with time zone,
	"revoked_by_user_id" integer,
	"revocation_reason" varchar(1000),
	CONSTRAINT "gate_passes_leave_request_id_unique" UNIQUE("leave_request_id"),
	CONSTRAINT "gate_passes_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "gate_passes_pdf_storage_key_unique" UNIQUE("pdf_storage_key"),
	CONSTRAINT "gate_passes_token_hash_check" CHECK ("gate_passes"."token_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "gate_passes_validity_check" CHECK ("gate_passes"."valid_from" >= "gate_passes"."issued_at" and "gate_passes"."expires_at" > "gate_passes"."valid_from"),
	CONSTRAINT "gate_passes_pdf_storage_key_check" CHECK ("gate_passes"."pdf_storage_key" is null or length(trim("gate_passes"."pdf_storage_key")) > 0),
	CONSTRAINT "gate_passes_revocation_details_check" CHECK (("gate_passes"."revoked_at" is null and "gate_passes"."revoked_by_user_id" is null and "gate_passes"."revocation_reason" is null) or ("gate_passes"."revoked_at" is not null and "gate_passes"."revoked_at" >= "gate_passes"."issued_at" and "gate_passes"."revoked_by_user_id" is not null and length(trim("gate_passes"."revocation_reason")) between 5 and 1000))
);--> statement-breakpoint

CREATE TABLE "leave_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"leave_request_id" integer NOT NULL,
	"event_type" "leave_event_type" NOT NULL,
	"from_status" "leave_status",
	"to_status" "leave_status" NOT NULL,
	"actor_user_id" integer,
	"actor_name" varchar(255) NOT NULL,
	"actor_role" varchar(50) NOT NULL,
	"note" varchar(1000),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leave_events_submitted_state_check" CHECK (("leave_events"."event_type" = 'submitted' and "leave_events"."from_status" is null and "leave_events"."to_status" = 'pending') or ("leave_events"."event_type" <> 'submitted' and "leave_events"."from_status" is not null)),
	CONSTRAINT "leave_events_actor_snapshot_check" CHECK (length(trim("leave_events"."actor_name")) > 0 and length(trim("leave_events"."actor_role")) > 0),
	CONSTRAINT "leave_events_note_not_blank_check" CHECK ("leave_events"."note" is null or length(trim("leave_events"."note")) > 0),
	CONSTRAINT "leave_events_metadata_object_check" CHECK (jsonb_typeof("leave_events"."metadata") = 'object')
);--> statement-breakpoint

CREATE TABLE "gate_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"leave_request_id" integer NOT NULL,
	"gate_pass_id" integer,
	"movement" "gate_movement" NOT NULL,
	"verification_method" "gate_verification_method" NOT NULL,
	"performed_by_user_id" integer NOT NULL,
	"actor_name" varchar(255) NOT NULL,
	"actor_role" varchar(50) NOT NULL,
	"idempotency_key" varchar(100) NOT NULL,
	"note" varchar(1000),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gate_events_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "gate_events_actor_snapshot_check" CHECK (length(trim("gate_events"."actor_name")) > 0 and length(trim("gate_events"."actor_role")) > 0),
	CONSTRAINT "gate_events_idempotency_key_check" CHECK (length(trim("gate_events"."idempotency_key")) between 16 and 100),
	CONSTRAINT "gate_events_pass_required_check" CHECK ("gate_events"."verification_method" = 'override' or "gate_events"."gate_pass_id" is not null),
	CONSTRAINT "gate_events_override_note_check" CHECK ("gate_events"."verification_method" <> 'override' or ("gate_events"."note" is not null and length(trim("gate_events"."note")) between 5 and 1000)),
	CONSTRAINT "gate_events_metadata_object_check" CHECK (jsonb_typeof("gate_events"."metadata") = 'object')
);--> statement-breakpoint

ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_hostel_id_hostels_id_fk" FOREIGN KEY ("hostel_id") REFERENCES "public"."hostels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_student_user_id_users_id_fk" FOREIGN KEY ("student_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_room_allocation_id_room_allocations_id_fk" FOREIGN KEY ("room_allocation_id") REFERENCES "public"."room_allocations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_decisions" ADD CONSTRAINT "leave_decisions_leave_request_id_leave_requests_id_fk" FOREIGN KEY ("leave_request_id") REFERENCES "public"."leave_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_decisions" ADD CONSTRAINT "leave_decisions_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gate_passes" ADD CONSTRAINT "gate_passes_leave_request_id_leave_requests_id_fk" FOREIGN KEY ("leave_request_id") REFERENCES "public"."leave_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gate_passes" ADD CONSTRAINT "gate_passes_issued_by_user_id_users_id_fk" FOREIGN KEY ("issued_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gate_passes" ADD CONSTRAINT "gate_passes_revoked_by_user_id_users_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_events" ADD CONSTRAINT "leave_events_leave_request_id_leave_requests_id_fk" FOREIGN KEY ("leave_request_id") REFERENCES "public"."leave_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_events" ADD CONSTRAINT "leave_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gate_events" ADD CONSTRAINT "gate_events_leave_request_id_leave_requests_id_fk" FOREIGN KEY ("leave_request_id") REFERENCES "public"."leave_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gate_events" ADD CONSTRAINT "gate_events_gate_pass_id_gate_passes_id_fk" FOREIGN KEY ("gate_pass_id") REFERENCES "public"."gate_passes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gate_events" ADD CONSTRAINT "gate_events_performed_by_user_id_users_id_fk" FOREIGN KEY ("performed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "leave_requests_student_status_idx" ON "leave_requests" USING btree ("student_user_id", "status", "departure_at");--> statement-breakpoint
CREATE INDEX "leave_requests_hostel_status_departure_idx" ON "leave_requests" USING btree ("hostel_id", "status", "departure_at");--> statement-breakpoint
CREATE INDEX "leave_requests_outside_return_idx" ON "leave_requests" USING btree ("hostel_id", "expected_return_at") WHERE "leave_requests"."status" = 'exited';--> statement-breakpoint
CREATE INDEX "leave_requests_room_allocation_idx" ON "leave_requests" USING btree ("room_allocation_id");--> statement-breakpoint
CREATE INDEX "leave_decisions_actor_idx" ON "leave_decisions" USING btree ("decided_by_user_id", "decided_at");--> statement-breakpoint
CREATE INDEX "gate_passes_active_expiry_idx" ON "gate_passes" USING btree ("expires_at") WHERE "gate_passes"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "gate_passes_issuer_idx" ON "gate_passes" USING btree ("issued_by_user_id", "issued_at");--> statement-breakpoint
CREATE INDEX "leave_events_timeline_idx" ON "leave_events" USING btree ("leave_request_id", "occurred_at", "id");--> statement-breakpoint
CREATE INDEX "leave_events_actor_idx" ON "leave_events" USING btree ("actor_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gate_events_one_movement_per_leave" ON "gate_events" USING btree ("leave_request_id", "movement");--> statement-breakpoint
CREATE INDEX "gate_events_activity_idx" ON "gate_events" USING btree ("occurred_at", "id");--> statement-breakpoint
CREATE INDEX "gate_events_actor_idx" ON "gate_events" USING btree ("performed_by_user_id", "occurred_at");--> statement-breakpoint

CREATE OR REPLACE FUNCTION validate_leave_request()
RETURNS trigger AS $$
DECLARE
	student_role text;
	profile_user_id integer;
	profile_hostel_id integer;
	allocation_profile_id integer;
	allocation_vacated_at timestamp with time zone;
BEGIN
	IF TG_OP = 'DELETE' THEN
		RAISE EXCEPTION 'Leave requests are retained as operational records' USING ERRCODE = '55000';
	END IF;

	IF TG_OP = 'UPDATE' THEN
		IF ROW(
			NEW."hostel_id", NEW."student_user_id", NEW."student_profile_id",
			NEW."room_allocation_id", NEW."reason", NEW."departure_at",
			NEW."expected_return_at", NEW."is_emergency", NEW."created_at"
		) IS DISTINCT FROM ROW(
			OLD."hostel_id", OLD."student_user_id", OLD."student_profile_id",
			OLD."room_allocation_id", OLD."reason", OLD."departure_at",
			OLD."expected_return_at", OLD."is_emergency", OLD."created_at"
		) THEN
			RAISE EXCEPTION 'Leave request identity and schedule are immutable' USING ERRCODE = '55000';
		END IF;

		IF NEW."status" IS DISTINCT FROM OLD."status" AND NOT (
			(OLD."status" = 'pending' AND NEW."status" IN ('approved', 'rejected')) OR
			(OLD."status" = 'approved' AND NEW."status" IN ('exited', 'expired')) OR
			(OLD."status" = 'exited' AND NEW."status" = 'returned')
		) THEN
			RAISE EXCEPTION 'Invalid leave status transition' USING ERRCODE = '23514';
		END IF;
	END IF;

	SELECT "role"::text INTO student_role
	FROM "users"
	WHERE "id" = NEW."student_user_id";

	SELECT "user_id", "hostel_id" INTO profile_user_id, profile_hostel_id
	FROM "student_profiles"
	WHERE "id" = NEW."student_profile_id";

	IF student_role IS DISTINCT FROM 'student'
		OR profile_user_id IS DISTINCT FROM NEW."student_user_id"
		OR profile_hostel_id IS DISTINCT FROM NEW."hostel_id" THEN
		RAISE EXCEPTION 'Leave request must match one student profile and hostel' USING ERRCODE = '23514';
	END IF;

	IF NEW."room_allocation_id" IS NOT NULL THEN
		SELECT "student_profile_id", "vacated_at"
		INTO allocation_profile_id, allocation_vacated_at
		FROM "room_allocations"
		WHERE "id" = NEW."room_allocation_id";

		IF allocation_profile_id IS DISTINCT FROM NEW."student_profile_id"
			OR (TG_OP = 'INSERT' AND allocation_vacated_at IS NOT NULL) THEN
			RAISE EXCEPTION 'Leave room allocation must be active and belong to the student' USING ERRCODE = '23514';
		END IF;
	END IF;

	RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER leave_requests_guard
BEFORE INSERT OR UPDATE OR DELETE ON "leave_requests"
FOR EACH ROW EXECUTE FUNCTION validate_leave_request();--> statement-breakpoint

CREATE OR REPLACE FUNCTION prevent_leave_history_mutation()
RETURNS trigger AS $$
BEGIN
	RAISE EXCEPTION 'Leave and gate history is immutable' USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER leave_decisions_immutable
BEFORE UPDATE OR DELETE ON "leave_decisions"
FOR EACH ROW EXECUTE FUNCTION prevent_leave_history_mutation();--> statement-breakpoint

CREATE TRIGGER leave_events_immutable
BEFORE UPDATE OR DELETE ON "leave_events"
FOR EACH ROW EXECUTE FUNCTION prevent_leave_history_mutation();--> statement-breakpoint

CREATE TRIGGER gate_events_immutable
BEFORE UPDATE OR DELETE ON "gate_events"
FOR EACH ROW EXECUTE FUNCTION prevent_leave_history_mutation();--> statement-breakpoint

CREATE OR REPLACE FUNCTION validate_gate_event_pass_scope()
RETURNS trigger AS $$
BEGIN
	IF NEW."gate_pass_id" IS NOT NULL AND NOT EXISTS (
		SELECT 1
		FROM "gate_passes"
		WHERE "id" = NEW."gate_pass_id"
			AND "leave_request_id" = NEW."leave_request_id"
	) THEN
		RAISE EXCEPTION 'Gate pass must belong to the same leave request' USING ERRCODE = '23514';
	END IF;

	RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER gate_events_pass_scope_guard
BEFORE INSERT ON "gate_events"
FOR EACH ROW EXECUTE FUNCTION validate_gate_event_pass_scope();
