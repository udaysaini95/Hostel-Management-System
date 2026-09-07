CREATE OR REPLACE FUNCTION validate_complaint_assignment()
RETURNS trigger AS $$
DECLARE
	complaint_hostel_id integer;
	assignee_role text;
	assigner_role text;
	ending_actor_role text;
BEGIN
	SELECT "hostel_id" INTO complaint_hostel_id
	FROM "complaints"
	WHERE "id" = NEW."complaint_id";

	IF TG_OP = 'INSERT' THEN
		SELECT "role"::text INTO assignee_role
		FROM "users"
		WHERE "id" = NEW."assignee_user_id";

		SELECT "role"::text INTO assigner_role
		FROM "users"
		WHERE "id" = NEW."assigned_by_user_id";

		IF assignee_role IS DISTINCT FROM 'maintenance' THEN
			RAISE EXCEPTION 'Complaint assignee must have the maintenance role' USING ERRCODE = '23514';
		END IF;

		IF assigner_role NOT IN ('warden', 'admin') THEN
			RAISE EXCEPTION 'Only wardens and administrators may assign complaints' USING ERRCODE = '23514';
		END IF;

		IF NOT EXISTS (
			SELECT 1 FROM "hostel_memberships"
			WHERE "user_id" = NEW."assignee_user_id"
				AND "hostel_id" = complaint_hostel_id
		) THEN
			RAISE EXCEPTION 'Complaint assignee must belong to the complaint hostel' USING ERRCODE = '23514';
		END IF;

		IF assigner_role = 'warden' AND NOT EXISTS (
			SELECT 1 FROM "hostel_memberships"
			WHERE "user_id" = NEW."assigned_by_user_id"
				AND "hostel_id" = complaint_hostel_id
		) THEN
			RAISE EXCEPTION 'Assigning warden must belong to the complaint hostel' USING ERRCODE = '23514';
		END IF;
	ELSE
		IF NEW."complaint_id" IS DISTINCT FROM OLD."complaint_id"
			OR NEW."assignee_user_id" IS DISTINCT FROM OLD."assignee_user_id"
			OR NEW."assigned_by_user_id" IS DISTINCT FROM OLD."assigned_by_user_id"
			OR NEW."assigned_at" IS DISTINCT FROM OLD."assigned_at" THEN
			RAISE EXCEPTION 'Assignment identity and start details are immutable' USING ERRCODE = '55000';
		END IF;

		IF OLD."ended_at" IS NOT NULL AND ROW(
			NEW."ended_at",
			NEW."ended_by_user_id",
			NEW."end_reason"
		) IS DISTINCT FROM ROW(
			OLD."ended_at",
			OLD."ended_by_user_id",
			OLD."end_reason"
		) THEN
			RAISE EXCEPTION 'A completed assignment cannot be changed' USING ERRCODE = '55000';
		END IF;
	END IF;

	IF NEW."ended_by_user_id" IS NOT NULL THEN
		SELECT "role"::text INTO ending_actor_role
		FROM "users"
		WHERE "id" = NEW."ended_by_user_id";

		IF ending_actor_role NOT IN ('warden', 'admin') THEN
			RAISE EXCEPTION 'Only wardens and administrators may end assignments' USING ERRCODE = '23514';
		END IF;

		IF ending_actor_role = 'warden' AND NOT EXISTS (
			SELECT 1 FROM "hostel_memberships"
			WHERE "user_id" = NEW."ended_by_user_id"
				AND "hostel_id" = complaint_hostel_id
		) THEN
			RAISE EXCEPTION 'Ending warden must belong to the complaint hostel' USING ERRCODE = '23514';
		END IF;
	END IF;

	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
