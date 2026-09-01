# HostelMate Product Requirements Document

| Field | Value |
| --- | --- |
| Product | HostelMate — Hostel Operations and Gate Security Platform |
| Document version | 1.0 |
| Status | Approved baseline for implementation planning |
| Date | 2026-09-01 |
| Intended release | Resume-grade Release 1 |
| Primary repository | Hostel-Management-System |

## 1. Executive summary

HostelMate is a multi-role web platform for managing hostel residents, room information, maintenance complaints, leave approvals, gate movements, mess operations, notices, and operational reporting.

The product replaces fragmented paper registers, spreadsheets, messaging groups, and verbal approvals with traceable digital workflows. Its two flagship workflows are:

1. A complaint and maintenance workflow with assignment, priorities, service-level deadlines, evidence, and student verification.
2. A digital leave and gate-pass workflow with warden approval, secure QR verification, transactional exit/return logging, and a live outside-campus roster.

Release 1 must be secure, reproducible, tested, observable, responsive, accessible, documented, and deployed. Engineering quality is part of the product requirement, not a later enhancement.

## 2. Problem statement

Hostel operations are commonly split across paper forms, registers, phone calls, spreadsheets, and chat messages. This creates several problems:

- Students cannot reliably track complaints or leave approvals.
- Wardens lack a unified operational view.
- Maintenance work has no clear owner, deadline, or resolution history.
- Paper gate passes can be lost, reused, or forged.
- Security staff cannot easily confirm whether a pass is active or already used.
- Mess feedback is unstructured and difficult to analyze.
- Important decisions and manual overrides are not auditable.
- Administrators cannot produce accurate reports without manual consolidation.

## 3. Product vision

Create a trustworthy hostel operations platform in which every important request has an owner, an allowed state transition, a timestamped history, and a measurable outcome.

The product should be credible as both:

- A usable hostel-management application.
- A resume-grade demonstration of full-stack architecture, relational data modeling, authorization, workflow correctness, testing, observability, and deployment.

## 4. Goals

### 4.1 Product goals

- Give students one portal for complaints, leaves, mess information, notices, and status tracking.
- Give wardens a real-time view of pending work, approvals, SLA breaches, and students outside campus.
- Give maintenance staff an explicit, prioritized work queue.
- Give guards a fast and reliable gate-pass verification terminal.
- Preserve an audit history for sensitive changes and operational decisions.
- Produce trustworthy operational analytics from real data.

### 4.2 Engineering goals

- Enforce authorization and state transitions on the server.
- Make the database reproducible from versioned migrations and seed data.
- Support a clean local setup and a deployed demo environment.
- Provide automated tests for critical business and security workflows.
- Keep the system understandable as a modular monolith rather than introducing unnecessary distributed-system complexity.
- Remove fake production data and distinguish loading, empty, and error states.

## 5. Non-goals for Release 1

The following are intentionally out of scope until the core product is complete:

- Hostel fee collection, accounting, refunds, or payment gateways.
- Biometric or hardware turnstile integration.
- Native Android or iOS applications.
- Multi-tenant SaaS support for unrelated institutions.
- AI-based complaint classification or predictive analytics.
- Procurement, inventory, payroll, or vendor billing.
- Public social feeds or real-time chat.
- Microservices, Kubernetes, or event streaming solely for architectural appearance.

## 6. Target users and personas

### 6.1 Student resident

Needs to complete a resident profile, view room information, submit complaints, track work, apply for leave, access an approved gate pass, view menus, provide feedback, and read notices.

Primary success condition: the student can understand the status and next action for every submitted request without contacting staff.

### 6.2 Warden

Needs to manage resident operations, review leave requests, monitor complaints and SLA risk, view the outside-campus roster, publish notices, and review reports.

Primary success condition: the warden can identify urgent work and make an auditable decision from one dashboard.

### 6.3 Maintenance staff member

Needs a prioritized queue of assigned complaints, access to relevant room and issue details, the ability to update work status, and a way to provide resolution notes and evidence.

Primary success condition: assigned work and deadlines are unambiguous.

### 6.4 Security guard

Needs to verify a QR token or pass code quickly, confirm identity and validity, record exit or return, view students currently outside, and document exceptional manual actions.

