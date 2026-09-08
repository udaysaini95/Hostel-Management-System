ALTER TABLE "gate_passes"
ADD COLUMN "qr_storage_key" varchar(500);--> statement-breakpoint

ALTER TABLE "gate_passes"
ADD CONSTRAINT "gate_passes_qr_storage_key_unique" UNIQUE("qr_storage_key");--> statement-breakpoint

ALTER TABLE "gate_passes"
ADD CONSTRAINT "gate_passes_qr_storage_key_check"
CHECK ("qr_storage_key" is null or length(trim("qr_storage_key")) > 0);--> statement-breakpoint

CREATE OR REPLACE FUNCTION validate_gate_pass_write()
RETURNS trigger AS $$
DECLARE
	request_status text;
	request_hostel_id integer;
	request_departure_at timestamp with time zone;
	request_return_at timestamp with time zone;
	issuer_role text;
	issuer_status text;
BEGIN
	IF TG_OP = 'DELETE' THEN
		RAISE EXCEPTION 'Gate passes are retained as security records'
			USING ERRCODE = '55000';
	END IF;

	IF TG_OP = 'UPDATE' THEN
		IF ROW(
			NEW."leave_request_id", NEW."token_hash", NEW."issued_by_user_id",
			NEW."issued_at", NEW."valid_from", NEW."expires_at",
			NEW."qr_storage_key", NEW."pdf_storage_key"
		) IS DISTINCT FROM ROW(
			OLD."leave_request_id", OLD."token_hash", OLD."issued_by_user_id",
			OLD."issued_at", OLD."valid_from", OLD."expires_at",
			OLD."qr_storage_key", OLD."pdf_storage_key"
		) THEN
			RAISE EXCEPTION 'Gate pass identity and artifacts are immutable'
				USING ERRCODE = '55000';
		END IF;

		RETURN NEW;
	END IF;

	SELECT "status"::text, "hostel_id", "departure_at", "expected_return_at"
	INTO request_status, request_hostel_id, request_departure_at, request_return_at
	FROM "leave_requests"
	WHERE "id" = NEW."leave_request_id";

	SELECT "role"::text, "account_status"::text
	INTO issuer_role, issuer_status
	FROM "users"
	WHERE "id" = NEW."issued_by_user_id";

	IF request_status NOT IN ('approved', 'exited', 'returned', 'expired') THEN
		RAISE EXCEPTION 'Gate passes require approved leave'
			USING ERRCODE = '23514',
				CONSTRAINT = 'gate_passes_approved_leave_check';
	END IF;

	IF issuer_status IS DISTINCT FROM 'active'
		OR issuer_role NOT IN ('warden', 'admin') THEN
		RAISE EXCEPTION 'Gate pass issuer is not authorized'
			USING ERRCODE = '42501';
	END IF;

	IF issuer_role = 'warden' AND NOT EXISTS (
		SELECT 1 FROM "hostel_memberships"
		WHERE "user_id" = NEW."issued_by_user_id"
			AND "hostel_id" = request_hostel_id
	) THEN
		RAISE EXCEPTION 'Gate pass issuer is outside the leave hostel'
			USING ERRCODE = '42501';
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM "leave_decisions"
		WHERE "leave_request_id" = NEW."leave_request_id"
			AND "outcome" = 'approved'
			AND "decided_by_user_id" = NEW."issued_by_user_id"
	) THEN
		RAISE EXCEPTION 'Gate pass must match its approval decision'
			USING ERRCODE = '23514',
				CONSTRAINT = 'gate_passes_approval_decision_check';
	END IF;

	IF NEW."valid_from" < request_departure_at
		OR NEW."expires_at" IS DISTINCT FROM request_return_at THEN
		RAISE EXCEPTION 'Gate pass validity must match the approved leave window'
			USING ERRCODE = '23514',
				CONSTRAINT = 'gate_passes_leave_window_check';
	END IF;

	IF NEW."qr_storage_key" IS NULL OR NEW."pdf_storage_key" IS NULL THEN
		RAISE EXCEPTION 'Gate pass requires private QR and PDF artifacts'
			USING ERRCODE = '23514',
				CONSTRAINT = 'gate_passes_artifacts_required_check';
	END IF;

	RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER gate_passes_write_guard
BEFORE INSERT OR UPDATE OR DELETE ON "gate_passes"
FOR EACH ROW EXECUTE FUNCTION validate_gate_pass_write();
