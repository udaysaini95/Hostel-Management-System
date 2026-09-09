# In-app notification workflow

Roadmap slice `NOT-02` adds durable notifications for important workflow
changes. The notification center interface is implemented separately in
`NOT-03`.

## Generated events

| Event | Recipient | Authorized destination |
| --- | --- | --- |
| Complaint reported | Wardens assigned to the complaint hostel | `/admin/complaints` |
| Complaint assigned | Assigned maintenance staff member | `/maintenance/work-orders` |
| Complaint resolved | Reporting student | `/student/complaints/:id` |
| Leave submitted | Wardens assigned to the resident hostel | `/admin/leaves` |
| Leave approved/rejected | Student who submitted the leave | `/student/leaves` |
| Gate exit/return | Student named on the gate pass | `/student/leaves` |
| Important or urgent notice | Materialized notice recipients | `/notices` |

Links are created by the server from a fixed destination map. Workflow code
cannot store an arbitrary URL. PostgreSQL also validates the recipient role,
resource type, exact path, and access to the referenced record. For example, a
student complaint notification must point to a complaint reported by that same
student, and a warden notification must reference one of their hostels.

## Delivery and idempotency

Notifications are inserted inside the same database transaction as the
workflow event. Each event and recipient pair has a unique deduplication key,
so a retried or replayed operation cannot create duplicates. Inactive accounts
are skipped.

Every notification starts unread. The first read timestamp is immutable, and
the recipient list, message, resource, and link cannot be edited or deleted.

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/notifications` | List the signed-in user's notifications |
| `GET` | `/api/notifications/unread-count` | Return the user's unread count |
| `PATCH` | `/api/notifications/:id/read` | Mark one owned notification as read |
| `PATCH` | `/api/notifications/read-all` | Mark every unread notification as read |
