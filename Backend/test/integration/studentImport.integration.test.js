import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { count, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../src/db/schema.js";
import {
  approvedStudents,
  auditEventHostels,
  auditEvents,
  hostels,
  users,
} from "../../src/db/schema.js";
import { ACCOUNT_STATUSES } from "../../src/domain/accountStatuses.js";
import { AUDIT_ACTIONS } from "../../src/domain/auditEvents.js";
import { HOSTEL_RESIDENT_TYPES } from "../../src/domain/hostels.js";
import { USER_ROLES } from "../../src/domain/roles.js";
import { importStudentApprovals } from "../../src/services/studentImportService.js";

const { Pool } = pg;

if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    "Integration tests must be started through npm test or npm run test:integration."
  );
}

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 4 });
const database = drizzle(pool, { schema });

let administrator;
let warden;

before(async () => {
  await database.insert(hostels).values([
    {
      code: "CI1",
      name: "CSV Import Hostel One",
      residentType: HOSTEL_RESIDENT_TYPES.GIRLS,
    },
    {
      code: "CI2",
      name: "CSV Import Hostel Two",
      residentType: HOSTEL_RESIDENT_TYPES.BOYS,
    },
    {
      code: "CIX",
      name: "Inactive CSV Import Hostel",
      residentType: HOSTEL_RESIDENT_TYPES.GIRLS,
      isActive: false,
    },
  ]);

  [administrator, warden] = await database
    .insert(users)
    .values([
      {
        name: "CSV Import Administrator",
        email: "admin@csv-import.integration.test",
        password: "not-a-real-password-hash",
        role: USER_ROLES.ADMIN,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
      },
      {
        name: "CSV Import Warden",
        email: "warden@csv-import.integration.test",
        password: "not-a-real-password-hash",
        role: USER_ROLES.WARDEN,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
      },
    ])
    .returning();
});

after(async () => {
  await pool.end();
});

test("CSV import keeps an administrator boundary inside the service", async () => {
  const csv = [
    "name,email,roll_no,housing_type,hostel_code",
    "Asha Rao,access-check@csv-import.test,CI-000,girls,CI1",
  ].join("\n");

  await assert.rejects(
    importStudentApprovals(database, csv, warden.id, { dryRun: true }),
    (error) => error.code === "STUDENT_IMPORT_ACCESS_DENIED"
  );
});

test("CSV dry run validates rows without writing approvals or audit events", async () => {
  const csv = [
    "name,email,roll_no,housing_type,hostel_code",
    '"Rao, Asha",ASHA@CSV-IMPORT.TEST, ci-001 ,girls,ci1',
    "Kabir Sen,kabir@csv-import.test,CI-002,boys,CI2",
  ].join("\n");
  const result = await importStudentApprovals(
    database,
    csv,
    administrator.id,
    { dryRun: true }
  );
  const [approvalCount] = await database
    .select({ total: count() })
    .from(approvedStudents)
    .where(
      inArray(approvedStudents.email, [
        "asha@csv-import.test",
        "kabir@csv-import.test",
      ])
    );
  const [auditCount] = await database
    .select({ total: count() })
    .from(auditEvents)
    .where(eq(auditEvents.action, AUDIT_ACTIONS.STUDENT_APPROVALS_IMPORTED));

  assert.equal(result.report.mode, "dry-run");
  assert.equal(result.report.canImport, true);
  assert.deepEqual(result.report.summary, {
    totalRows: 2,
    validRows: 2,
    invalidRows: 0,
    importedRows: 0,
  });
  assert.equal(Number(approvalCount.total), 0);
  assert.equal(Number(auditCount.total), 0);
});

test("an invalid row prevents every row in the file from being imported", async () => {
  const csv = [
    "name,email,roll_no,housing_type,hostel_code",
    "Valid Student,valid@csv-import.test,CI-003,girls,CI1",
    "Inactive Hostel,inactive@csv-import.test,CI-004,boys,CIX",
  ].join("\n");
  const result = await importStudentApprovals(
    database,
    csv,
    administrator.id,
    { dryRun: false }
  );
  const [approvalCount] = await database
    .select({ total: count() })
    .from(approvedStudents)
    .where(
      inArray(approvedStudents.email, [
        "valid@csv-import.test",
        "inactive@csv-import.test",
      ])
    );

  assert.equal(result.report.canImport, false);
  assert.equal(result.report.summary.invalidRows, 1);
  assert.equal(result.report.rows[1].errors[0].code, "HOSTEL_NOT_FOUND");
  assert.equal(Number(approvalCount.total), 0);
});

test("CSV validation rejects a hostel that does not match housing eligibility", async () => {
  const csv = [
    "name,email,roll_no,housing_type,hostel_code",
    "Wrong Hostel,mismatch@csv-import.test,CI-005,girls,CI2",
  ].join("\n");
  const result = await importStudentApprovals(
    database,
    csv,
    administrator.id,
    { dryRun: true }
  );

  assert.equal(result.report.canImport, false);
  assert.equal(result.report.rows[0].errors[0].code, "HOSTEL_HOUSING_MISMATCH");
});

test("a valid import writes one complete batch and one scoped audit event", async () => {
  const now = new Date("2026-09-07T12:00:00.000Z");
  const csv = [
    "name,email,roll_no,housing_type,hostel_code",
    '"Rao, Asha",ASHA@CSV-IMPORT.TEST, ci-001 ,girls,ci1',
    "Kabir Sen,kabir@csv-import.test,CI-002,boys,CI2",
  ].join("\n");
  const result = await importStudentApprovals(
    database,
    csv,
    administrator.id,
    { dryRun: false, now }
  );
  const storedApprovals = await database
    .select()
    .from(approvedStudents)
    .where(
      inArray(approvedStudents.email, [
        "asha@csv-import.test",
        "kabir@csv-import.test",
      ])
    );
  const [auditEvent] = await database
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.action, AUDIT_ACTIONS.STUDENT_APPROVALS_IMPORTED));
  const auditHostels = await database
    .select()
    .from(auditEventHostels)
    .where(eq(auditEventHostels.auditEventId, auditEvent.id));

  assert.equal(result.report.summary.importedRows, 2);
  assert.equal(storedApprovals.length, 2);
  assert.ok(storedApprovals.every((record) => record.approvedByUserId === administrator.id));
  assert.equal(auditEvent.actorUserId, administrator.id);
  assert.deepEqual(auditEvent.metadata.hostelCounts, { CI1: 1, CI2: 1 });
  assert.equal(auditHostels.length, 2);

  const conflictingPreview = await importStudentApprovals(
    database,
    csv,
    administrator.id,
    { dryRun: true, now }
  );

  assert.equal(conflictingPreview.report.canImport, false);
  assert.equal(conflictingPreview.report.summary.invalidRows, 2);
  assert.ok(
    conflictingPreview.report.rows.every((row) =>
      row.errors.some((error) => error.code === "EMAIL_ALREADY_APPROVED")
    )
  );
});
