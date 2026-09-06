# Automated testing workflow

## Frontend testing workflow

Run these commands from `Frontend/`:

```powershell
npm.cmd test
npm.cmd run test:unit
npm.cmd run test:components
npm.cmd run test:components:watch
```

`npm.cmd test` is the complete frontend test command. It runs the existing fast
Node tests first, followed by the jsdom component suite. The watch command is
intended for local development and is not a CI quality gate.

### Frontend test organization

- `Frontend/test/*.test.js` contains source-boundary and pure-function tests
  executed by Node's built-in test runner.
- `Frontend/test/components/*.test.jsx` contains rendered React tests executed
  by Vitest and Testing Library.
- `Frontend/test/setup/componentTestSetup.js` owns shared jsdom cleanup and
  browser API shims.
- `Frontend/test/support/accessibility.js` runs axe-core checks and formats
  failures consistently.

Component tests do not call a live API. Network clients are mocked at the module
boundary so route, form, loading, error, and success behavior remains
deterministic. Prefer user-visible roles and labels over CSS selectors when
driving a component.

axe-core checks semantic markup, accessible names, form relationships, ARIA,
and other DOM-level rules. Its color-contrast rule is disabled in jsdom because
jsdom does not calculate layout or rendered colors. Contrast remains part of
design-token review and browser-level visual verification.

## Backend testing workflow

## Purpose

The backend test workflow runs fast unit tests and real PostgreSQL integration
tests without using development data. The integration suite applies every
versioned migration to an empty database before running.

## Commands

Run these commands from `Backend/`:

```powershell
npm.cmd test
npm.cmd run test:unit
npm.cmd run test:integration
```

`npm.cmd test` is the complete local quality gate. It runs unit tests first and
then the PostgreSQL integration tests.

## Default: disposable Docker database

When `TEST_DATABASE_URL` is not configured, the runner starts
`postgres:16-alpine` from `compose.test.yaml`. Docker assigns an unused local
port, the database uses temporary storage, and the runner removes the container
after the suite finishes.

Docker Desktop or another Docker-compatible runtime must be running.

## Optional: existing test database

Copy `.env.test.example` to `.env.test` and provide a dedicated PostgreSQL
database when Docker is not available:

```dotenv
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/hostelmate_test
```

The configured user must own that test database because the harness recreates
the `public` and `drizzle` schemas before and after every integration run.

Never point this variable at a development, staging, or production database.

## Safety guarantees

Before any schema is reset, the runner:

1. Reads only `TEST_DATABASE_URL`; it never falls back to `DATABASE_URL`.
2. Requires the database name to contain a separate `test` segment, such as
   `hostelmate_test` or `test-hostelmate`.
3. Rejects a target with the same host, port, and database name as the configured
   development database.
4. Takes a PostgreSQL advisory lock so two suites cannot reset the same test
   database concurrently.
5. Resets only the dedicated database's `public` and `drizzle` schemas.

The database URL and its credentials are never printed by the test runner.

## Test organization

- `Backend/test/*.test.js` contains unit and boundary tests that do not require a
  live database.
- `Backend/test/integration/*.integration.test.js` contains tests that execute
  against PostgreSQL. Integration files run sequentially because they share one
  freshly migrated database.
- `Backend/test/support/` contains test-only lifecycle helpers.

The initial integration suite verifies fresh migrations, database constraints,
transaction rollback, Drizzle queries, and append-only audit behavior. Future
workflow slices should add their PostgreSQL cases to the integration directory.
