# HostelMate Engineering Implementation Plan

| Field | Value |
| --- | --- |
| Plan version | 1.0 |
| Status | Active |
| Date | 2026-09-01 |
| Product source | `docs/PRD.md` |
| Design source | `docs/FRONTEND_DESIGN_GUIDELINES.md` |
| Delivery model | One verified, commit-sized slice at a time |

## 1. Purpose

This plan converts the HostelMate PRD into a sequence of small engineering changes. It is intentionally ordered so that security, data integrity, and reproducibility are established before large feature work.

Only one numbered slice should be implemented at a time. A slice must be verified and committed before the next slice begins unless the user explicitly requests otherwise.

## 2. Working agreement

For every implementation slice:

1. Re-read the mapped PRD requirements and relevant design sections.
2. Inspect the current worktree and preserve unrelated user changes.
3. State the exact slice boundary before editing.
4. Change only the files required for that slice.
5. Add or update tests in the same slice when the behavior can be tested.
6. Run the verification commands listed for the slice.
7. Review the final diff for secrets, generated artifacts, and unrelated changes.
8. Report what changed, what was verified, and any remaining limitation.
9. Provide one Conventional Commit message and exact-path staging guidance.
10. Wait for the user to commit or explicitly request the next slice.

Rules:

- Do not use `git add .` while unrelated changes exist.
- Do not combine cleanup, redesign, and business behavior in one commit.
- Do not silently change a PRD decision while implementing code.
- Do not use `drizzle-kit push` as a substitute for versioned migrations in the final workflow.
- Do not delete legacy code until its lack of reachability is reconfirmed and the deletion is the declared slice.
- Do not introduce fake dashboard/menu values to make unfinished screens look complete.
- Do not begin P1/P2 product scope while a prerequisite P0 exit gate is failing.

## 3. Commit and verification convention

Commit prefixes:

- `fix:` corrects existing behavior or security.
- `feat:` adds product capability.
- `refactor:` changes structure without changing intended behavior.
- `test:` adds or reorganizes test coverage only.
- `docs:` updates documentation only.
- `chore:` changes tooling, CI, dependencies, or developer workflow.
- `perf:` makes a measured performance improvement.

Each commit message in this plan is the recommended default. It may be adjusted if the final slice boundary changes.

Baseline verification commands should eventually converge on:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

The exact commands will initially run from `Backend` and `Frontend` until a root workspace command is added.

## 4. Current baseline constraints

The plan begins from the audited repository state:

- React/Vite frontend with one active `src/pages` tree and a disconnected legacy UI.
- Express/Drizzle/Neon backend with controller-heavy modules.
- Database schema newer than the checked-in migration.
- Public registration currently accepts a client-provided privileged role.
- JWT fallback secret and non-expiring tokens currently exist.
- Frontend routes are not protected.
- Gate state transitions are not enforced transactionally.
- Uploads and PDFs are served publicly from local disk.
- Frontend lint currently fails.
- Automated tests, CI, deployment, and operational documentation are incomplete.

Before each slice, current Git state remains authoritative because the user may commit or edit between slices.

## 5. Delivery overview

| Phase | Outcome | Exit gate |
| --- | --- | --- |
| 0. Planning baseline | Product, design, and implementation documents are versioned | Documentation commit exists |
| 1. Secure/reproducible foundation | Registration, configuration, roles, migrations, errors, and tests are safe | Fresh DB plus auth/RBAC checks pass |
| 2. Canonical frontend foundation | One UI, protected routes, design tokens, shared states | Frontend lint/build and route tests pass |
| 3. Residents and rooms | Profiles, hostel structure, rooms, and allocations work | Capacity/ownership tests pass |
| 4. Complaint operations | Student-to-warden-to-maintenance workflow is complete | Complaint E2E passes |
| 5. Leave and gate security | Approved pass, idempotent exit, and return are correct | Gate concurrency E2E passes |
| 6. Mess, notices, and notifications | Supporting hostel modules are complete and honest | Module integration tests pass |
| 7. Dashboards and reporting | Role dashboards use defined metrics and resilient states | Metrics reconcile with source records |
| 8. Production and portfolio | Observability, CI/CD, deployment, docs, and demo are complete | Launch criteria in PRD Section 19 pass |

## 6. Slice index

### Phase 0 — Planning baseline

