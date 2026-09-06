# Frontend architecture

## Canonical application

The frontend has one React application and one route tree:

```text
index.html
`-- src/main.jsx
    `-- src/auth/AuthContext.jsx
        `-- src/feedback/ToastProvider.jsx
            `-- src/App.jsx
                |-- src/layouts/PublicShell.jsx
                |   `-- public and not-found pages
                `-- src/auth/RouteGuards.jsx
                    `-- src/layouts/AuthenticatedShell.jsx
                        |-- role-aware navigation
                        `-- authenticated pages
```

`src/main.jsx` owns the browser bootstrap and router provider. `src/App.jsx`
owns the current route declarations and nests them under the applicable shell.
Page modules use the shared Axios client in `src/api/axios.js`. Global styles
enter the bundle once through `src/index.css`, imported by `src/main.jsx`.

Approved-student presentation rules live in
`src/onboarding/approvedStudentView.js`. The administrator onboarding page uses
server pagination and filtering, loads active hostel choices from the API, and
renders the same records as a comparison table on desktop and structured
records on mobile. It never receives or renders activation tokens.

Student activation validation and privacy-safe copy live in
`src/onboarding/studentActivation.js`. `/register` now requests an activation
email using an already-approved email and roll number; it shows the same result
whether a record matches or not. `/activate-student` reads the single-use token
from the emailed URL into component memory, removes it from the visible address,
and submits it only to the completion endpoint. Successful completion enters the
normal auth context instead of maintaining a second login state.

Resident presentation and validation rules live in `src/residents`. The student
profile page reads only the signed-in student's profile and edits the three
server-approved contact fields. The operations page keeps resident actions and
room inventory as two URL-backed peer views, uses server pagination, and opens
focused dialogs for allocation and vacancy instead of editing crowded rows.
Desktop tables have structured mobile record alternatives.

The auth provider treats the protected `/api/auth/me` response as the authority
for the current identity and role. Browser storage keeps the access token and a
display cache, but changing its cached `role` value cannot grant a route. A
stored token is checked before private content renders. Expired or invalid
sessions are cleared and return to sign-in; a temporary server failure keeps the
token and provides a retry action.

The feedback layer owns one bounded toast region for non-blocking action
confirmation. Data-driven pages use distinct `LoadingState`, `EmptyState`, and
`ErrorState` components, while consequential actions use the focus-managed
`ConfirmationDialog`. Pages must not use browser `alert`, `confirm`, or `prompt`
dialogs. API failure messages pass through `src/api/errors.js` so private error
objects are not rendered to users.

Frontend verification has two complementary layers. Node's built-in runner
keeps pure-function and source-boundary checks fast, while Vitest, jsdom, and
Testing Library render components and exercise them through accessible roles.
axe-core runs against critical component states. `npm.cmd test` executes both
layers so component coverage cannot be skipped accidentally.

The public shell provides the 64px public header and account-entry actions. The
authenticated shell provides the 232px desktop sidebar, 56px utility bar,
role-aware navigation, mobile drawer, account context, and sign-out action.
Pages declare their content width using the shared `hm-page-stack` modifiers;
the shell owns viewport padding.

New screens should not introduce another parallel role-specific application
tree. Feature folders can be introduced later when a feature has enough shared
components to justify one, but they must remain reachable from the single
`App.jsx` route graph.

## Current routes

| Audience | Route | Page |
| --- | --- | --- |
| Public | `/` | Landing page |
| Public | `/login` | Unified login |
| Public guest | `/register` | Student activation-email request |
| Public | `/activate-student` | Single-use student password setup and activation |
| Compatibility | `/student/login` | Unified login |
| Compatibility | `/student/register` | Student activation-email request alias |
| Compatibility | `/admin/login` | Unified login |
| Student | `/student/dashboard` | Student dashboard |
| Student | `/student/complaints` | Student complaints |
| Student | `/student/complaints/raise` | Complaint submission |
| Student | `/student/leaves` | Student leave requests |
| Student | `/student/leaves/apply` | Leave application |
| Student | `/student/mess` | Mess menu and feedback |
| Student | `/student/profile` | Own profile, contact details, and current room |
| Operations | `/admin/dashboard` | Warden/admin dashboard |
| Operations | `/admin/residents` | Resident directory, allocations, and room occupancy |
| Operations | `/admin/complaints` | Complaint operations |
| Operations | `/admin/leaves` | Leave operations |
| Operations | `/admin/mess` | Mess operations |
| Administrator | `/admin/student-approvals` | Student onboarding and activation eligibility |
| Guard | `/guard/terminal` | Gate terminal |
| Authenticated | `/unauthorized` | Role-access explanation |
| Public fallback | `*` | Not-found page with a safe return action |

The compatibility routes are aliases in the canonical route tree, not separate
login applications. Authentication bootstrap and direct-URL protection are
active. Student pages, including the own-profile page, accept the student role.
Resident and room operations accept admin and warden roles. Mess reading
currently accepts student and maintenance roles, and the gate terminal accepts
admin and guard roles. The backend remains the final authority for every API
action. Student onboarding is administrator-only and is not included in the
warden operations navigation.

## Removed legacy implementation

FE-01 removed the disconnected `src/Admin`, `src/Student`, and `src/Home`
trees. They duplicated authentication, layouts, dashboards, and feature pages
but were not imported by `index.html`, `main.jsx`, `App.jsx`, or any active
module.

The same cleanup removed three unused duplicate auth pages, their unreachable
dashboard hook, the unused `App.css`, and Vite/React starter artwork. The HTML
entry now contains the HostelMate title and imports global styles only through
the JavaScript entry point.
