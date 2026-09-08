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
  Validity, expiry, optional private PDF storage key, and revocation details are
  explicit.
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

No normalized leave API is introduced in LEV-01. LEV-02 will add validated
student application endpoints and transactional overlap detection. Later slices
will migrate decisions, secure pass issuance, gate verification, movement
logging, and the frontend before the legacy tables are retired.