Primary success condition: an invalid, expired, or reused pass cannot produce an unauthorized movement event.

### 6.5 System administrator

Needs to provision staff accounts, manage roles, configure hostel data, review audit activity, and deactivate access.

Primary success condition: privileged access is controlled without public staff registration.

## 7. Product principles

1. **Server authority:** the API, not the browser, decides whether an action is allowed.
2. **Explicit state:** important workflows use defined states and transitions.
3. **Auditability:** sensitive actions identify who acted, what changed, and when.
4. **Honest UI:** no placeholder value may be presented as live operational data.
5. **Least privilege:** each role receives only the access needed for its duties.
6. **Actionable dashboards:** dashboards highlight decisions and exceptions, not decorative metrics.
7. **Operational simplicity:** use a modular monolith and managed infrastructure suitable for the project scale.
8. **Accessibility and responsiveness:** critical workflows work on mobile and keyboard-only navigation.

## 8. Release 1 scope

### 8.1 P0 — Required for Release 1

- Approved-student activation, verified-email authentication, staff provisioning, session management, and role-based access control.
- Multiple hostel buildings with explicit student and staff memberships.
- Student profiles and hostel/room allocation data.
- Complaint submission, assignment, SLA tracking, resolution, and verification.
- Leave application, approval, QR pass, exit, return, expiry, and gate logs.
- Mess menu publishing, ratings, issue reporting, and issue resolution.
- Notices and in-app notifications for critical events.
- Role-specific dashboards.
- Audit logs for privileged and workflow-changing actions.
- Search, filtering, sorting, and pagination on operational lists.
- Versioned migrations, seed data, validation, tests, CI, deployment, and documentation.

### 8.2 P1 — Desirable after P0 is stable

- CSV student import.
- Complaint and mess report export to CSV/PDF.
- Email notifications for selected events.
- Menu suggestions and voting.
- Room-transfer workflow.
- Configurable SLA rules by complaint category.
- Configurable notice audiences by hostel block or floor.

### 8.3 P2 — Future possibilities

- Visitor passes.
- Parent/guardian portal.
- Inventory links for maintenance work.
- Hostel fee and payment modules.
- Native mobile applications.
- Multi-institution SaaS tenancy with separate customer organizations.

## 9. Role and permission matrix

Legend: `Own` means only records belonging to the authenticated student. `Assigned` means records assigned to the authenticated staff member.

| Capability | Student | Warden | Maintenance | Guard | Admin |
| --- | --- | --- | --- | --- | --- |
| View/update own profile | Yes | Own account | Own account | Own account | Own account |
| View student directory | No | Yes | Limited assignment context | Limited active-pass context | Yes |
| Manage rooms/allocations | No | Yes | No | No | Yes |
| Create complaint | Yes | Yes | No | No | Yes |
| View complaints | Own | All managed hostel records | Assigned | No | All |
| Assign complaint | No | Yes | No | No | Yes |
| Update maintenance status | No | Yes | Assigned | No | Yes |
| Verify/reopen resolved complaint | Own | Yes | No | No | Yes |
| Apply for leave | Own | No | No | No | No |
| Approve/reject leave | No | Yes | No | No | Yes |
| Verify and log gate movement | No | Read-only roster | No | Yes | Yes |
| Publish mess menu | No | Yes | No | No | Yes |
| Rate/report mess issue | Yes | Optional | Optional | Optional | Yes |
| Resolve mess issue | No | Yes | No | No | Yes |
| Publish notices | No | Yes | No | No | Yes |
| Provision staff accounts | No | No | No | No | Yes |
| View audit logs | No | Limited operational view | Own actions | Own gate actions | All |

The API must enforce this matrix independently of frontend navigation.

## 10. Functional requirements

Priority definitions:

- **P0:** required for Release 1 acceptance.
- **P1:** implement after all P0 requirements are stable.
- **P2:** future scope.

### 10.1 Authentication and account management

