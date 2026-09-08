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

## Authoritative gate verification

GATE-01 adds `POST /api/gate/passes/verify` for active guards and
administrators. The body contains one `credential`, which may be the complete
manual token printed on the PDF or the `hostelmate://gate-pass/...` value read
from its QR code. The legacy `/api/gate/verify` endpoint remains temporarily
available to the old frontend and is not part of the normalized workflow.

Verification hashes the supplied token before looking it up. The service then
checks the staff account, guard hostel membership, student account, hostel,
revocation, leave state, start time, and expiry against current database data.
An unknown token and a token from another guard's hostel produce the same
not-found result.

The response exposes only the student's name, roll number, room, hostel, pass
window, and current leave state. It never returns the credential or its hash.
Exactly one `permittedAction` is returned: `exit` for an active approved leave,
`return` for an active exited leave, or `null` for every invalid condition.
Verification is read-only; transactional movement logging belongs to GATE-02.

## Transactional gate movements

GATE-02 adds `POST /api/gate/passes/movements`. The request contains the pass
`credential`, the `action` shown by verification (`exit` or `return`), a unique
`idempotencyKey`, and an optional note. The action is not trusted: the server
locks the leave row, verifies the credential again, derives the currently
permitted action, and rejects any mismatch.

The gate event insert changes the leave state through a PostgreSQL trigger.
The gate event, state change, leave timeline entry, and audit record then commit
in one transaction. A failure in any part rolls back every part. PostgreSQL
also verifies the current staff identity, guard hostel membership, pass scope,
revocation, validity window, and state transition for direct database writes.

Retries with the same idempotency key, pass, actor, and action return the
original movement with `replayed: true`. Concurrent scans serialize on the
leave row, so they cannot create duplicate events. Reusing a key for another
pass, actor, or action is rejected. Sending a second `exit` with a new key after
the first exit is also rejected because the authoritative next action is now
`return`.

## Gate operations and exceptions

GATE-03 adds four normalized operational endpoints:

- `GET /api/gate/outside` returns the paginated outside roster. It includes
  the student, room, hostel, actual exit time, expected return, and a derived
  overdue flag. Staff can filter by hostel, overdue state, or student search.
- `GET /api/gate/movements` returns paginated gate history with the actor,
  student, movement, verification method, time, and note. Movement, time,
  hostel, and override filters are available.
- `POST /api/gate/passes/expire` changes unused approved passes whose window
  has ended to `expired` in bounded batches and writes timeline and audit
  records.
- `POST /api/gate/overrides` records an exceptional exit or return after a
  scanner or pass problem. A meaningful reason and idempotency key are
  required.

Outside and history reads are available to active guards, wardens, and
administrators. Guards and wardens see only hostels assigned through their
memberships; administrators see all hostels.

An override is deliberately more restricted than an ordinary gate scan. Only
an active warden assigned to the leave hostel or an administrator may create
one. It bypasses pass availability and timing, but it does not bypass the leave
state machine: an exit still requires `approved`, and a return still requires
`exited`. The reason is copied to both immutable history and audit records, and
the movement history exposes `isOverride: true` for prominent UI treatment.

Pass verification already treats an elapsed validity window as expired even
before the batch endpoint persists that state. This means a delayed expiry job
cannot make an old pass usable.
