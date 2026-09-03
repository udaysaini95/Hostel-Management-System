import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { auditEventQuerySchema } from "../src/validation/auditSchemas.js";

test("audit query validation supplies bounded pagination defaults", () => {
  const result = auditEventQuerySchema.query.safeParse({});

  assert.equal(result.success, true);
  assert.deepEqual(result.data, { page: 1, pageSize: 25 });
  assert.equal(
    auditEventQuerySchema.query.safeParse({ pageSize: "101" }).success,
    false
  );
});

test("audit query validation rejects reversed date ranges", () => {
  const result = auditEventQuerySchema.query.safeParse({
    from: "2026-09-05T00:00:00.000Z",
    to: "2026-09-04T00:00:00.000Z",
  });

  assert.equal(result.success, false);
  assert.equal(result.error.issues[0].path[0], "to");
});

test("audit migration prevents event and scope mutation", async () => {
  const migration = await readFile(
    new URL("../drizzle/0004_immutable_audit_events.sql", import.meta.url),
    "utf8"
  );

  assert.match(migration, /CREATE TRIGGER "audit_events_immutable"/);
  assert.match(migration, /CREATE TRIGGER "audit_event_hostels_immutable"/);
  assert.equal((migration.match(/BEFORE UPDATE OR DELETE/g) ?? []).length, 2);
});