| ID | Priority | Requirement | Acceptance criteria |
| --- | --- | --- | --- |
| AUTH-01 | P0 | Students may activate an account only against an administrator-approved student record or invitation. | The submitted email and institutional student identifier must match an unused approved record, and the server always creates the `STUDENT` role. |
| AUTH-02 | P0 | Staff accounts must be provisioned by an administrator or a single-use invitation. | Public requests cannot create `ADMIN`, `WARDEN`, `MAINTENANCE`, or `GUARD` accounts. |
| AUTH-03 | P0 | Users may sign in with normalized email and password. | Invalid credentials return a generic error and do not reveal whether the email exists. |
| AUTH-04 | P0 | Passwords must be securely hashed and subject to a documented minimum policy. | Plaintext passwords are never stored or logged. |
| AUTH-05 | P0 | Sessions or tokens must expire. | Expired credentials are rejected and the frontend returns the user to sign-in with an explanation. |
| AUTH-06 | P0 | Protected API routes must validate authentication and authorization. | Role and ownership tests cover every protected route family. |
| AUTH-07 | P0 | The frontend must protect role-specific routes. | Direct navigation to an unauthorized route renders an unauthorized page or safe redirect. |
| AUTH-08 | P0 | Users may sign out. | Local authentication state is cleared and protected data is no longer accessible. |
| AUTH-09 | P0 | Administrators may deactivate accounts. | Deactivated users cannot create new sessions or use existing sessions beyond the defined invalidation policy. |
| AUTH-10 | P0 | Authentication endpoints must be rate limited. | Repeated failed attempts receive a controlled throttling response. |
| AUTH-11 | P1 | Users may request a password reset. | Reset tokens are single-use, expire, and do not expose account existence. |
| AUTH-12 | P1 | Administrators may issue expiring staff invitations. | Invitations can be accepted once and create only the pre-authorized role. |
| AUTH-13 | P0 | New users must verify ownership of their email address before account activation. | Verification tokens are hashed, single-use, expire, and successful verification records `email_verified_at`. |
| AUTH-14 | P0 | All roles use one email-and-password sign-in flow. | The server derives role and hostel access from stored records; neither is selected or trusted from the login request. |

### 10.2 Student profiles and room management

| ID | Priority | Requirement | Acceptance criteria |
| --- | --- | --- | --- |
| RES-01 | P0 | A student profile stores name, roll number, phone, guardian contact, hostel, block, and room allocation. | Required fields are validated and roll numbers are unique. |
| RES-02 | P0 | Students may view their profile and current allocation. | A student cannot retrieve another student's full profile. |
| RES-03 | P0 | Wardens and administrators may search and filter residents. | Results are paginated and filterable by hostel, block, room, and account status. |
| RES-04 | P0 | Administrators or wardens may allocate a student to an available room. | Allocation cannot exceed configured room capacity. |
| RES-05 | P0 | Allocation changes must preserve history. | Current and prior allocation dates can be audited. |
| RES-06 | P0 | Room data includes hostel, block, floor, room number, and capacity. | Duplicate room identifiers within the same block are rejected. |
| RES-07 | P1 | Administrators may import residents from a validated CSV template. | Invalid rows are reported without partially corrupting valid existing data. |
| RES-08 | P1 | Wardens may transfer students between rooms. | Transfer is transactional and preserves allocation history. |
| RES-09 | P0 | One institution may manage multiple hostel buildings. | Every hostel has a unique name and short code such as `H1` or `H2`; users receive explicit hostel memberships. |

### 10.3 Complaints and maintenance

| ID | Priority | Requirement | Acceptance criteria |
| --- | --- | --- | --- |
| CMP-01 | P0 | Students may submit a complaint with category, location, description, priority request, and optional image. | Invalid or oversized attachments are rejected with a useful message. |
| CMP-02 | P0 | The server determines or validates the final priority and SLA deadline. | Clients cannot create arbitrary SLA deadlines. |
| CMP-03 | P0 | Wardens may assign complaints to maintenance staff. | Assignment records the actor, assignee, and time. |
| CMP-04 | P0 | Maintenance staff may view their assigned work queue. | The queue supports priority, status, SLA, category, and date filters. |
| CMP-05 | P0 | Allowed complaint states are enforced by the server. | Invalid transitions return a conflict response and do not change data. |
| CMP-06 | P0 | Every complaint change creates an immutable timeline event. | The active UI displays events in chronological order with actor and note. |
| CMP-07 | P0 | Maintenance staff may mark a complaint resolved with a resolution note and optional evidence. | Resolution cannot be submitted without a meaningful note. |
| CMP-08 | P0 | The student may confirm the resolution or reopen the complaint with a reason. | Only the complaint owner may perform student verification. |
| CMP-09 | P0 | Open complaints display SLA remaining or breached state. | SLA calculations use server timestamps and exclude completed states. |
| CMP-10 | P0 | Wardens may search, filter, sort, and paginate complaints. | Large result sets are not returned as one unbounded response. |
| CMP-11 | P0 | Complaint attachments must be private. | Access requires authorization or a short-lived signed URL. |
| CMP-12 | P1 | The system detects likely duplicate open complaints for the same room/category. | The student is warned and may review possible matches before submitting. |
| CMP-13 | P1 | Wardens may configure category-specific SLA policies. | Policy changes affect new complaints and preserve existing deadlines. |

