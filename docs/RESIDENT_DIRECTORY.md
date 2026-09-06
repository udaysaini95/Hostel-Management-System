# Resident Directory API

The resident directory is a read-only operational view for administrators and
wardens. It reads normalized student profiles and current room allocations; it
does not use the legacy room string on the user account.

## Endpoint

```http
GET /api/residents
Authorization: Bearer <access-token>
```

Supported query parameters:

| Parameter | Meaning |
| --- | --- |
| `page` | One-based page number; defaults to `1`. |
| `pageSize` | Items per page from 1 through 100; defaults to `20`. |
| `search` | Case-insensitive partial name, email, or roll-number search. |
| `hostelCode` | Exact normalized hostel code, such as `H1`. |
| `blockCode` | Exact normalized block code, such as `A`. |
| `roomNumber` | Exact normalized room number, such as `101`. |
| `accountStatus` | `pending`, `active`, or `suspended`. |

Results are ordered by student name and then roll number. The response contains
`data` and a `pagination` object with `page`, `pageSize`, `total`, and
`totalPages`.

Each result includes the student's user ID, name, email, roll number, phone,
account status, hostel, profile-completion state, and current allocation. An
unallocated student has `currentAllocation: null`.

## Authorization and hostel scope

- Administrators can search residents across all hostels.
- Wardens can search only residents whose profile hostel matches one of the
  warden's explicit `hostel_memberships` records.
- A hostel filter can narrow a warden's scope but can never broaden it. Asking
  for an unassigned hostel returns an empty page.
- Students, guards, maintenance staff, inactive accounts, missing accounts, and
  stale role claims are denied.

The service reloads the requesting account role and status from PostgreSQL. It
does not treat the role embedded in an otherwise valid older access token as
current authority.

## Privacy boundary

Directory rows deliberately omit guardian name and guardian phone, password
hashes, tokens, prior room allocations, and internal profile IDs. Students use
the separate own-profile endpoint and cannot call this directory route.
