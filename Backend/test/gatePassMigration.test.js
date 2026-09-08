import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL(
  "../drizzle/0013_secure_gate_pass_artifacts.sql",
  import.meta.url
);

test("gate pass migration protects issuance and private artifact records", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /ADD COLUMN "qr_storage_key"/);
  assert.match(migration, /request_status NOT IN \('approved', 'exited', 'returned', 'expired'\)/);
  assert.match(migration, /issuer_role NOT IN \('warden', 'admin'\)/);
  assert.match(migration, /gate_passes_approval_decision_check/);
  assert.match(migration, /gate_passes_artifacts_required_check/);
  assert.match(migration, /Gate pass identity and artifacts are immutable/);
  assert.match(migration, /gate_passes_write_guard/);
});
