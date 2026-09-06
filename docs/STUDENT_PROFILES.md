# Student Profile API

The student profile API exposes one authenticated student's institutional
identity, contact details, hostel, and current room allocation. It never accepts
a student or profile ID from the client; the user ID comes from the verified
access token.

## Read the signed-in student's profile

```http
GET /api/student/profile
Authorization: Bearer <access-token>
```

Example response:

```json
{
  "profile": {
    "userId": 5,
    "name": "Kavya Nair",
    "email": "student.h1@hostelmate.example",
    "accountStatus": "active",
    "rollNo": "DEMO-H1-001",
    "phone": "0000000001",
    "guardian": {
      "name": "Anita Nair",
      "phone": "0000000201"
    },
    "hostel": {
      "code": "H1",
      "name": "North Residence Hall"
    },
    "currentAllocation": {
      "id": 25,
      "allocatedAt": "2026-01-01T00:00:00.000Z",
      "block": {
        "code": "A",
        "name": "Ashoka Block"
      },
      "room": {
        "number": "101",
        "label": "A-101",
        "floor": 1,
        "capacity": 2
      }
    },
    "profileComplete": true,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  }
}
```

`currentAllocation` is `null` until a warden or administrator assigns a room.
`profileComplete` becomes true when the student has supplied a phone number,
guardian name, and guardian phone number.

The authenticated frontend exposes this data at `/student/profile`. It keeps
institutional identity and room information read-only and submits only phone and
guardian fields to the update endpoint.

## Update contact details

```http
PATCH /api/student/profile
Authorization: Bearer <access-token>
Content-Type: application/json
```

The request may contain one or more editable fields:

```json
{
  "phone": "+91 98765 43210",
  "guardianName": "Anita Nair",
  "guardianPhone": "+91 98765 43211"
}
```

Names are trimmed. Phone numbers accept 7–20 digits and common display
characters: spaces, `+`, parentheses, and hyphens.

Name, email, roll number, hostel, block, and room allocation are read-only.
Unknown request fields are rejected. A student cannot select another profile by
path, query, or request-body ID.

## Authorization and errors

Only the student role receives `student-profile:read:self` and
`student-profile:update:self`. Staff and administrator accounts receive
`PERMISSION_DENIED` on these routes.

Common error codes are:

- `AUTH_TOKEN_REQUIRED` or `SESSION_EXPIRED` when authentication fails;
- `PERMISSION_DENIED` when the role is not a student;
- `VALIDATION_ERROR` for invalid or read-only fields;
- `STUDENT_PROFILE_NOT_FOUND` when an older account has no normalized profile.

Responses never include password hashes, invitation or activation tokens, room
history, or another student's contact details.
