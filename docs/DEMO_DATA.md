# HostelMate Demo Data

The demo seed is deterministic, fictional, and intended only for local or dedicated demo databases. All accounts use the reserved `.example` domain and must never be treated as real email inboxes.

## Safety requirements

- The seed refuses to run when `NODE_ENV=production`.
- `DATABASE_URL` must be explicitly configured.
- `ALLOW_DEMO_SEED=true` must be explicitly configured.
- `DEMO_SEED_PASSWORD` must contain at least 12 characters.
- The reset command removes only the known demo users, profiles, room allocations, rooms, blocks, and `H1`/`H2` hostels, then recreates them in one transaction.

## Setup and commands

From `Backend/`, configure a disposable development or demo database in `.env`, then run:

```powershell
npm run db:migrate
npm run db:seed
```

Re-running `db:seed` updates the same records instead of creating duplicate hostels, blocks, rooms, users, profiles, memberships, or active room allocations.

To restore only the known demo dataset:

```powershell
npm run db:seed:reset
```

Do not point either seed command at a database containing valuable data.

## Fictional demo accounts

The password is the configured `DEMO_SEED_PASSWORD`; there is no fallback password.

| Role | Email | Hostel access |
| --- | --- | --- |
| Admin | `admin@hostelmate.example` | Institution-wide |
| Warden | `warden.h1@hostelmate.example` | H1 |
| Maintenance | `maintenance@hostelmate.example` | H1 and H2 |
| Guard | `guard.h2@hostelmate.example` | H2 |
| Student | `student.h1@hostelmate.example` | H1, room A-101 |
| Student | `student.h2@hostelmate.example` | H2, room B-204 |

The two hostel records are `H1` / North Residence Hall and `H2` / South Residence Hall. H1 contains Ashoka Block (`A`) with rooms 101 and 102; H2 contains Banyan Block (`B`) with room 204. Every room has a demo capacity of two residents.
