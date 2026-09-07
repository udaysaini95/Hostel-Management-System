import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL(
  "../drizzle/0008_student_complaint_closure.sql",
  import.meta.url
);

test("assignment closure permits only the reporting student after closure", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /ending_actor_role = 'student'/);
  assert.match(
    migration,
    /NEW\."ended_by_user_id" IS DISTINCT FROM complaint_reporter_id/
  );
  assert.match(
    migration,
    /complaint_current_status IS DISTINCT FROM 'closed'/
  );
});

test("assignment closure keeps manager scope and history protections", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /Assignment identity and start details are immutable/);
  assert.match(migration, /A completed assignment cannot be changed/);
  assert.match(migration, /Ending warden must belong to the complaint hostel/);
});
