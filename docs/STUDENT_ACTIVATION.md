# Approved Student Activation

## Why registration works this way

Students cannot create arbitrary accounts. An administrator first records the student's institutional email, roll number, name, and assigned hostel. The student must then provide the same email and roll number and follow a short-lived link delivered to that email address.

This gives the system three independent controls:

1. The administrator confirms that the student belongs to the institution.
2. The matching roll number prevents activation using an email address alone.
3. The emailed token proves control of the approved address.

HostelMate does not create Gmail or institutional mailboxes. It links an existing address to the approved student record.

## API flow

### 1. Approve a student

`POST /api/admin/students/approvals`

Requires an administrator access token with the `student:approve` permission.

```json
{
  "name": "Asha Rao",
  "email": "asha.rao@college.edu",
  "rollNo": "2026-CSE-042",
  "hostelCode": "H2"
}
```

The email and roll number must each be unique. The hostel must exist and be active.

### Manage approved students

All management endpoints require an administrator access token with the
`student-approval:manage` permission.

`GET /api/admin/students/approvals` returns newest records first and accepts:

| Parameter | Meaning |
| --- | --- |
| `page` | One-based page number; defaults to `1`. |
| `pageSize` | Items per page from 1 through 100; defaults to `20`. |
| `search` | Partial name, email, or roll-number search. |
| `hostelCode` | Exact normalized hostel code such as `H1`. |
| `status` | `approved`, `activation_pending`, `activation_expired`, `activated`, or `revoked`. |

Results contain `data` and pagination metadata. Each record includes its hostel,
lifecycle status, and activation expiry when relevant. Token values and token
hashes are never returned.

`PATCH /api/admin/students/approvals/:id/revoke` requires a 5–500 character
reason. Only an unactivated approval may be revoked, and any unused activation
link is invalidated in the same transaction.

`PATCH /api/admin/students/approvals/:id/reinstate` also requires a reason. It
restores a revoked, unactivated approval only when the assigned hostel remains
active and no account now conflicts with the approved identity.

`POST /api/admin/students/approvals/:id/activation-email` invalidates any prior
unused link, creates a new 30-minute link, and sends it to the approved address.
The endpoint returns `202` after delivery but never includes the raw link token.
An email-delivery failure revokes the newly created token and returns a safe
`503` response.

### 2. Request an activation email

`POST /api/auth/student-activation/request`

```json
{
  "email": "asha.rao@college.edu",
  "rollNo": "2026-CSE-042"
}
```

The public response is deliberately the same whether the details match or not. This prevents the endpoint from revealing which students have been approved. A matching request revokes any earlier unused token, creates a new 30-minute token, and sends the activation link to the approved address.

### 3. Complete activation

`POST /api/auth/student-activation/complete`

```json
{
  "token": "token-from-the-email-link",
  "password": "a passphrase of at least 12 characters"
}
```

Successful completion performs one transaction that creates the student account, creates the primary hostel membership, records email verification, links the approval to the new user, and consumes the token. The response includes a normal expiring access session.

The old `POST /api/auth/register` route no longer creates accounts. It returns `410 STUDENT_ACTIVATION_REQUIRED` so older clients receive a clear migration response.

## SMTP configuration

Activation tokens are never returned by the API or written to logs. Configure these environment variables to deliver them:

```text
SMTP_HOST=smtp.example.edu
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=hostelmate@example.edu
SMTP_PASSWORD=provider-specific-secret
EMAIL_FROM=HostelMate <hostelmate@example.edu>
STUDENT_ACTIVATION_URL=https://hostel.example.edu/activate-student
```

`SMTP_USER` and `SMTP_PASSWORD` are optional only for SMTP servers that do not require authentication. For Gmail or Google Workspace, use an app password or provider-supported SMTP credential; never store a personal Google password in the repository. Production activation URLs must use HTTPS.

If email delivery is not configured, activation requests return `503 ACTIVATION_EMAIL_UNAVAILABLE`. Partial configuration stops the server with a clear configuration error instead of silently losing activation emails.

## Security and hostel rules

- Raw activation tokens exist only in the email-delivery path; the database stores SHA-256 hashes.
- Tokens are random 256-bit values, expire after 30 minutes, and can be used once.
- A failed email send revokes the new token.
- Approval creation, revocation, reinstatement, and administrator activation
  reissue are recorded in the immutable audit log with hostel scope.
- Activated approvals cannot be revoked or reissued. Administrators use account
  suspension when an already activated student must lose access.
- Passwords follow the shared 12-character and 72-byte bcrypt boundary.
- Students receive exactly one primary hostel membership from the approved record.
- The login request never accepts a role or hostel code.
