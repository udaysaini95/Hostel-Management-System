CREATE OR REPLACE FUNCTION apply_leave_decision()
RETURNS trigger AS $$
DECLARE
	request_status text;
	request_hostel_id integer;
	request_created_at timestamp with time zone;
	staff_name text;
	staff_role text;
	staff_status text;
BEGIN
	SELECT "status"::text, "hostel_id", "created_at"
	INTO request_status, request_hostel_id, request_created_at
	FROM "leave_requests"
	WHERE "id" = NEW."leave_request_id"
	FOR UPDATE;

	IF NOT FOUND THEN
		RAISE EXCEPTION 'Leave request not found'
			USING ERRCODE = '23503',
				CONSTRAINT = 'leave_decisions_leave_request_id_leave_requests_id_fk';
	END IF;

	SELECT "name", "role"::text, "account_status"::text
	INTO staff_name, staff_role, staff_status
	FROM "users"
	WHERE "id" = NEW."decided_by_user_id";

	IF staff_status IS DISTINCT FROM 'active'
		OR staff_role NOT IN ('warden', 'admin') THEN
		RAISE EXCEPTION 'Leave decisions require active authorized staff'
			USING ERRCODE = '42501';
	END IF;

	IF NEW."actor_name" IS DISTINCT FROM staff_name
		OR NEW."actor_role" IS DISTINCT FROM staff_role THEN
		RAISE EXCEPTION 'Leave decision actor snapshot does not match the account'
			USING ERRCODE = '23514',
				CONSTRAINT = 'leave_decisions_actor_identity_check';
	END IF;

	IF staff_role = 'warden' AND NOT EXISTS (
		SELECT 1
		FROM "hostel_memberships"
		WHERE "user_id" = NEW."decided_by_user_id"
			AND "hostel_id" = request_hostel_id
	) THEN
		RAISE EXCEPTION 'Warden is not assigned to the leave hostel'
			USING ERRCODE = '42501';
	END IF;

	IF NEW."decided_at" < request_created_at THEN
		RAISE EXCEPTION 'Leave decision cannot predate the request'
			USING ERRCODE = '23514',
				CONSTRAINT = 'leave_decisions_time_order_check';
	END IF;

	IF request_status = 'pending' THEN
		UPDATE "leave_requests"
		SET "status" = NEW."outcome"::text::leave_status,
			"updated_at" = NEW."decided_at"
		WHERE "id" = NEW."leave_request_id";
	ELSIF NOT (
		(NEW."outcome"::text = 'approved'
			AND request_status IN ('approved', 'exited', 'returned', 'expired'))
		OR (NEW."outcome"::text = 'rejected' AND request_status = 'rejected')
	) THEN
		RAISE EXCEPTION 'Decision outcome does not match leave request status'
			USING ERRCODE = '23514',
				CONSTRAINT = 'leave_decisions_status_match_check';
	END IF;

	RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER leave_decisions_apply_status
BEFORE INSERT ON "leave_decisions"
FOR EACH ROW EXECUTE FUNCTION apply_leave_decision();
