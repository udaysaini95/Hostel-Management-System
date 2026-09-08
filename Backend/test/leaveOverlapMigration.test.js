import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL(
  "../drizzle/0011_leave_overlap_guard.sql",
  import.meta.url
);

test("leave overlap migration rejects concurrent active conflicts", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /CREATE EXTENSION IF NOT EXISTS btree_gist/);
  assert.match(migration, /EXCLUDE USING gist/);
  assert.match(
    migration,
    /tstzrange\("departure_at", "expected_return_at", '\[\)'\) WITH &&/
  );
  assert.match(migration, /leave_requests_no_active_overlap/);
});