#### Complaint state model

```text
CREATED → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED
                         ↑              │
                         └── REOPEN ────┘
```

Rules:

- Only a warden/admin may assign or reassign.
- Only the assignee, warden, or admin may move work into progress or resolved.
- Only the owning student, warden, or admin may close a resolved complaint.
- Reopening requires a note and produces a timeline event.
- Deletion is not the normal completion mechanism; historical operational records should be retained.

### 10.4 Leave requests and gate passes

| ID | Priority | Requirement | Acceptance criteria |
| --- | --- | --- | --- |
| LEV-01 | P0 | Students may apply for leave with reason, departure date/time, expected return date/time, and emergency flag. | Past departures and invalid date ranges are rejected. |
| LEV-02 | P0 | The system prevents conflicting active leave requests. | A student cannot hold overlapping pending/approved passes without authorized override. |
| LEV-03 | P0 | Wardens may approve or reject pending requests with a decision note. | Decision records the actor and timestamp. |
| LEV-04 | P0 | Approved leave creates a unique, non-guessable, expiring gate-pass token. | Tokens are unique, not based on sequential IDs, and cannot be accepted after expiry. |
| LEV-05 | P0 | Students may view an approved QR pass and download a secure PDF. | The pass is accessible only to the student and authorized staff. |
| LEV-06 | P0 | Guards may verify a pass by QR token or controlled manual lookup. | The response clearly states valid/invalid, current state, validity window, and permitted next action. |
| LEV-07 | P0 | A valid approved pass may be used once to record exit. | Repeated exit attempts are rejected without duplicate gate events. |
| LEV-08 | P0 | An exited pass may be used once to record return. | Return changes the leave state and records one gate event. |
| LEV-09 | P0 | Gate event creation and leave-state change must be atomic. | A failed state update cannot leave an orphan gate event and vice versa. |
| LEV-10 | P0 | Wardens and guards may view students currently outside. | The roster includes student, room, departure, expected return, and overdue status. |
| LEV-11 | P0 | Manual overrides require an authorized role and reason. | Override actions are prominently identified in the audit history. |
| LEV-12 | P0 | Unused approved passes expire automatically or are treated as expired at verification. | Expired passes cannot record exit. |
| LEV-13 | P1 | The system sends approval, rejection, expiry, and overdue notifications. | Notification status is persisted and visible to the intended user. |

#### Leave state model

```text
PENDING ──→ REJECTED
   │
   └──→ APPROVED ──→ EXITED ──→ RETURNED
             │
             └──→ EXPIRED
```

`OVERDUE` should normally be derived from an `EXITED` leave whose expected return time has passed, rather than replacing the underlying movement state.

### 10.5 Gate security terminal

| ID | Priority | Requirement | Acceptance criteria |
| --- | --- | --- | --- |
| GATE-01 | P0 | The terminal supports camera QR scanning and manual pass-code lookup. | Camera failure does not prevent manual verification. |
| GATE-02 | P0 | The terminal shows only the minimum student data needed for verification. | Sensitive profile data is not exposed unnecessarily. |
| GATE-03 | P0 | The server returns the only currently permitted gate action. | The client cannot override the permitted action by changing the request body. |
| GATE-04 | P0 | Recent gate activity is visible to guards and wardens according to role. | Results are paginated and show actor, movement, student, and time. |
| GATE-05 | P0 | The outside-campus roster updates without a full page reload. | Polling, SSE, or WebSocket updates recover gracefully from temporary errors. |
| GATE-06 | P0 | Verification and movement actions are idempotent. | Retried requests do not create duplicate movement events. |
| GATE-07 | P1 | The terminal highlights overdue returns and exceptional overrides. | Exceptions are visually distinct and filterable. |

