# Dashboard analytics definitions

Roadmap slice `DASH-01` provides one authenticated endpoint:

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/dashboard` | Return a role-scoped dashboard summary |

The response includes a generation timestamp, the applied scope, metric
definitions, and internal source links. A frontend must treat a failed request
as unavailable data; it must never replace a failure with zero.

## Release 1 definitions

- An open complaint has any current status other than `closed`.
- An SLA breach is an open complaint whose deadline is before `generatedAt`.
- First-resolution reporting continues to use the first `resolved` event.
- A student is outside when a leave is `exited` and has no successful return.
- An overdue return is an outside student past `expectedReturnAt`.
- Mess rating is the arithmetic mean of valid ratings for menu dates in the
  displayed 30-day UTC calendar period. It is `null`, never a fallback score,
  when there are no responses.
- Occupancy is active allocations divided by capacity of active rooms. It is
  `null` when no capacity is configured.
- An admin audit exception is an SLA-breach or gate-override audit event written
  during the preceding 24 hours. This Release 1 definition makes the otherwise
  broad PRD term “audit exception” testable.

## Authorization scopes

- Students receive only their complaints, latest leave/pass, current hostel
  menu, and received notice count.
- Wardens receive aggregates only for hostels in their memberships.
- Maintenance staff receive only active assignments made to their account.
- Guards receive outside and movement data only for assigned hostels.
- Administrators receive institution-wide operational and administration data.

The maintenance summary intentionally excludes student contact details, leave
reasons, and room information. Every returned link is selected by the server
from a fixed internal route list.
