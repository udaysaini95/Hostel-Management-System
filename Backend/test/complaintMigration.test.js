import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL(
  "../drizzle/0006_complaint_workflow_foundation.sql",
  import.meta.url
);

test("complaint migration preserves legacy data before creating the new table", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  const renamePosition = migration.indexOf(
    'ALTER TABLE "complaints" RENAME TO "legacy_complaints"'
  );
  const createPosition = migration.indexOf('CREATE TABLE "complaints"');

  assert.ok(renamePosition >= 0);
  assert.ok(createPosition > renamePosition);
  assert.match(
    migration,
    /ALTER SEQUENCE "complaints_id_seq" RENAME TO "legacy_complaints_id_seq"/
  );
  assert.match(
    migration,
    /RENAME CONSTRAINT "complaints_pkey" TO "legacy_complaints_pkey"/
  );
  assert.equal(migration.includes('DROP TABLE "complaints"'), false);
  assert.equal(migration.includes('DROP COLUMN "user_id"'), false);
});

test("complaint migration installs defaults and database workflow guards", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /INSERT INTO "complaint_categories"/);
  assert.match(migration, /complaint_events_immutable/);
  assert.match(migration, /complaints_scope_guard/);
  assert.match(migration, /complaint_assignments_guard/);
  assert.match(
    migration,
    /complaint_assignments_one_active_per_complaint/
  );
});