### 10.6 Mess management

| ID | Priority | Requirement | Acceptance criteria |
| --- | --- | --- | --- |
| MESS-01 | P0 | Wardens/admins may publish a menu for a specific calendar date. | Re-publishing the same date updates/version-controls that date instead of inserting timestamp duplicates. |
| MESS-02 | P0 | Students may view today's menu and browse upcoming published menus. | Missing menus show an empty state, never hardcoded meals presented as real data. |
| MESS-03 | P0 | Students may rate a meal from 1 to 5 and optionally provide a comment. | Ratings outside the accepted range are rejected by API and database constraints. |
| MESS-04 | P0 | Students may report a mess issue with type, meal, description, and optional evidence. | The issue appears immediately in the student's issue history. |
| MESS-05 | P0 | Wardens may update mess issues through defined states. | Invalid status values are rejected. |
| MESS-06 | P0 | Wardens may view rating aggregates and issue trends based on persisted data. | Empty datasets show `No data`, not a fabricated score. |
| MESS-07 | P1 | Students may suggest menu changes and vote once per suggestion. | Duplicate votes from the same student are rejected. |
| MESS-08 | P1 | Menus preserve change history. | Editors and timestamps are visible to authorized staff. |

### 10.7 Notices and notifications

| ID | Priority | Requirement | Acceptance criteria |
| --- | --- | --- | --- |
| NOT-01 | P0 | Wardens/admins may publish notices with title, body, audience, priority, and expiry. | Expired notices are not shown as active. |
| NOT-02 | P0 | Students see notices targeted to their role, hostel, block, or all residents. | A student cannot retrieve notices targeted exclusively to another hostel. |
| NOT-03 | P0 | The system records read/unread state per recipient. | Reading a notice updates the unread count. |
| NOT-04 | P0 | In-app notifications cover complaint, leave, gate, and important notice events. | Notifications link to the relevant authorized record. |
| NOT-05 | P1 | Selected notifications may also be sent by email. | Email failure does not roll back the underlying operational action. |

### 10.8 Dashboards and reporting

| ID | Priority | Requirement | Acceptance criteria |
| --- | --- | --- | --- |
| DASH-01 | P0 | Student dashboard shows active complaints, latest leave/pass state, today's menu, and unread notices. | Every metric links to its underlying records. |
| DASH-02 | P0 | Warden dashboard shows pending approvals, open complaints, SLA breaches, outside students, overdue returns, and mess rating. | Failed widgets show an error state rather than silently displaying zero. |
| DASH-03 | P0 | Maintenance dashboard shows assigned work ordered by priority and SLA risk. | Staff cannot see unrelated private student records. |
| DASH-04 | P0 | Guard dashboard shows verification controls, outside roster, and recent movements. | The terminal remains usable at common tablet/mobile widths. |
| DASH-05 | P0 | Admin dashboard shows users, rooms, occupancy, and audit exceptions. | Metrics are calculated from persisted data. |
| RPT-01 | P1 | Authorized users may export filtered complaint and gate reports. | Exports respect current filters and role permissions. |
| RPT-02 | P1 | Reports include complaint SLA compliance and resolution-time trends. | Definitions and time ranges are visible in the report. |
| RPT-03 | P1 | Reports include leave, gate, and mess trends. | Aggregates are consistent with underlying records for the selected period. |

### 10.9 Audit logging

| ID | Priority | Requirement | Acceptance criteria |
| --- | --- | --- | --- |
| AUD-01 | P0 | Privileged and workflow-changing actions create audit events. | Account roles, room allocations, complaint changes, leave decisions, gate actions, overrides, menus, and notices are covered. |
| AUD-02 | P0 | Audit events identify actor, action, resource, timestamp, and contextual metadata. | Events remain readable even if the source record is later deactivated. |
| AUD-03 | P0 | Audit events are immutable through normal application APIs. | No standard user or staff route can edit or delete an audit event. |
| AUD-04 | P0 | Admins may search and paginate audit events. | Filters include actor, action, resource, and date range. |
| AUD-05 | P0 | Wardens and guards receive scoped operational audit views. | They cannot browse unrelated security or account-management events. |

