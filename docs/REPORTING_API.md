# Operational reporting API

Roadmap slice `RPT-01` adds four read-only reporting endpoints:

| Method | Route | Period field |
| --- | --- | --- |
| `GET` | `/api/reports/complaints` | Complaint creation time |
| `GET` | `/api/reports/leaves` | Leave submission time |
| `GET` | `/api/reports/gate` | Movement occurrence time |
| `GET` | `/api/reports/mess` | Menu calendar date |

Every response contains the report generation time, inclusive UTC period,
applied filters, authorization scope, metric definitions, summary, source rows,
and pagination metadata. The default period is the previous 30 UTC days and a
request cannot span more than 366 days.

## Authorization and hostel scope

- Administrators can report across the institution or select one hostel.
- Wardens can report only across their assigned hostels or select one of them.
- Students, maintenance staff, and guards do not have bulk-report permission.
- Requesting an unassigned hostel returns a permission error instead of an
  empty report that could hide an authorization mistake.

## Supported filters

All endpoints accept `from`, `to`, `hostelId`, `page`, and `pageSize`.
Report-specific filters are:

- Complaints: `status`, `priority`.
- Leaves: `status`, `emergency` (`true` or `false`).
- Gate: `movement` (`exit` or `return`).
- Mess: `mealType`.

Unknown or report-irrelevant query parameters are rejected.

## Calculation rules

- Current complaint SLA breach uses the PRD definition: a complaint that is
  not closed and whose deadline is before report generation time.
- First-resolution time uses the first persisted `resolved` complaint event.
- Resolution compliance is calculated only among complaints with a first
  resolution and compares that event with the complaint SLA deadline.
- Reopens count persisted `reopened` events separately.
- Leave duration is requested departure to expected return.
- Gate totals use persisted successful movement events. Override totals use
  the persisted `override` verification method.
- Mess averages are arithmetic means. A period with no valid ratings returns
  `null`, never a default rating.

The endpoints return JSON only. CSV/PDF generation and the reports interface
belong to the following `RPT-02` slice.
