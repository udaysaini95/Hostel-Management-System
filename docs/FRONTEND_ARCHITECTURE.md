# Frontend architecture

## Canonical application

The frontend has one React application and one route tree:

```text
index.html
`-- src/main.jsx
    `-- src/App.jsx
        |-- src/components/Navbar.jsx
        `-- src/pages/*.jsx
```

`src/main.jsx` owns the browser bootstrap and router provider. `src/App.jsx`
owns the current route declarations. Page modules use the shared Axios client in
`src/api/axios.js`. Global styles enter the bundle once through
`src/index.css`, imported by `src/main.jsx`.

New screens should not introduce another parallel role-specific application
tree. Feature folders can be introduced later when a feature has enough shared
components to justify one, but they must remain reachable from the single
`App.jsx` route graph.

## Current routes

| Audience | Route | Page |
| --- | --- | --- |
| Public | `/` | Landing page |
| Public | `/login` | Unified login |
| Public | `/register` | Approved-student activation entry |
| Compatibility | `/student/login` | Unified login |
| Compatibility | `/student/register` | Approved-student activation entry |
| Compatibility | `/admin/login` | Unified login |
| Student | `/student/dashboard` | Student dashboard |
| Student | `/student/complaints` | Student complaints |
| Student | `/student/complaints/raise` | Complaint submission |
| Student | `/student/leaves` | Student leave requests |
| Student | `/student/leaves/apply` | Leave application |
| Student | `/student/mess` | Mess menu and feedback |
| Operations | `/admin/dashboard` | Warden/admin dashboard |
| Operations | `/admin/complaints` | Complaint operations |
| Operations | `/admin/leaves` | Leave operations |
| Operations | `/admin/mess` | Mess operations |
| Guard | `/guard/terminal` | Gate terminal |

The compatibility routes are aliases in the canonical route tree, not separate
login applications. Route protection and role-aware application shells are
scheduled for FE-05 and FE-04 respectively.

## Removed legacy implementation

FE-01 removed the disconnected `src/Admin`, `src/Student`, and `src/Home`
trees. They duplicated authentication, layouts, dashboards, and feature pages
but were not imported by `index.html`, `main.jsx`, `App.jsx`, or any active
module.

The same cleanup removed three unused duplicate auth pages, their unreachable
dashboard hook, the unused `App.css`, and Vite/React starter artwork. The HTML
entry now contains the HostelMate title and imports global styles only through
the JavaScript entry point.