## 11. API requirements

- Use a documented versioned REST base such as `/api/v1`.
- Use consistent resource-oriented paths and HTTP methods.
- Validate path, query, and request body inputs.
- Return a consistent error envelope containing a safe message, error code, and optional field errors.
- Do not return database error strings or stack traces to clients.
- Use pagination metadata for list endpoints.
- Support server-side filtering and sorting for operational tables.
- Use correct HTTP responses, including `400`, `401`, `403`, `404`, `409`, `422`, and `429` where appropriate.
- Generate OpenAPI documentation for Release 1 endpoints.
- Apply authentication, authorization, rate limits, and upload limits at the appropriate route boundaries.
- Provide liveness and readiness endpoints that do not expose secrets.

## 12. Data requirements

### 12.1 Core entities

- Users and role assignments.
- Student and staff profiles.
- Hostels, blocks, rooms, and room allocations.
- Complaints, assignments, events, and attachments.
- Leave requests, gate passes, and gate events.
- Mess menus, menu items, feedback, issues, suggestions, and votes.
- Notices, recipients/read state, and notifications.
- Audit events.

### 12.2 Data integrity

- Every foreign-key relationship must define intentional delete behavior.
- Workflow states and user roles must use database-level constraints.
- Hostel-scoped access must derive from explicit memberships, never email domains or client-supplied hostel identifiers alone.
- Ratings and capacity values must use bounds.
- Frequently filtered foreign keys, states, dates, tokens, emails, and roll numbers must be indexed appropriately.
- Date-only data must use date types; event times must use timezone-aware timestamps.
- Multi-record state transitions must use database transactions.
- Sequential database IDs must never serve as authentication or gate-pass secrets.

### 12.3 Data privacy and retention

- Password hashes, secret tokens, and reset tokens must never appear in ordinary API responses or logs.
- Student contact information must be visible only to roles with an operational need.
- Complaint images and gate-pass PDFs must not be served as unrestricted public files.
- Audit and gate-event retention must be documented.
- Seed/demo data must be fictional and safe to publish.

## 13. UX and accessibility requirements

- Support desktop, tablet, and mobile layouts.
- Critical guard actions must work well on a tablet or mobile device.
- Use consistent loading, empty, error, success, and unauthorized states.
- Never convert an API failure into a misleading zero metric.
- Use confirmation UI for destructive or irreversible actions.
- Use accessible labels, focus states, keyboard navigation, and semantic controls.
- Meet WCAG 2.1 AA expectations for critical workflows where practical.
- Status must not be conveyed by color alone.
- Dates and times must display with a clear locale/timezone policy.
- QR scanner permission failures must provide a manual alternative.

## 14. Non-functional requirements

### 14.1 Security

- Application startup must fail if required secrets or database configuration are missing.
- Production authentication must not rely on a hardcoded fallback secret.
- Use secure cookie/session or token storage appropriate to the deployed architecture.
- Configure restricted production CORS and security headers.
- Validate file size, MIME type, extension, and decoded content where feasible.
- Use private object storage or authorization-checked downloads.
- Run dependency and secret scanning in CI.
- Document the role/permission model and cover it with automated tests.

### 14.2 Performance

- Common JSON API requests should target a deployed p95 latency below 300 ms, excluding cold starts, uploads, and PDF generation.
- Operational list endpoints must remain paginated and responsive with at least 10,000 seeded records.
- The primary dashboard should target an LCP below 2.5 seconds on a typical broadband connection after warm load.
- Add caching only where measurements demonstrate value.

### 14.3 Reliability and consistency

- Repeated gate requests must not create duplicate movement events.
- State-changing endpoints must be retry-safe where practical.
- PDF generation failure must not mark a pass ready.
- Database migration failure must prevent an unsafe deployment.
- The application must use graceful shutdown and structured error handling.

### 14.4 Observability

