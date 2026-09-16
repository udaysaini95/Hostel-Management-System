# Room Inventory and Allocation API

Room allocation uses the normalized `room_allocations` table as its source of
truth. Administrators can manage every hostel. Wardens can read and change only
the hostels present in their current `hostel_memberships` records.

## List rooms

```http
GET /api/rooms?page=1&pageSize=20&hostelCode=H1&availability=available
Authorization: Bearer <access-token>
```

Supported filters are `hostelCode` and `availability`. Availability accepts
`all`, `available`, or `full`. Each row contains the hostel, room number, floor,
capacity, current occupancy, available beds, and full state. Results include the
standard pagination object.

Inactive hostels and rooms are not returned. A warden cannot broaden
their assigned-hostel scope by supplying a different hostel code.

## Allocate a resident

```http
POST /api/room-allocations
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "studentUserId": 12,
  "roomId": 7
}
```

A successful allocation returns `201`. The service requires an active student
with a normalized profile, an active room in the student's assigned hostel, and
compatible boys/girls housing eligibility, plus at least one free bed. A co-ed
hostel accepts either eligibility. A student with a current allocation must be
vacated before another room can be assigned.

Allocation is transactional. It locks the student profile and then the target
room before checking current allocation and occupancy. This consistent order
prevents simultaneous requests from giving one student two rooms or exceeding a
room's capacity.

## Vacate an allocation

```http
PATCH /api/room-allocations/25/vacate
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "reason": "Resident moved after approved request"
}
```

The reason is required and must contain 5 through 500 characters. Vacancy closes
the current row with the actor, time, and reason; it does not delete or overwrite
the allocation. The resident can then receive a later allocation while the
complete room history remains available for audit.

Create and vacancy actions append immutable room-category audit events in the
same database transaction. The temporary legacy `users.room_no` value is also
kept synchronized for screens that have not yet moved to the normalized model.

## Transfer a resident

```http
POST /api/room-allocations/25/transfer
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "roomId": 9,
  "reason": "Approved quieter-room request"
}
```

Administrators and wardens can manually transfer a resident to another active
room in the resident's assigned hostel. The destination must have an open bed
and match the resident's boys/girls housing eligibility. The reason is required
and must contain 5 through 500 characters.

Transfer is one database transaction. It locks the resident and destination
room, closes the existing allocation, creates the new allocation, updates the
legacy room number, and records an audit event. If any check fails, none of
those changes are saved. The previous allocation remains available as history.

## Common conflict codes

- `STUDENT_ACCOUNT_INACTIVE`: the resident account is not active.
- `STUDENT_ALREADY_ALLOCATED`: the resident already has a current room.
- `ROOM_HOSTEL_MISMATCH`: the room is outside the resident's assigned hostel.
- `ROOM_HOUSING_MISMATCH`: the resident is not eligible for that hostel type.
- `ROOM_CAPACITY_REACHED`: all configured beds are occupied.
- `ROOM_ALREADY_VACATED`: the history row was already closed.
- `ROOM_ALLOCATION_NOT_CURRENT`: the selected allocation is no longer active.
- `ROOM_TRANSFER_SAME_ROOM`: the destination is the resident's current room.
- `HOSTEL_SCOPE_DENIED`: the warden is not assigned to the target hostel.

## Frontend workflow

Administrators and wardens use `/admin/residents`. The resident view provides
server-backed search and filters plus explicit allocation, transfer, or vacancy
actions.
The room-inventory peer view shows configured capacity, active occupancy, and
open beds. The selected view is stored in the URL, and both tables become
structured records on narrow screens.
