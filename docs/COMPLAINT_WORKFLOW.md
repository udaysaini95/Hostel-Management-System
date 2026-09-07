# Complaint workflow

This document is the implementation contract for the maintenance complaint
module introduced in CMP-01.

## State model

```text
created -> assigned -> in_progress -> resolved -> closed
                        ^                |
                        |---- reopen ----|
```

`closed` is terminal. A resident reviews a resolved complaint and either closes
it or reopens it with a reason. Reassignment does not invent another state: the
old assignment is ended, a new assignment is appended, and the complaint stays
`assigned` or `in_progress` as appropriate.

## Priority and SLA

The submitted priority is only a request. The server chooses the authoritative
priority and copies the applicable SLA duration into `sla_policy_minutes` when
the complaint is created. The deadline is then calculated from server time.
Keeping the duration snapshot makes historical reports correct if category
policies change later.

| Priority | Initial SLA |
| --- | ---: |
| Critical | 2 hours |
| High | 12 hours |
| Medium | 48 hours |
| Low | 7 days |

The default categories are electrical, plumbing, furniture, internet, cleaning,
and other. Category settings are data, rather than strings embedded in request
handlers, so an administration screen can manage them in a later P1 slice.

## Ownership and hostel boundaries

Every complaint stores its hostel and reporting user explicitly. Student
complaints must point to the reporting student's profile. Room references and
staff actions must remain inside the same hostel. Wardens assign work;
maintenance staff receive assignments. Administrators may operate across
hostels.

## History and attachments

Assignments are historical rows with an optional end time. A partial unique
index allows only one active assignment for each complaint. Timeline events are
append-only and store actor name and role snapshots. PostgreSQL rejects updates
and deletes to those events.

Attachments store a private `storage_key`, original filename, MIME type, size,
and SHA-256 checksum. No public URL is stored. The API must authorize each
download before reading the object; that endpoint is part of a later complaint
slice.

## Staged migration

CMP-01 renames the original tables to `legacy_complaints` and
`legacy_complaint_timelines`, preserving their rows and keeping the existing UI
usable. CMP-02 adds normalized creation and read APIs beside those compatibility
routes. The frontend complaint slices will switch screens to the new contract
before the legacy tables and handlers are retired.

## Normalized API

All routes below require a valid access token.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/complaints` | Create a complaint without an attachment |
| `GET` | `/api/complaints/categories` | List active category policies |
| `GET` | `/api/complaints/mine` | Paginate complaints reported by the current user |
| `GET` | `/api/complaints/managed` | Paginate a warden/admin hostel-scoped queue |
| `GET` | `/api/complaints/:id` | Read an authorized complaint and its timeline |

Create requests accept `categoryCode`, `location`, `description`, optional
`requestedPriority`, optional `roomId`, and—for staff—`hostelCode`. They never
accept an SLA deadline. Student hostel and profile ownership come from the
authenticated account, not from request data.

List endpoints return `{ data, pagination }`. Supported filters are `search`,
`hostelCode`, `categoryCode`, `status`, `priority`, and `slaState`. The supported
sort fields are `createdAt`, `slaDeadline`, and `priority`. Page sizes are capped
at 100 records.

The old named endpoints remain temporarily connected to the legacy tables so
the current frontend is usable. They will be removed after the complaint UI is
moved to this contract. Attachment upload is intentionally deferred to FILE-01,
where storage and downloads will be private and authorized.
