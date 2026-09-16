import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  HOSTEL_RESIDENT_TYPES,
  STUDENT_HOUSING_TYPES,
  isHousingCompatible,
} from "../src/domain/hostels.js";
import { hasPermission, PERMISSIONS } from "../src/domain/permissions.js";
import { USER_ROLES } from "../src/domain/roles.js";
import {
  hostelCreateRequestSchema,
  hostelStatusRequestSchema,
  hostelUpdateRequestSchema,
} from "../src/validation/hostelSchemas.js";

const routePath = fileURLToPath(
  new URL("../src/Routes/adminRoutes.js", import.meta.url)
);
const migrationPath = fileURLToPath(
  new URL("../drizzle/0021_hostel_resident_types.sql", import.meta.url)
);
const studentHousingMigrationPath = fileURLToPath(
  new URL("../drizzle/0022_student_housing_eligibility.sql", import.meta.url)
);

test("only administrators can manage hostel setup", () => {
  assert.equal(hasPermission(USER_ROLES.ADMIN, PERMISSIONS.HOSTEL_MANAGE), true);
  assert.equal(hasPermission(USER_ROLES.WARDEN, PERMISSIONS.HOSTEL_MANAGE), false);
  assert.equal(hasPermission(USER_ROLES.STUDENT, PERMISSIONS.HOSTEL_MANAGE), false);
});

test("hostel input requires a permanent code and resident classification", () => {
  const valid = hostelCreateRequestSchema.body.safeParse({
    code: "GH1",
    name: "Gargi Residence",
    residentType: HOSTEL_RESIDENT_TYPES.GIRLS,
    address: "East campus",
  });
  assert.equal(valid.success, true);

  const invalid = hostelCreateRequestSchema.body.safeParse({
    code: "girls hostel",
    name: "G",
    residentType: "unknown",
  });
  assert.equal(invalid.success, false);
});

test("student housing eligibility accepts matching and co-ed hostels", () => {
  assert.equal(
    isHousingCompatible(
      STUDENT_HOUSING_TYPES.GIRLS,
      HOSTEL_RESIDENT_TYPES.GIRLS
    ),
    true
  );
  assert.equal(
    isHousingCompatible(
      STUDENT_HOUSING_TYPES.GIRLS,
      HOSTEL_RESIDENT_TYPES.CO_ED
    ),
    true
  );
  assert.equal(
    isHousingCompatible(
      STUDENT_HOUSING_TYPES.GIRLS,
      HOSTEL_RESIDENT_TYPES.BOYS
    ),
    false
  );
});

test("hostel updates reject empty bodies and status accepts booleans only", () => {
  assert.equal(hostelUpdateRequestSchema.body.safeParse({}).success, false);
  assert.equal(
    hostelStatusRequestSchema.body.safeParse({ isActive: false }).success,
    true
  );
  assert.equal(
    hostelStatusRequestSchema.body.safeParse({ isActive: "false" }).success,
    false
  );
});

test("admin routes expose CRUD without a destructive delete endpoint", async () => {
  const source = await readFile(routePath, "utf8");
  assert.match(source, /router\.get\(\s*"\/hostels"/);
  assert.match(source, /router\.post\(\s*"\/hostels"/);
  assert.match(source, /router\.patch\(\s*"\/hostels\/:id"/);
  assert.match(source, /router\.patch\(\s*"\/hostels\/:id\/status"/);
  assert.doesNotMatch(source, /router\.delete\(\s*"\/hostels/);
});

test("migration adds a constrained resident type with a safe legacy default", async () => {
  const migration = await readFile(migrationPath, "utf8");
  assert.match(migration, /ENUM\('boys', 'girls', 'co_ed'\)/);
  assert.match(migration, /DEFAULT 'co_ed' NOT NULL/);
});

test("student housing migration preserves legacy rows while constraining new values", async () => {
  const migration = await readFile(studentHousingMigrationPath, "utf8");

  assert.match(migration, /ENUM\('boys', 'girls'\)/);
  assert.match(migration, /"approved_students" ADD COLUMN "housing_type"/);
  assert.match(migration, /"student_profiles" ADD COLUMN "housing_type"/);
  assert.doesNotMatch(migration, /housing_type[^;]*NOT NULL/);
});