- Use structured logs with timestamp, level, request ID, route, status, duration, and safe actor/resource identifiers.
- Provide error monitoring for frontend and backend failures.
- Log rejected state transitions and privileged actions without logging secrets.
- Expose health/readiness signals suitable for deployment monitoring.

### 14.5 Maintainability

- Maintain one canonical frontend implementation.
- Organize the backend as a modular monolith with clear route, validation, service, and persistence boundaries.
- Prefer TypeScript for new or migrated application modules.
- Keep migrations, seed scripts, API documentation, and tests in version control.
- Avoid dead modules, duplicate middleware, and hardcoded environment URLs.

## 15. Testing and quality requirements

### 15.1 Required automated coverage

- Unit tests for service-level state transition and SLA logic.
- Integration tests against PostgreSQL for authentication, authorization, ownership, constraints, and transactions.
- API tests for all P0 mutation paths.
- Frontend tests for authentication bootstrap, protected routes, forms, and failure states.
- End-to-end tests for flagship complaint and leave/gate journeys.
- Concurrency/idempotency tests for repeated gate scans.
- Accessibility checks for critical pages.

### 15.2 Required end-to-end scenarios

1. Student registers and completes a profile.
2. Warden allocates the student to a room.
3. Student submits a complaint with evidence.
4. Warden assigns it to maintenance.
5. Maintenance resolves it with a note.
6. Student confirms closure or reopens it.
7. Student applies for leave.
8. Warden approves and issues the secure pass.
9. Guard records exit.
10. A duplicate exit request is rejected without a duplicate event.
11. Guard records return.
12. Audit history shows the complete sequence and actors.

### 15.3 Quality gates

- Lint passes with no errors.
- Type checking passes for TypeScript-covered code.
- Automated tests pass.
- Production frontend and backend builds pass.
- A fresh database migrates and seeds successfully.
- CI detects missing migrations and committed secrets.
- No known critical security vulnerability remains open for release.

## 16. Success metrics

### 16.1 Product demonstration metrics

- 100% of P0 workflows are accessible through the deployed UI.
- 100% of critical state changes produce timeline or audit events.
- Zero duplicate gate events during automated retry/concurrency tests.
- Zero unauthorized cross-role actions in the permission test suite.
- Every dashboard metric links to or can be reconciled with its underlying records.

### 16.2 Engineering portfolio metrics

- Fresh-clone setup is documented and repeatable in 15 minutes or less, excluding external account provisioning.
- Automated coverage includes every P0 service and route family, with a target of at least 80% coverage for critical backend service logic.
- Common deployed API requests meet the documented p95 latency target under the demo load profile.
- CI runs lint, tests, build, migration checks, and security scans on every pull request.
- The repository contains an accurate README, architecture diagram, ERD, API documentation, role matrix, screenshots, demo credentials, and a short demo video link.

## 17. Analytics definitions

To prevent misleading dashboards, Release 1 must use explicit definitions:

- **Open complaint:** any complaint not in `CLOSED`.
- **SLA breached complaint:** an open complaint whose SLA deadline is earlier than the current server time.
- **Resolution time:** time from complaint creation to the first `RESOLVED` event; reopen metrics must be reported separately.
- **Student outside:** a leave in `EXITED` state without a subsequent successful return event.
- **Overdue return:** an `EXITED` leave whose expected return time has passed.
- **Mess average rating:** arithmetic mean of valid ratings within the selected date range; no-data state must not use a default score.
- **Room occupancy:** active room allocations divided by configured capacity.

## 18. Release milestones

These milestones define product increments, not the detailed engineering work breakdown.

### Milestone A — Secure foundation

- Canonical application structure.
- Reproducible database and seed data.
- Authentication, staff provisioning, RBAC, validation, standardized errors, and protected routes.
- Student profile and room foundation.

### Milestone B — Complaint operations

- Complete complaint workflow, assignment, SLA, timeline, attachments, maintenance portal, and student verification.
- Complaint dashboard metrics and core tests.

### Milestone C — Leave and gate security

- Leave approval, secure QR/pass, transactional movement logging, expiry, overdue detection, roster, gate history, and idempotency tests.

### Milestone D — Mess, notices, and dashboards

- Calendar menus, ratings, mess issues, notices, notifications, and completed role dashboards.