| Slice | Scope | PRD mapping | Verification | Recommended commit |
| --- | --- | --- | --- | --- |
| PLAN-01 | Version PRD, frontend design guidelines, and this implementation plan | PRD Sections 18, 23, 24 | Confirm three documents render and Git stages only `docs/` files | `docs: add product and implementation specifications` |

### Phase 1 — Secure and reproducible foundation

| Slice | Scope | PRD mapping | Verification | Recommended commit |
| --- | --- | --- | --- | --- |
| AUTH-01 | Restrict public registration to students and centralize role constants | AUTH-01, AUTH-02 | Regression test attempts `ADMIN`, `WARDEN`, and `GUARD` public registration | `fix(auth): restrict public registration to students` |
| DB-01 | Reconcile Drizzle migrations and add constrained account lifecycle, hostel, and hostel-membership foundations | AUTH-09, RES-09, Data 12.1–12.2 | Schema tests cover enums, unique hostel identity, and membership constraints; migration applies to an empty database | `feat(db): add multi-hostel account foundation` |
| DB-02 | Add deterministic fictional seed data and documented reset/seed commands | Success 16.2, Assumptions 21 | Fresh database migrates and seeds demo roles and records | `feat(db): add deterministic demo seed data` |
| AUTH-02 | Validate required runtime configuration and remove fallback secrets | AUTH-04–AUTH-05, NFR 14.1 | Startup fails clearly without DB/JWT configuration; configured startup succeeds | `fix(config): require secure runtime secrets` |
| AUTH-03 | Add one normalized-email login flow, expiring credentials, consistent session claims, and last-login tracking | AUTH-03–AUTH-05, AUTH-14 | Valid, expired, malformed, tampered, and role-injection credential tests pass | `fix(auth): add expiring authenticated sessions` |
| AUTH-04 | Add authoritative role/permission middleware and resource ownership helpers | AUTH-06, role matrix | Permission matrix tests cover student, warden, maintenance, guard, admin | `feat(auth): enforce role and ownership policies` |
| AUTH-05 | Add admin-only staff provisioning and account deactivation | AUTH-02, AUTH-09, AUTH-12 | Public staff creation fails; admin provisioning/deactivation succeeds and audits | `feat(auth): add controlled staff account provisioning` |
| AUTH-06 | Add approved-student records plus expiring, single-use email verification and activation | AUTH-01, AUTH-13, RES-09 | Unknown/mismatched students fail; approved students activate once in their assigned hostel | `feat(auth): add verified student activation` |
| API-01 | Add shared request validation and safe standardized API errors | API Section 11, AUTH-03, NFR 14.1 | Invalid payload, unknown route, conflict, and internal error tests pass | `feat(api): add validation and standardized errors` |
| API-02 | Add authentication rate limiting and baseline security middleware | AUTH-10, NFR 14.1 | Rate-limit and security-header checks pass without blocking normal flow | `fix(security): harden authentication endpoints` |
| AUD-01 | Add immutable audit-event infrastructure and actor context | AUD-01–AUD-05 | Representative privileged actions create searchable immutable events | `feat(audit): add immutable operational audit events` |
| TEST-01 | Establish backend unit/integration test harness and isolated test database workflow | Testing 15.1, quality gates | Tests run from one backend command without touching development data | `test(backend): add isolated integration test harness` |

Phase 1 exit gate:

- Public registration cannot create staff roles.
- Required secrets are mandatory and credentials expire.
- Role/ownership policies are test-covered.
- Fresh migrations and seed data succeed.
- API validation and safe errors are active.
- Audit infrastructure exists before flagship workflows are rebuilt.

### Phase 2 — Canonical frontend foundation

