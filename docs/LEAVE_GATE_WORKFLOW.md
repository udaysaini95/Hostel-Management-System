# Leave and gate workflow

This document is the implementation contract for the normalized leave and gate
foundation introduced in LEV-01.

## State model

```text
pending -> rejected
   |
   +----> approved -> exited -> returned
              |
              +----> expired
```

`rejected`, `returned`, and `expired` are terminal states. A request cannot skip
approval and move directly from `pending` to `exited`. PostgreSQL and the domain
model both enforce the same transitions.

An overdue return is not another stored status. It is derived when a request is
still `exited` and `expected_return_at` is earlier than current server time.
This keeps movement state and time-based risk separate.

## Normalized records

The workflow deliberately separates records with different responsibilities:

- `leave_requests` stores the student, hostel, optional room-allocation
  snapshot, reason, departure time, expected return time, emergency flag, and
  current state.
- `leave_decisions` stores one immutable approval or rejection with the deciding
  user, actor snapshot, note, and timestamp.
- `gate_passes` stores one pass per approved request. Only a SHA-256 token hash
  is persisted; neither a sequential ID nor a raw bearer token is a credential.
  Validity, expiry, required private QR/PDF storage keys, and revocation details
  are explicit.
- `leave_events` is the append-only student and staff timeline.
- `gate_events` is append-only movement history. Each request can have only one
  exit and one return, and every event has a unique idempotency key for safe
  request retries.

All operational times use timezone-aware PostgreSQL timestamps. The API should
accept ISO 8601 timestamps with offsets and return UTC ISO timestamps. The UI
may render local time, but it must label the applicable timezone.

## Database integrity

PostgreSQL rejects:

- departures that are not later than request creation;
- expected returns that are not later than departure;
- a student account, profile, hostel, or room allocation that does not match;
- edits to the request identity or travel schedule after submission;
- skipped or reversed state transitions;
- mutation or deletion of decisions and event history;
- malformed pass-token hashes or invalid pass windows;
- QR/manual gate events without a pass;
- overrides without a reason;
- duplicate exit or return movements for one request; and
- gate events whose pass belongs to another leave request.

Foreign keys use `restrict` for operational history. Leave requests are retained
instead of deleted so decisions, issued passes, movements, and future audit
records remain explainable.

## Staged migration

Migration `0010_leave_gate_foundation` renames the current `leaves` and
`gate_logs` tables to `legacy_leaves` and `legacy_gate_logs`. Existing rows are
preserved, and the current frontend remains connected to those compatibility
tables.

LEV-02 adds `POST /api/leave` for normalized student submissions. The endpoint
accepts `reason`, timezone-aware `departureAt` and `expectedReturnAt` values, and
an optional `isEmergency` flag. Student, hostel, profile, and room-allocation
identifiers are always derived from the authenticated account.

Overlap detection treats time ranges as half-open intervals: a leave ending at
10:00 and another beginning at 10:00 do not conflict. Pending, approved, and
exited requests block overlapping submissions. A per-student PostgreSQL
transaction lock protects concurrent API requests, and a PostgreSQL exclusion
constraint applies the same rule to writes outside the API. Override behavior
is intentionally deferred to the authorized exception workflow in LEV-11.

The legacy application endpoint remains available for the existing frontend.
Later slices will migrate decisions, secure pass issuance, gate verification,
movement logging, and the frontend before the compatibility tables are retired.

## Staff decisions

LEV-03 adds `POST /api/leave/:id/decision` for wardens and administrators. The
body contains an `outcome` of `approved` or `rejected` and a required decision
`note`. Wardens can decide requests only for hostels in their memberships;
administrators can decide across the institution.

Only pending requests can be decided. PostgreSQL locks the request while
validating the decision, verifies the staff snapshot and hostel scope, and
applies the matching status.

## Secure gate-pass issuance

PASS-01 extends approval so the decision, status change, pass record, timeline,
and audit records share one database transaction. Approval also creates a QR
image and PDF in private file storage. If rendering or storage fails, the
database transaction rolls back and any partial files are removed, leaving the
request pending so staff can retry safely.

The raw 256-bit token exists only inside the private QR/PDF artifacts. The
database stores its SHA-256 hash, and API responses expose only pass metadata
and authenticated download URLs. Token collisions are retried without using a
sequential or predictable fallback. The pass begins at the later of approval
or planned departure and expires at the approved expected-return time.

Authenticated pass endpoints are:

- `GET /api/leave/:id/pass` for safe pass metadata;
- `GET /api/leave/:id/pass/qr` for the private QR image; and
- `GET /api/leave/:id/pass/pdf` for the private PDF download.

Students can access only their own pass. Wardens and guards are limited to
their assigned hostels, administrators can access every hostel, and maintenance
accounts have no pass access. Out-of-scope IDs return the same not-found result
as unknown IDs to avoid leaking another hostel's records.
