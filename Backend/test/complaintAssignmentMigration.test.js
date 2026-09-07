import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL(
  "../drizzle/0007_assignment_history_guard.sql",
  import.meta.url
);

test("assignment guard validates current scope only when history is created", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  const insertBranch = migration.indexOf("IF TG_OP = 'INSERT' THEN");
  const assigneeCheck = migration.indexOf(
    "Complaint assignee must belong to the complaint hostel"
  );
  const updateBranch = migration.indexOf("ELSE", insertBranch);

  assert.ok(insertBranch >= 0);
  assert.ok(assigneeCheck > insertBranch);
  assert.ok(updateBranch > assigneeCheck);
  assert.match(migration, /Assignment identity and start details are immutable/);
  assert.match(migration, /A completed assignment cannot be changed/);
});

test("assignment guard checks the current warden when history is closed", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /Ending warden must belong to the complaint hostel/);
  assert.match(
    migration,
    /ending_actor_role NOT IN \('warden', 'admin'\)/
  );
});
