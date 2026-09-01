# Staff Account Lifecycle

## Identity approach

HostelMate does not create Gmail or institutional mailboxes. The institution creates or approves those addresses outside the application, and HostelMate links each existing address to one account. Every role signs in through the same email-and-password endpoint; the server derives the role and hostel access from persisted records.

Public registration remains student-only. Warden, maintenance, and guard accounts require an administrator-issued invitation. Additional administrators are deliberately excluded from this endpoint and should use a separate high-assurance bootstrap or promotion process when that capability is implemented.

## Provisioning flow

1. An authenticated administrator creates an invitation with the staff member's name, existing email address, role, assigned hostel codes, and primary hostel.
2. The API creates a cryptographically random 256-bit token, stores only its SHA-256 hash, and expires the invitation after 24 hours.
3. Creating a replacement invitation revokes any earlier unused invitation for the same email.
4. The recipient accepts the invitation once and chooses a password. Acceptance atomically creates the account, creates every hostel membership, and marks the invitation used.
5. The staff member uses the normal login endpoint. The login request never accepts a role or hostel selection.

The current release returns the acceptance token once to the authorized administrator because an email provider is not configured. Treat it as a secret and deliver it through a trusted channel; never log or persist it. A later email adapter should deliver the same token to the invited address and omit it from production API responses.

## Endpoints

### Create staff invitation

`POST /api/admin/staff/invitations`

Requires a Bearer access token with `staff:provision` permission.

```json
{
  "name": "Hostel One Warden",
  "email": "warden@institution.edu",
  "role": "warden",
  "hostelCodes": ["H1", "H2"],
  "primaryHostelCode": "H1"
}
```

Only `warden`, `maintenance`, and `guard` may be invited. At least one active hostel is required, and the primary hostel must appear in `hostelCodes`.

### Accept staff invitation

`POST /api/auth/staff-invitations/accept`

```json
{
  "token": "one-time-token-from-the-invitation",
  "password": "a passphrase of at least 12 characters"
}
```

Passwords must contain at least 12 characters and at most 72 UTF-8 bytes. A token cannot be reused after successful acceptance.

### Suspend or reactivate an account

`PATCH /api/admin/accounts/:id/status`

Requires a Bearer access token with `account:deactivate` permission.

```json
{
  "status": "suspended"
}
```

Allowed values are `active` and `suspended`. Administrators cannot use this endpoint on themselves or another administrator. Suspended accounts cannot create new sessions. An already-issued stateless access token remains valid until its configured expiry (one hour by default and no more than 24 hours); immediate session revocation requires a future token-version or server-side session store.

## Multi-hostel rules

- Staff may belong to one or more active hostels.
- Exactly one assigned hostel is primary for each invited staff account.
- Hostel access comes from `hostel_memberships`, never from an email suffix or a hostel code supplied during login.
- Institution administrators remain global and do not require hostel memberships.
