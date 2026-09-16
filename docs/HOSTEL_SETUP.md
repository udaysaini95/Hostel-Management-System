# Hostel setup

HostelMate is currently a single-institution system with multiple hostel
buildings. Administrators create the buildings before onboarding students,
creating rooms, or assigning staff.

## Data model

Each hostel has a permanent unique code, unique name, optional address,
resident type, and active status. Supported resident types are `boys`, `girls`,
and `co_ed`. The UI presents these as Boys hostel, Girls hostel, and Co-ed
hostel.

The code is deliberately immutable after creation because imports,
administrative searches, and audit descriptions use it as a recognizable
institutional identifier. Hostels are deactivated rather than deleted so their
historical complaints, leaves, menus, notices, and audit records remain valid.

Changing the resident type is blocked after student profiles exist. Hostel
deactivation is blocked while student or staff memberships remain.

Every new student approval records `boys` or `girls` housing eligibility. The
server checks that value against the selected hostel for single approvals, CSV
imports, account activation, and room allocation. Co-ed hostels accept either
value. Older profiles may temporarily have no value after migration, but all new
onboarding records require one.

## API

All endpoints require an administrator access token and the `hostel:manage`
permission.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/admin/hostels?includeInactive=true` | List configured hostels |
| `POST` | `/api/admin/hostels` | Create a hostel |
| `PATCH` | `/api/admin/hostels/:id` | Update name, address, or resident type |
| `PATCH` | `/api/admin/hostels/:id/status` | Activate or deactivate a hostel |
| `GET` | `/api/admin/hostels/:id/inventory` | List rooms and occupancy |
| `POST` | `/api/admin/hostels/:id/rooms` | Create a room |
| `PATCH` | `/api/admin/hostels/:id/rooms/:roomId` | Change floor or capacity |
| `PATCH` | `/api/admin/hostels/:id/rooms/:roomId/status` | Change room status |

Create request example:

```json
{
  "code": "GH1",
  "name": "Gargi Residence",
  "residentType": "girls",
  "address": "East campus"
}
```

Every successful change creates an immutable audit event. Duplicate codes or
names return a conflict response through the shared API error policy.

## Frontend workflow

Administrators open **Institution → Hostel setup**. The desktop view uses a
compact table and mobile uses structured records. Creation and editing happen
in a focused dialog; activation changes require confirmation.

Choosing **Rooms** opens the inventory editor beneath the hostel list. The
administrator creates room numbers directly inside the selected hostel. Room
floor and bed capacity remain editable. Room numbers are unique within a hostel,
capacity cannot be reduced below current occupancy, and occupied rooms cannot be
deactivated. No inventory record is hard-deleted, preserving allocations and
audit history.

One mess remains implicitly associated with each hostel through hostel-scoped
menu records.
