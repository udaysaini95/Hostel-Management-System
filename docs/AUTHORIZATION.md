# HostelMate Authorization Model

HostelMate uses three server-side authorization layers. The browser is never an authority for role or ownership decisions.

1. Authentication verifies the signed access token and creates `req.user` from validated claims.
2. Permission middleware checks a named capability against the canonical role matrix.
3. Resource policy checks ownership or an explicit broader-access permission after the record is loaded.

Unknown roles and unknown permissions are denied by default. Administrative access is explicit rather than an unconditional bypass; for example, administrators can review leave applications but cannot submit student leave applications.

## Current role boundaries

- Students operate on their own profile, complaints, leave applications, and mess submissions.
- Only students receive the `student-profile:read:self` and
  `student-profile:update:self` permissions. The profile API derives ownership
  from the authenticated subject and has no ID-based student route.
- Wardens may review operational complaints, leaves, mess records, and read gate activity, but cannot log gate movements.
- Maintenance users currently have profile and mess participation access. Assigned-complaint permissions will be activated only after complaint assignment data exists.
- Guards may verify passes, log gate movement, read gate activity, and use shared mess participation features.
- Administrators receive explicitly listed institution-level operational and account-management permissions.
- Approved-student search, revocation, reinstatement, and activation-email
  reissue require the administrator-only `student-approval:manage` permission.

Audit visibility is additionally filtered after the route permission check:
administrators can read all events, wardens can read operational events for
their assigned hostels, guards can read gate events for their assigned hostels,
and maintenance users can read only events they performed. Students cannot use
the audit API.

Staff provisioning and suspension rules are documented in [Staff Account Lifecycle](./STAFF_ACCOUNT_LIFECYCLE.md).
The student identity and email-verification flow is documented in [Approved Student Activation](./STUDENT_ACTIVATION.md).
The private profile response and editable fields are documented in [Student Profile API](./STUDENT_PROFILES.md).
The append-only audit model is documented in [Audit Logging](./AUDIT_LOGGING.md).

Protected endpoints return `AUTHENTICATION_REQUIRED` when no valid actor exists and `PERMISSION_DENIED` when the authenticated role lacks the requested capability. Ownership failures return `RESOURCE_ACCESS_DENIED`.

## Multi-hostel isolation boundary

Role and record-ownership enforcement is active now. Complete assigned-hostel isolation is not yet complete because legacy complaint, leave, gate, and mess records do not all contain an authoritative hostel foreign key. The normalized resident/resource schema must add those relationships before managed-list queries can guarantee cross-hostel isolation. Role checks must not be mistaken for hostel-membership checks.
