CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint

-- Half-open ranges allow one leave to begin exactly when another one ends.
-- PostgreSQL exclusion constraints also protect simultaneous direct inserts.
ALTER TABLE "leave_requests"
ADD CONSTRAINT "leave_requests_no_active_overlap"
EXCLUDE USING gist (
	"student_user_id" WITH =,
	tstzrange("departure_at", "expected_return_at", '[)') WITH &&
)
WHERE ("status" IN ('pending', 'approved', 'exited'));
