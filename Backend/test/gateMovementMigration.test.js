import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL(
  "../drizzle/0014_transactional_gate_movements.sql",
  import.meta.url
);

test("gate movement migration validates and applies one atomic transition", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /FOR UPDATE OF lr/);
  assert.match(migration, /staff_role NOT IN \('guard', 'admin'\)/);
  assert.match(migration, /FROM "hostel_memberships"/);
  assert.match(migration, /gate_events_actor_identity_check/);
  assert.match(migration, /gate_events_active_pass_check/);
  assert.match(migration, /gate_events_movement_state_check/);
  assert.match(migration, /UPDATE "leave_requests"/);
});