| Slice | Scope | PRD mapping | Verification | Recommended commit |
| --- | --- | --- | --- | --- |
| FE-01 | Reconfirm and remove/archive disconnected legacy frontend code; remove unused starter assets | Maintainability 14.5, design Sections 3 and 16 | Import/route inventory, lint, and build confirm active UI remains intact | `refactor(frontend): remove disconnected legacy interface` |
| FE-02 | Centralize environment, API, upload, and asset URL construction | API Section 11, launch criteria | No active component contains a localhost URL; environment tests/build pass | `refactor(frontend): centralize service URLs` |
| FE-03 | Implement design tokens and shared primitives from the design guidelines | UX Section 13, design Sections 4, 8, 16 | Component examples/tests cover variants and keyboard/focus behavior | `feat(ui): establish HostelMate design system` |
| FE-04 | Implement public and authenticated application shells with responsive navigation | Design Sections 5–7 | Visual checks at 360/768/1024/1440; navigation matches roles | `feat(ui): add responsive role-based application shells` |
| FE-05 | Add auth bootstrap, `/me` integration, protected routes, and unauthorized/404 pages | AUTH-06–AUTH-08 | Direct URL and session-expiry route tests pass for every role | `feat(frontend): protect routes by session and role` |
| FE-06 | Add shared loading, empty, error, unauthorized, toast, and confirmation patterns | Design Sections 8–9 | Component tests distinguish failed data from genuine empty data | `feat(ui): add reusable application feedback states` |
| FE-07 | Bring the canonical frontend to a clean lint/build baseline | Quality gates 15.3 | Lint and production build pass with no ignored active errors | `fix(frontend): restore clean lint and build baseline` |
| TEST-02 | Add frontend component test harness and accessibility checks | Testing 15.1, design Section 15 | Shared primitive, protected route, and form tests pass | `test(frontend): add component and accessibility harness` |

Phase 2 exit gate:

- One canonical frontend remains.
- Design tokens/primitives control styling.
- No active localhost-only URLs or fake fallbacks remain.
- Role routes are protected.
- Loading, empty, and error states are distinct.
- Frontend lint, tests, and build pass.

### Phase 3 — Residents and rooms

| Slice | Scope | PRD mapping | Verification | Recommended commit |
| --- | --- | --- | --- | --- |
| RES-01 | Add normalized student/staff profiles, blocks, rooms, and allocation history on the hostel foundation | RES-01, RES-05–RES-06, RES-09 | Migration and constraint tests cover unique roll/room and allocation history | `feat(residents): add profile and room data model` |
| RES-02 | Add student profile read/update APIs with ownership/privacy enforcement | RES-01–RES-02 | Student cross-profile access fails; own profile validation succeeds | `feat(residents): add secure student profiles` |
| RES-03 | Add resident directory with server pagination/search/filter | RES-03, API Section 11 | Role and query tests cover hostel/block/room/status filters | `feat(residents): add paginated resident directory` |
| RES-04 | Add transactional room allocation and capacity enforcement | RES-04–RES-05 | Concurrent over-capacity allocation tests fail safely | `feat(rooms): enforce room allocation capacity` |
| RES-05 | Build student profile and warden room-allocation screens | RES-01–RES-06, design page rules | Responsive, permission, loading, empty, error, and form tests pass | `feat(frontend): add resident and room management` |
| RES-06 | Add validated CSV resident import | RES-07 P1; run only after P0 phase is stable | Dry-run/error reporting and transactional import tests pass | `feat(residents): add validated CSV import` |

Phase 3 exit gate:

- Student identity and room fields no longer show unexplained `N/A` for complete profiles.
- Allocation capacity and history are enforced transactionally.
- Directory and profile privacy tests pass.

### Phase 4 — Complaint operations

| Slice | Scope | PRD mapping | Verification | Recommended commit |
| --- | --- | --- | --- | --- |
| CMP-01 | Define complaint states, priorities, SLA rules, assignments, events, and attachment schema | CMP-01–CMP-06, Data Section 12 | Migration and domain transition unit tests pass | `feat(complaints): define maintenance workflow model` |
| CMP-02 | Rebuild complaint creation/list/detail APIs with validation and pagination | CMP-01–CMP-02, CMP-09–CMP-10 | Ownership, invalid input, SLA, sorting, filter, and pagination tests pass | `feat(complaints): add validated complaint APIs` |
| FILE-01 | Move complaint evidence to private authorized storage/download flow | CMP-11, Data 12.3, NFR 14.1 | Unauthorized access fails; authorized upload/view/delete lifecycle passes | `fix(files): secure complaint attachments` |
| CMP-03 | Add warden assignment/reassignment and maintenance work queue APIs | CMP-03–CMP-04 | Only authorized roles assign; staff see only allowed work | `feat(complaints): add assignment and work queues` |
| CMP-04 | Add resolution evidence, immutable timeline, student close/reopen, and transition enforcement | CMP-05–CMP-08 | Full state machine and invalid transition tests pass | `feat(complaints): complete resolution and verification flow` |
| CMP-05 | Build student complaint list/detail/create screens to design specification | CMP-01, CMP-06–CMP-11, design 10.4–10.5 | Responsive states, attachment, timeline, close/reopen tests pass | `feat(frontend): complete student complaint workflow` |
| CMP-06 | Build warden complaint queue/detail/assignment screens | CMP-03, CMP-09–CMP-10, design 10.6 | Queue sorting, filters, detail drawer, and assignment tests pass | `feat(frontend): add warden complaint operations` |
| CMP-07 | Build maintenance work queue and resolution screens | CMP-04, CMP-07, design 10.7 | Assignee authorization and start/resolve UI tests pass | `feat(frontend): add maintenance work portal` |
| CMP-08 | Add complaint SLA metrics and breach escalation behavior | CMP-09, DASH-02–DASH-03 | Aggregate definitions reconcile with seeded records | `feat(complaints): add SLA monitoring and escalation` |

