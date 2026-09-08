import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL(
  "../drizzle/0010_leave_gate_foundation.sql",
  import.meta.url
);

test("leave migration preserves legacy leave and gate records", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  const leaveRename = migration.indexOf(
    'ALTER TABLE "leaves" RENAME TO "legacy_leaves"'
  );
  const normalizedCreate = migration.indexOf(
    'CREATE TABLE "leave_requests"'
  );

  assert.ok(leaveRename >= 0);
  assert.ok(normalizedCreate > leaveRename);
  assert.match(
    migration,
    /ALTER TABLE "gate_logs" RENAME TO "legacy_gate_logs"/
  );
  assert.equal(migration.includes('DROP TABLE "leaves"'), false);
  assert.equal(migration.includes('DROP TABLE "gate_logs"'), false);
});

test("leave migration installs normalized integrity and history guards", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /CREATE TYPE "public"\."leave_status"/);
  assert.match(migration, /leave_requests_departure_future_check/);
  assert.match(migration, /leave_requests_date_order_check/);
  assert.match(migration, /gate_passes_token_hash_check/);
  assert.match(migration, /gate_events_one_movement_per_leave/);
  assert.match(migration, /leave_requests_guard/);
  assert.match(migration, /leave_events_immutable/);
  assert.match(migration, /gate_events_immutable/);
});
