import test from "node:test";
import assert from "node:assert/strict";
import { USER_ROLES } from "../src/domain/roles.js";
import {
  DEMO_HOSTELS,
  DEMO_USERS,
  assertDemoSeedAllowed,
  seedDemoData,
} from "../src/db/demoSeed.js";

test("demo seed identities are fictional, unique, and cover every role", () => {
  const emails = DEMO_USERS.map((user) => user.email);
  const seededRoles = new Set(DEMO_USERS.map((user) => user.role));

  assert.equal(new Set(emails).size, emails.length);
  assert.ok(emails.every((email) => email.endsWith(".example")));
  assert.deepEqual(seededRoles, new Set(Object.values(USER_ROLES)));
  assert.ok(DEMO_USERS.every((user) => !("password" in user)));
});

test("demo hostel codes and memberships are internally consistent", () => {
  const hostelCodes = DEMO_HOSTELS.map((hostel) => hostel.code);
  const knownHostelCodes = new Set(hostelCodes);

  assert.deepEqual(hostelCodes, ["H1", "H2"]);
  assert.equal(new Set(hostelCodes).size, hostelCodes.length);

  for (const user of DEMO_USERS) {
    assert.ok(user.hostelCodes.every((code) => knownHostelCodes.has(code)));

    if (user.role === USER_ROLES.ADMIN) {
      assert.deepEqual(user.hostelCodes, []);
      assert.equal(user.primaryHostelCode, null);
      continue;
    }

    assert.ok(user.hostelCodes.length > 0);
    assert.ok(user.hostelCodes.includes(user.primaryHostelCode));
  }

  assert.ok(
    DEMO_USERS.some(
      (user) =>
        user.role !== USER_ROLES.ADMIN && user.hostelCodes.length > 1
    )
  );
});

test("demo seeding requires explicit non-production configuration", () => {
  assert.throws(
    () =>
      assertDemoSeedAllowed({
        NODE_ENV: "production",
        ALLOW_DEMO_SEED: "true",
        DATABASE_URL: "postgresql://demo.invalid/database",
        DEMO_SEED_PASSWORD: "valid-demo-password",
      }),
    /disabled in production/
  );
  assert.throws(
    () =>
      assertDemoSeedAllowed({
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://demo.invalid/database",
        DEMO_SEED_PASSWORD: "valid-demo-password",
      }),
    /ALLOW_DEMO_SEED=true/
  );
  assert.throws(
    () =>
      assertDemoSeedAllowed({
        NODE_ENV: "development",
        ALLOW_DEMO_SEED: "true",
        DEMO_SEED_PASSWORD: "valid-demo-password",
      }),
    /DATABASE_URL is required/
  );
  assert.doesNotThrow(() =>
    assertDemoSeedAllowed({
      NODE_ENV: "development",
      ALLOW_DEMO_SEED: "true",
      DATABASE_URL: "postgresql://demo.invalid/database",
      DEMO_SEED_PASSWORD: "valid-demo-password",
    })
  );
});

test("demo seeding validates its password before opening a database connection", () => {
  assert.throws(
    () =>
      assertDemoSeedAllowed({
        NODE_ENV: "development",
        ALLOW_DEMO_SEED: "true",
        DATABASE_URL: "postgresql://demo.invalid/database",
      }),
    /DEMO_SEED_PASSWORD must contain at least 12 characters/
  );
});

test("demo seeding rejects weak shared passwords before database access", async () => {
  await assert.rejects(() => seedDemoData(null, "too-short"), /12 characters/);
});