Phase 4 exit gate:

- Student → warden → maintenance → student complaint E2E passes.
- Every transition is server-enforced and audited.
- Attachments are private.
- SLA metrics use the PRD definitions and real data.

### Phase 5 — Leave and gate security

| Slice | Scope | PRD mapping | Verification | Recommended commit |
| --- | --- | --- | --- | --- |
| LEV-01 | Normalize leave date/time fields, statuses, decisions, pass, and event schema | LEV-01–LEV-04, Data Section 12 | Migration and state/date constraint tests pass | `feat(leave): define secure leave and pass model` |
| LEV-02 | Add validated leave application and overlap detection APIs | LEV-01–LEV-02 | Past, reversed, and overlapping leave tests pass | `feat(leave): validate student leave requests` |
| LEV-03 | Add warden decision workflow with notes and audit events | LEV-03 | Only pending requests may be decided; actor/note are audited | `feat(leave): add auditable warden decisions` |
| PASS-01 | Generate unique expiring pass tokens and private QR/PDF access | LEV-04–LEV-05, NFR 14.1 | Collision, expiry, authorization, and PDF failure tests pass | `feat(gate-pass): issue secure private passes` |
| GATE-01 | Implement authoritative verification and permitted-next-action API | LEV-06, GATE-01–GATE-03 | Invalid, expired, rejected, exited, and returned pass tests pass | `feat(gate): add authoritative pass verification` |
| GATE-02 | Implement transactional idempotent exit/return logging | LEV-07–LEV-09, GATE-06 | Repeated and concurrent scan tests create exactly one valid event | `feat(gate): make movement logging transactional` |
| GATE-03 | Add outside roster, movement history, expiry, overdue, and override APIs | LEV-10–LEV-12, GATE-04, GATE-07 | Roster/overdue/override permissions and audit tests pass | `feat(gate): add roster history and exception handling` |
| LEV-04 | Build student leave application/history/active pass screens | LEV-01–LEV-05, design 10.8 | Status semantics, dates, QR, private download, and error states pass | `feat(frontend): complete student leave and pass flow` |
| LEV-05 | Build warden leave review queue and decision screens | LEV-02–LEV-03, design 10.9 | Pending filter, conflict warning, decision dialog tests pass | `feat(frontend): add warden leave operations` |
| GATE-04 | Rebuild guard terminal, outside roster, and movement history screens | GATE-01–GATE-07, design 5.5 and 10.10 | Camera fallback, single-action, retry, touch, and viewport tests pass | `feat(frontend): complete guard security terminal` |

Phase 5 exit gate:

- Leave/gate flagship E2E passes.
- Repeated/concurrent scans do not duplicate events.
- Expired/reused passes cannot move students.
- PDF and QR resources are private.
- Current roster reconciles with gate events.

### Phase 6 — Mess, notices, and notifications

