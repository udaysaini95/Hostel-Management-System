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
usable. CMP-02 will move complaint creation and reads to the normalized model.
Later complaint slices will move every remaining handler before the legacy
tables are retired.
