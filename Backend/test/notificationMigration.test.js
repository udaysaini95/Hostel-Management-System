import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL("../drizzle/0020_in_app_notifications.sql", import.meta.url);

test("notification migration installs safe target and immutable read-state guards", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /CREATE TABLE "notifications"/);
  assert.match(migration, /notification_event_type/);
  assert.match(migration, /notifications_link_path_check/);
  assert.match(migration, /notification_target_guard/);
  assert.match(migration, /notice_recipients/);
  assert.match(migration, /complaint_assignments/);
  assert.match(migration, /New notifications must start unread/);
  assert.match(migration, /Only the first notification read timestamp may be recorded/);
});