| Slice | Scope | PRD mapping | Verification | Recommended commit |
| --- | --- | --- | --- | --- |
| MESS-01 | Normalize calendar menu/menu-item model and date-specific APIs | MESS-01–MESS-02 | Same-date update/version and timezone/date tests pass | `feat(mess): add calendar-based menu management` |
| MESS-02 | Build student and warden menu calendar/editor screens | MESS-01–MESS-02, design 10.11 | Missing menu is honest; same-date editing and responsive tests pass | `feat(frontend): add mess menu calendar` |
| MESS-03 | Complete meal feedback with bounded rating/comment and real aggregates | MESS-03, MESS-06 | API/DB reject invalid ratings; no-data analytics remains empty | `feat(mess): add validated meal feedback` |
| MESS-04 | Complete mess issue evidence, history, states, and admin queue | MESS-04–MESS-05 | Student ownership, private evidence, and status transition tests pass | `feat(mess): complete issue resolution workflow` |
| NOT-01 | Add audience-scoped notices and per-recipient read state | NOT-01–NOT-03 | Cross-hostel visibility and read/unread tests pass | `feat(notices): add audience-scoped announcements` |
| NOT-02 | Add persistent in-app notification infrastructure and event links | NOT-04 | Complaint/leave/gate/notice events create authorized notifications | `feat(notifications): add in-app event notifications` |
| NOT-03 | Build notice list/editor and notification center | NOT-01–NOT-04, design 10.12 | Audience, read state, deep link, and responsive tests pass | `feat(frontend): add notices and notifications` |

Phase 6 exit gate:

- Menus are calendar-based and never fall back to fake food data.
- Ratings are constrained and aggregates are truthful.
- Students can see their mess issue history.
- Notices respect audience scope.
- In-app event notifications link only to authorized records.

### Phase 7 — Dashboards and reporting

| Slice | Scope | PRD mapping | Verification | Recommended commit |
| --- | --- | --- | --- | --- |
| DASH-01 | Add documented aggregate/query layer for PRD analytics definitions | DASH-01–DASH-05, Analytics Section 17 | Aggregate tests reconcile against deterministic seed fixtures | `feat(analytics): add defined operational metrics` |
| DASH-02 | Rebuild student, warden, maintenance, guard, and admin dashboards | DASH-01–DASH-05, design Sections 7 and 10 | Partial failure, no-data, links, and role tests pass | `feat(frontend): add role-specific operational dashboards` |
| RPT-01 | Add filtered complaint, gate, leave, and mess report APIs | RPT-01–RPT-03 | Time-range, permission, definition, and pagination tests pass | `feat(reports): add operational report queries` |
| RPT-02 | Add restrained charts, tables, and authorized CSV/PDF exports | RPT-01–RPT-03, design 8.12 and 10.13 | Exports reconcile with active filters and source records | `feat(frontend): add operational reports and exports` |

Phase 7 exit gate:

- All dashboard and report values follow PRD Section 17.
- Failed requests never display fabricated zeroes.
- Exports respect filters and permissions.
- Charts have no-data and accessible alternatives.

### Phase 8 — Production and portfolio release

| Slice | Scope | PRD mapping | Verification | Recommended commit |
| --- | --- | --- | --- | --- |
| TEST-03 | Complete backend unit/integration permission and workflow coverage | Testing Section 15 | All P0 service/route families have normal, invalid, unauthorized tests | `test(backend): cover critical workflows and permissions` |
| TEST-04 | Complete frontend component, accessibility, and role-flow coverage | Testing Section 15, design Section 15 | Component/accessibility suite passes | `test(frontend): cover critical role workflows` |
| E2E-01 | Add complaint and leave/gate Playwright journeys | Testing 15.2 | Required 12-step PRD E2E sequence passes in CI | `test(e2e): cover flagship hostel workflows` |
| PERF-01 | Add measured indexes/query tuning and demo-load verification | NFR 14.2, Success 16.2 | Seeded 10k-record profile meets documented targets or records results | `perf(api): optimize measured operational queries` |
| OPS-01 | Add structured logging, request IDs, health/readiness, graceful shutdown, error monitoring hooks | NFR 14.3–14.4 | Health, shutdown, log-redaction, and failure visibility checks pass | `feat(ops): add production observability` |
| SEC-01 | Run final upload, authorization, dependency, secret, CORS, and header hardening | NFR 14.1, launch criteria | Security checklist/scans pass with no known critical issue | `fix(security): complete release hardening` |
| CI-01 | Add CI for lint, typecheck, tests, build, migration checks, and security scans | Quality gates 15.3, Success 16.2 | Pull request workflow passes and fails intentionally broken checks | `ci: add full quality and security pipeline` |
| DEPLOY-01 | Add production containers/config and deploy frontend, API, database, object storage | Milestone E, launch criteria | Clean staging deployment and smoke/E2E tests pass | `chore(deploy): add production deployment configuration` |
| DOC-01 | Replace stale README and add ERD, architecture, API setup, demos, decisions, screenshots, and license | Success 16.2, launch criteria | Fresh-clone walkthrough succeeds using documentation only | `docs: publish complete project documentation` |
| RELEASE-01 | Final visual, accessibility, performance, security, and launch-criteria audit | PRD Section 19, design Section 18 | Every launch criterion is checked with evidence | `chore(release): prepare HostelMate resume-grade release` |

