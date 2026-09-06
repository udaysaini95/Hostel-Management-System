# Room Inventory and Allocation API

Room allocation uses the normalized `room_allocations` table as its source of
truth. Administrators can manage every hostel. Wardens can read and change only
the hostels present in their current `hostel_memberships` records.

## List rooms

```http
GET /api/rooms?page=1&pageSize=20&hostelCode=H1&availability=available
Authorization: Bearer <access-token>
```

Supported filters are `hostelCode`, `blockCode`, and `availability`. Availability
accepts `all`, `available`, or `full`. Each row contains the hostel and block,
room number and label, floor, capacity, current occupancy, available beds, and
full state. Results include the standard pagination object.

Inactive hostels, blocks, and rooms are not returned. A warden cannot broaden
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
at least one free bed. A student with a current allocation must be vacated before
another room can be assigned.

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

## Common conflict codes

- `STUDENT_ACCOUNT_INACTIVE`: the resident account is not active.
- `STUDENT_ALREADY_ALLOCATED`: the resident already has a current room.
- `ROOM_HOSTEL_MISMATCH`: the room is outside the resident's assigned hostel.
- `ROOM_CAPACITY_REACHED`: all configured beds are occupied.
- `ROOM_ALREADY_VACATED`: the history row was already closed.
- `HOSTEL_SCOPE_DENIED`: the warden is not assigned to the target hostel.

Room transfer remains a separate P1 workflow. It will close the current
allocation and create the new one atomically instead of asking clients to chain
two independent requests.
