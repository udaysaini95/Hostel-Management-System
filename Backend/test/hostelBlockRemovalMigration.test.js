import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL(
  "../drizzle/0023_remove_hostel_blocks.sql",
  import.meta.url
);

test("block removal migration preserves room ownership before dropping blocks", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  const addHostelId = migration.indexOf(
    'ALTER TABLE "rooms" ADD COLUMN "hostel_id"'
  );
  const copyHostelId = migration.indexOf(
    'SET "hostel_id" = block."hostel_id"'
  );
  const dropBlocks = migration.indexOf('DROP TABLE "hostel_blocks"');

  assert.ok(addHostelId >= 0);
  assert.ok(copyHostelId > addHostelId);
  assert.ok(dropBlocks > copyHostelId);
  assert.match(migration, /rooms_hostel_number_unique/);
  assert.match(migration, /rooms_hostel_id_hostels_id_fk/);
});

test("block removal migration updates dependent complaint and notice rules", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /CREATE OR REPLACE FUNCTION validate_complaint_scope/);
  assert.match(migration, /FROM "rooms" WHERE "id" = NEW\."room_id"/);
  assert.match(migration, /UPDATE "notices" SET "audience_type" = 'hostel'/);
  assert.match(
    migration,
    /CREATE TYPE "notice_audience_type" AS ENUM \('all_residents', 'role', 'hostel'\)/
  );
  assert.match(migration, /CREATE TRIGGER "notice_publication_guard"/);
  assert.match(migration, /CREATE TRIGGER "notice_recipient_scope_guard"/);
});