## 7. Requirement coverage map

| PRD area | Primary slices |
| --- | --- |
| AUTH-01–AUTH-14 | AUTH-01 through AUTH-06, API-01, API-02, FE-05, TEST-01/03 |
| RES-01–RES-09 | DB-01, RES-01 through RES-06 |
| CMP-01–CMP-13 | CMP-01 through CMP-08, FILE-01 |
| LEV-01–LEV-13 | LEV-01 through LEV-05, PASS-01, GATE-01 through GATE-04 |
| GATE-01–GATE-07 | GATE-01 through GATE-04, E2E-01 |
| MESS-01–MESS-08 | MESS-01 through MESS-04; P1 voting/version work follows P0 gate |
| NOT-01–NOT-05 | NOT-01 through NOT-03; email remains P1 |
| DASH-01–DASH-05 | DASH-01 and DASH-02 |
| RPT-01–RPT-03 | RPT-01 and RPT-02 |
| AUD-01–AUD-05 | AUD-01 plus workflow slices that emit events |
| API Section 11 | API-01, API-02, FE-02, feature API slices, DOC-01 |
| Data Section 12 | DB-01, DB-02, RES/CMP/LEV/MESS schema slices, FILE-01/PASS-01 |
| UX Section 13 | FE-03 through FE-07 and every feature frontend slice |
| NFR Section 14 | AUTH/API foundation, PERF-01, OPS-01, SEC-01, CI-01, DEPLOY-01 |
| Testing Section 15 | TEST-01 through TEST-04 and E2E-01 |
| Success Section 16 | Phase exit gates, PERF-01, CI-01, DOC-01, RELEASE-01 |

## 8. First implementation slice specification

The first source-code slice after the documentation baseline is `AUTH-01`.

### AUTH-01 objective

Eliminate the current privilege-escalation path in which public registration accepts a client-provided `role`.

### AUTH-01 exact boundary

Included:

- Define canonical role constants used by the registration policy.
- Ensure public registration always persists the `STUDENT` role.
- Ignore/reject attempts to choose a staff role, using the behavior selected during implementation review.
- Add regression coverage for attempted privileged public registration.
- Update only directly affected API documentation/example payloads if present.

Excluded:

- Admin staff-provisioning UI/API; that is `AUTH-05`.
- JWT expiry; that is `AUTH-03`.
- Full RBAC refactor; that is `AUTH-04`.
- Frontend protected routes; that is `FE-05`.
- General validation/error middleware; that is `API-01`.
- Database role enum migration unless the implementation cannot safely centralize roles without it; otherwise that belongs with `DB-01`.

### AUTH-01 verification evidence

- Student registration succeeds and returns `student`.
- Requests submitting `admin`, `warden`, `maintenance`, or `guard` cannot obtain those roles.
- Existing login behavior remains functional.
- Backend syntax/tests pass.
- Final diff contains no unrelated auth middleware or legacy frontend edits.

### AUTH-01 commit

```text
fix(auth): restrict public registration to students
```

## 9. Slice completion report template

Use this structure after every implemented slice:

```markdown
Implemented: <slice ID and name>

Changed:
- <observable behavior>
- <tests or migration>

Verified:
- `<command>` — passed
- `<command>` — passed

Not included:
- <explicit next-slice work>

Commit:
`<conventional commit message>`

Stage only:
`git add <exact changed paths>`
```

## 10. Plan change policy

This plan may be revised when implementation reveals a real dependency, but changes must be explicit:

- Explain why the existing order or boundary is unsafe or inefficient.
- Update the affected slice definition before broadening it.
- Preserve the one-slice/one-commit rule.
- Keep the PRD requirement coverage map accurate.
- Record product-scope changes in the PRD, not only in this implementation plan.
