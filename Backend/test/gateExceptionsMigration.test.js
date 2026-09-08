import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL(
  "../drizzle/0015_gate_roster_and_exceptions.sql",
  import.meta.url
);

test("gate exception migration separates standard scans from overrides", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /is_override :=/);
  assert.match(migration, /staff_role NOT IN \('warden', 'admin'\)/);
  assert.match(migration, /staff_role NOT IN \('guard', 'admin'\)/);
  assert.match(migration, /Warden is outside the leave hostel/);
  assert.match(migration, /gate_events_active_pass_check/);
  assert.match(migration, /gate_events_movement_state_check/);
  assert.match(migration, /UPDATE "leave_requests"/);
});
