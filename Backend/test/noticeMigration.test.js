import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL("../drizzle/0019_audience_scoped_notices.sql", import.meta.url);

test("notice migration installs audience, recipient, and immutability guards", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /CREATE TABLE "notices"/);
  assert.match(migration, /CREATE TABLE "notice_recipients"/);
  assert.match(migration, /notices_audience_shape_check/);
  assert.match(migration, /notice_publication_guard/);
  assert.match(migration, /notice_recipient_scope_guard/);
  assert.match(migration, /New notice recipients must start unread/);
  assert.match(migration, /Published notices are immutable/);
  assert.match(migration, /Only the first notice read timestamp may be recorded/);
});
