CREATE OR REPLACE FUNCTION validate_gate_event_pass_scope()
RETURNS trigger AS $$
DECLARE
	pass_leave_id integer;
	pass_valid_from timestamp with time zone;
	pass_expires_at timestamp with time zone;
	pass_revoked_at timestamp with time zone;
	request_status text;
	request_hostel_id integer;
	staff_name text;
	staff_role text;
	staff_status text;
	next_status text;
BEGIN
	IF NEW."gate_pass_id" IS NULL OR NEW."verification_method"::text = 'override' THEN
		RAISE EXCEPTION 'A verified gate pass is required for standard movement'
			USING ERRCODE = '23514',
				CONSTRAINT = 'gate_events_verified_pass_check';
	END IF;

	SELECT gp."leave_request_id", gp."valid_from", gp."expires_at", gp."revoked_at",
		lr."status"::text, lr."hostel_id"
	INTO pass_leave_id, pass_valid_from, pass_expires_at, pass_revoked_at,
		request_status, request_hostel_id
	FROM "gate_passes" gp
	JOIN "leave_requests" lr ON lr."id" = gp."leave_request_id"
	WHERE gp."id" = NEW."gate_pass_id"
	FOR UPDATE OF lr;

	IF pass_leave_id IS NULL OR pass_leave_id IS DISTINCT FROM NEW."leave_request_id" THEN
		RAISE EXCEPTION 'Gate pass must belong to the same leave request'
			USING ERRCODE = '23514',
				CONSTRAINT = 'gate_events_pass_scope_check';
	END IF;

	SELECT "name", "role"::text, "account_status"::text
	INTO staff_name, staff_role, staff_status
	FROM "users"
	WHERE "id" = NEW."performed_by_user_id";

	IF staff_status IS DISTINCT FROM 'active'
		OR staff_role NOT IN ('guard', 'admin') THEN
		RAISE EXCEPTION 'Gate movement actor is not authorized'
			USING ERRCODE = '42501';
	END IF;

	IF NEW."actor_name" IS DISTINCT FROM staff_name
		OR NEW."actor_role" IS DISTINCT FROM staff_role THEN
		RAISE EXCEPTION 'Gate movement actor snapshot is invalid'
			USING ERRCODE = '23514',
				CONSTRAINT = 'gate_events_actor_identity_check';
	END IF;

	IF staff_role = 'guard' AND NOT EXISTS (
		SELECT 1 FROM "hostel_memberships"
		WHERE "user_id" = NEW."performed_by_user_id"
			AND "hostel_id" = request_hostel_id
	) THEN
		RAISE EXCEPTION 'Guard is outside the leave hostel'
			USING ERRCODE = '42501';
	END IF;

	IF pass_revoked_at IS NOT NULL
		OR NEW."occurred_at" < pass_valid_from
		OR NEW."occurred_at" >= pass_expires_at THEN
		RAISE EXCEPTION 'Gate pass is not active at the movement time'
			USING ERRCODE = '23514',
				CONSTRAINT = 'gate_events_active_pass_check';
	END IF;

	IF NEW."movement"::text = 'exit' AND request_status = 'approved' THEN
		next_status := 'exited';
	ELSIF NEW."movement"::text = 'return' AND request_status = 'exited' THEN
		next_status := 'returned';
	ELSE
		RAISE EXCEPTION 'Gate movement does not match the current leave state'
			USING ERRCODE = '23514',
				CONSTRAINT = 'gate_events_movement_state_check';
	END IF;

	UPDATE "leave_requests"
	SET "status" = next_status::"leave_status", "updated_at" = NEW."occurred_at"
	WHERE "id" = NEW."leave_request_id";

	RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
