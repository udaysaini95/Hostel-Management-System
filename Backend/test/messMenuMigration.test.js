import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL(
  "../drizzle/0016_calendar_mess_menus.sql",
  import.meta.url
);

test("mess menu migration adds hostel-scoped dates and immutable revisions", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /RENAME TO "legacy_mess_menus"/);
  assert.match(migration, /"menu_date" date NOT NULL/);
  assert.match(migration, /"hostel_id" integer NOT NULL/);
  assert.match(migration, /CREATE TABLE "mess_menu_versions"/);
  assert.match(migration, /CREATE TABLE "mess_menu_items"/);
  assert.match(migration, /mess_menus_hostel_date_unique/);
  assert.match(migration, /mess_menu_versions_menu_version_unique/);
  assert.match(migration, /mess_menu_revision_scope_guard/);
  assert.match(migration, /Mess menu history is immutable/);
  assert.match(migration, /mess_menu_identity_guard/);
});
