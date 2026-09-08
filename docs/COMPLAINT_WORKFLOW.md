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

Only an active maintenance account with membership in the complaint hostel can
be assigned. A warden can act only inside their hostel memberships; an
administrator can work across hostels. Reassignment requires a reason and ends
the previous row instead of overwriting it.

## History and attachments

Assignments are historical rows with an optional end time. A partial unique
index allows only one active assignment for each complaint. Timeline events are
append-only and store actor name and role snapshots. PostgreSQL rejects updates
and deletes to those events.

Attachments store a private `storage_key`, original filename, MIME type, size,
and SHA-256 checksum. No public URL is stored. FILE-01 keeps uploaded bytes
outside the public `/uploads` directory and authorizes every list, download,
and delete request before reading the file.

JPEG, PNG, and WebP are the only accepted formats. Both the declared MIME type
and the file signature are checked, each image is limited to 5 MB, and a
complaint may have up to five submission images. Generated storage names do not
contain the user-supplied filename. Resolution evidence uses the same limits
and allows up to five historical images across reopen cycles.

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
| `GET` | `/api/complaints/assignees?hostelCode=H1` | List active maintenance staff and workloads for an authorized hostel |
| `GET` | `/api/complaints/work-queue` | Paginate the current maintenance user's active assignments |
| `POST` | `/api/complaints/:id/assignments` | Assign or reassign a complaint |
| `POST` | `/api/complaints/:id/start` | Let the active maintenance assignee start work |
| `POST` | `/api/complaints/:id/resolve` | Resolve assigned work with a note and optional private image |
| `POST` | `/api/complaints/:id/verification` | Let the reporting student close or reopen a resolution |
| `GET` | `/api/complaints/:id` | Read an authorized complaint and its timeline |
| `POST` | `/api/complaints/:id/attachments` | Upload one private image using the multipart field `file` |
| `GET` | `/api/complaints/:id/attachments` | List authorized attachment metadata |
| `GET` | `/api/complaints/:id/attachments/:attachmentId` | View an authorized private image |
| `DELETE` | `/api/complaints/:id/attachments/:attachmentId` | Delete an allowed attachment |

Create requests accept `categoryCode`, `location`, `description`, optional
`requestedPriority`, optional `roomId`, and—for staff—`hostelCode`. They never
accept an SLA deadline. Student hostel and profile ownership come from the
authenticated account, not from request data.

List endpoints return `{ data, pagination }`. Supported filters are `search`,
`hostelCode`, `categoryCode`, `status`, `priority`, `slaState`, `createdFrom`,
and `createdTo`. Date filters use ISO timestamps. The supported sort fields are
`createdAt`, `updatedAt`, `slaDeadline`, and `priority`. Complaint lists default
to the latest update first. Page sizes are capped at 100 records.

Assignment requests contain `assigneeUserId` and an optional `reason`. A reason
is mandatory when an active assignee is replaced. Initial assignment changes
the complaint from `created` to `assigned`; reassignment keeps an `assigned` or
`in_progress` complaint in its current state. Both operations append timeline
and audit events. PostgreSQL advisory locking and the unique active-assignment
index prevent concurrent requests from creating two active assignees.

The maintenance queue includes only the authenticated technician's active
assignments. It defaults to critical-first ordering, then earliest SLA deadline,
and supports priority, status, SLA, category, hostel, search, creation-date,
sorting, and pagination filters. Resolved and closed complaints are treated as
completed for SLA calculations.

Only the active maintenance assignee can move `assigned` work to `in_progress`
or resolve `in_progress` work. Resolution requires a 10–1000 character note.
The resolve route accepts `multipart/form-data`: `resolutionNote` is required
and one `file` image is optional. Resolution evidence is private, checksum
verified, and linked to the immutable `resolved` timeline event.

Only the student who originally reported the complaint can use the verification
route. `{ "action": "close" }` confirms the work and ends the active assignment.
`{ "action": "reopen", "reason": "..." }` returns it to `in_progress`; the
reason is required and the same active technician remains responsible. Every
successful transition appends both a participant-facing timeline event and an
operational audit event. Invalid or repeated transitions return a conflict and
leave the complaint unchanged.

The reporter may add or remove submission evidence only while the complaint is
in `created`. This freezes student evidence when staff work begins. Authorized
hostel wardens can view evidence but cannot erase it; an active assignee can
view it, and administrators can remove it when moderation is necessary. Added
and deleted files create audit events. A SHA-256 check also prevents corrupted
stored bytes from being served.

`PRIVATE_FILE_STORAGE_PATH` optionally selects the private storage directory.
Development defaults to `Backend/private-storage`, which is ignored by Git. A
deployment should mount durable private storage at that path; the storage
adapter can later be replaced with a managed object-store implementation
without changing the complaint API.

The old named endpoints remain temporarily connected to the legacy tables and
the public `/uploads` directory so the current frontend is usable. They will be
removed after the complaint UI is moved to this contract in CMP-05.
