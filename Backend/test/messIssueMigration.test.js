import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL("../drizzle/0018_mess_issue_workflow.sql", import.meta.url);

test("mess issue migration installs scoped workflow history and private evidence", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /RENAME TO "legacy_mess_issues"/);
  assert.match(migration, /CREATE TYPE "mess_issue_status"/);
  assert.match(migration, /CREATE TABLE "mess_issue_events"/);
  assert.match(migration, /CREATE TABLE "mess_issue_attachments"/);
  assert.match(migration, /mess_issue_reporter_scope_guard/);
  assert.match(migration, /mess_issue_status_transition_check/);
  assert.match(migration, /mess_issue_event_scope_guard/);
  assert.match(migration, /Mess issue history is immutable/);
});