### Milestone E — Production and portfolio release

- Reporting, accessibility pass, security hardening, observability, performance verification, CI/CD, deployment, documentation, and demo material.

## 19. Launch acceptance criteria

Release 1 is considered complete only when all of the following are true:

- All P0 functional requirements are implemented or explicitly re-approved as deferred.
- Public users cannot create privileged accounts.
- Role, ownership, and workflow-transition rules are enforced and tested on the server.
- A fresh environment can install, migrate, seed, run, test, and build using documented commands.
- Complaint and leave/gate end-to-end scenarios pass in CI.
- Repeated or concurrent gate scans do not create duplicate events.
- Uploaded evidence and gate-pass documents are not publicly enumerable.
- Active pages contain no hardcoded production data or localhost-only resource URLs.
- Dashboards distinguish loading, no data, partial failure, and complete failure.
- Lint, tests, build, migration checks, and security scans pass.
- A deployed demo supports student, warden, maintenance, guard, and admin walkthroughs.
- README, API documentation, architecture diagram, ERD, role matrix, and demo instructions match the implementation.

## 20. Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Scope becomes too large | Core workflows remain unfinished | Complete milestones in order; do not start P1 until P0 quality gates pass. |
| Duplicate frontend code causes inconsistent fixes | Bugs and maintenance cost | Select one canonical UI during Milestone A and remove/archive dead implementations. |
| Role naming remains inconsistent | Legitimate users are denied or over-authorized | Approve one role enum and permission matrix before route changes. |
| Database schema and migrations drift | Fresh deployments fail | Require versioned migrations and migration checks in CI. |
| Gate requests race or repeat | Incorrect outside roster and security logs | Use transactions, transition predicates, uniqueness/idempotency keys, and concurrency tests. |
| Local file storage fails after deployment | Lost attachments and broken PDFs | Use managed private object storage with authorized access. |
| Analytics display incorrect numbers | Loss of trust | Use the definitions in Section 17 and test aggregate queries. |
| Feature count is prioritized over quality | Weak resume evidence | Treat tests, security, observability, deployment, and documentation as P0 work. |

## 21. Assumptions and constraints

- The existing React, Express, PostgreSQL, and Drizzle direction remains the base technology stack.
- Release 1 is a single-institution deployment with multiple hostel buildings, each identified by a unique name and short code.
- Students have one primary hostel membership; wardens and operational staff may be assigned to one or more hostels; institution administrators may operate globally.
- There is no production data that prevents corrective schema changes during early development.
- Email/SMS delivery is optional until the in-app notification system is stable.
- Object storage and hosting provider selection will be finalized in the engineering plan.
- The system uses a modular monolith unless measured scale creates a justified need for separation.

## 22. Open product decisions

The implementation plan must resolve these before their affected milestone begins:

1. Whether maintenance staff are grouped by trade/category.
2. The exact student identity fields required by the institution.
3. The default SLA policy for each complaint category.
4. Whether approved gate passes require a generated PDF in addition to the in-app QR.
5. Notice retention and audit-log retention periods.
7. Whether email notifications are part of Release 1 launch or immediately post-launch.
8. The deployment, object-storage, and error-monitoring providers.

## 23. Definition of done for an individual feature

A feature is done only when:

- Its requirement and acceptance criteria are satisfied.
- Server-side validation and authorization are implemented.
- Database migration and seed implications are handled.
- Loading, empty, success, error, and unauthorized UI states are present.
- Audit/timeline behavior is implemented where applicable.
- Unit/integration tests cover normal, invalid, and unauthorized paths.
- Relevant end-to-end coverage is updated.
- API and user-facing documentation are updated.
- Lint, tests, type checks, and builds pass.
- No new hardcoded environment value or fake operational metric is introduced.

## 24. Planning handoff

The next document should be an engineering work plan derived from this PRD. It should:

- Map each P0 requirement ID to concrete backend, frontend, database, test, and documentation tasks.
- Sequence work according to the milestones in Section 18.
- Identify dependencies and migration risks.
- Define verification commands and acceptance evidence for every phase.
- Preserve existing user changes while consolidating the current application.
- Avoid implementing P1/P2 scope until the corresponding P0 milestone passes its quality gates.
