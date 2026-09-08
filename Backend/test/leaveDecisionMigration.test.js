import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL(
  "../drizzle/0012_auditable_leave_decisions.sql",
  import.meta.url
);

test("leave decision migration validates staff and applies status atomically", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /FROM "leave_requests"[\s\S]*FOR UPDATE/);
  assert.match(migration, /staff_role NOT IN \('warden', 'admin'\)/);
  assert.match(migration, /FROM "hostel_memberships"/);
  assert.match(migration, /leave_decisions_actor_identity_check/);
  assert.match(migration, /UPDATE "leave_requests"/);
  assert.match(migration, /leave_decisions_apply_status/);
});
