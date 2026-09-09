# Notice workflow

This document describes the backend contract introduced by roadmap slice
`NOT-01`. The notice screens are implemented separately in `NOT-03`.

## Audience rules

A published notice has exactly one audience:

- `all_residents`: every active account with a student profile. Admin only.
- `role`: every active account with the selected system role. Admin only.
- `hostel`: active users assigned to one hostel.
- `block`: active students whose current room belongs to one hostel block.

Administrators may use every audience. Wardens may use only `hostel` and
`block`, and the target hostel must be one of their current assignments.

Recipients are written in the same transaction as the notice. The audience is
therefore a publication-time snapshot: moving a student later does not rewrite
which notices they previously received.

## Read state and expiry

Each recipient starts unread. The first read writes `read_at`; repeated reads
return the original timestamp and do not create another record. Active inbox
queries exclude notices whose expiry has been reached. Historical queries can
still include expired notices.

Published notices and their recipient list are immutable. PostgreSQL triggers
also enforce publisher scope, audience membership, and the one-way unread to
read change.

## API

All endpoints require an authenticated active account.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/notices` | Publish a notice and materialize its recipients |
| `GET` | `/api/notices/mine` | List the caller's active or historical notices |
| `GET` | `/api/notices/unread-count` | Count active unread notices |
| `PATCH` | `/api/notices/:id/read` | Mark one received notice as read |
| `GET` | `/api/notices/managed` | List notices visible to a warden/admin publisher |

Publishing creates an immutable `notice.published` audit event. Hostel and
block notices also attach a hostel snapshot to that event.
