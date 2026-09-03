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
- Passwords follow the shared 12-character and 72-byte bcrypt boundary.
- Students receive exactly one primary hostel membership from the approved record.
- The login request never accepts a role or hostel code.
