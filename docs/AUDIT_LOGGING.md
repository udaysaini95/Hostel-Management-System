# HostelMate Audit Logging

HostelMate keeps security and workflow history in a dedicated append-only audit
log. The log is separate from feature timelines: a complaint timeline explains
the complaint to its participants, while an audit event records who changed a
sensitive resource for operational review.

## Event structure

Each event stores:

- a stable action and category;
- resource type and resource ID;
- actor user ID plus name, email, and role snapshots;
- a readable description;
- structured, intentionally selected metadata;
- zero or more hostel ID/code snapshots;
- an optional request ID for later observability integration; and
- a timezone-aware creation timestamp.

Actor and hostel labels are snapshots. Events therefore remain understandable
after an account is suspended or a hostel label changes. Polymorphic resources
are stored as type/ID pairs rather than fragile cross-table foreign keys.

Passwords, access tokens, activation tokens, password hashes, SMTP values, raw
request bodies, and unrestricted error objects must never be written to event
metadata.

## Immutability and transaction boundary

The application service exposes insert and search operations only. There are no
HTTP update or delete routes for audit data. PostgreSQL triggers reject `UPDATE`
and `DELETE` statements against both audit events and their hostel scopes.

An audit write runs inside the same database transaction as the protected
business change. If the audit insert fails, the invitation, account-status
change, or student approval also rolls back.

## Events emitted so far

| Action | Resource | Category |
| --- | --- | --- |
| `staff.invitation.created` | Staff invitation | Account |
| `account.status.changed` | User account | Account |
| `student.approval.created` | Approved student | Student |
| `student.approval.revoked` | Approved student | Student |
| `student.approval.reinstated` | Approved student | Student |
| `student.activation.reissued` | Approved student | Student |

Complaint, room, leave, gate, mess, and notice slices will add their event types
when those workflows receive transactional service boundaries. This avoids
recording an audit row separately from a legacy controller update.

## Read API

`GET /api/audit-events` accepts these optional query parameters:

| Parameter | Meaning |
| --- | --- |
| `page` | One-based page number; defaults to `1`. |
| `pageSize` | Items per page from 1 through 100; defaults to `25`. |
| `actorId` | Exact actor user ID. |
| `category` | Exact supported event category. |
| `action` | Exact stable action name. |
| `resourceType` | Exact resource type. |
| `resourceId` | Exact resource identifier. |
| `from` | Inclusive ISO timestamp. |
| `to` | Inclusive ISO timestamp. |

Results are newest first and include `data` plus a `pagination` object containing
`page`, `pageSize`, `total`, and `totalPages`.

## Visibility rules

- Administrators can search every event.
- Wardens can search operational categories only when an event shares one of
  their hostel memberships.
- Guards can search gate events only when the event shares one of their hostel
  memberships.
- Maintenance users can search only events where they are the actor.
- Students and unknown roles are denied.

Filters can narrow these boundaries but can never broaden them.
