import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../src/db/schema.js";
import {
  hostelMemberships,
  hostels,
  studentProfiles,
  users,
} from "../../src/db/schema.js";
import { ACCOUNT_STATUSES } from "../../src/domain/accountStatuses.js";
import {
  COMPLAINT_PRIORITIES,
  COMPLAINT_STATUSES,
} from "../../src/domain/complaintWorkflow.js";
import { USER_ROLES } from "../../src/domain/roles.js";
import {
  createComplaint,
  getComplaintById,
  searchManagedComplaints,
  searchOwnComplaints,
} from "../../src/services/complaintService.js";

const { Pool } = pg;

if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    "Integration tests must be started through npm test or npm run test:integration."
  );
}

const pool = new Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  max: 4,
});
const database = drizzle(pool, { schema });

let firstStudent;
let secondStudent;
let firstWarden;
let secondWarden;

before(async () => {
  const [firstHostel, secondHostel] = await database
    .insert(hostels)
    .values([
      { code: "API1", name: "Complaint API Hostel One" },
      { code: "API2", name: "Complaint API Hostel Two" },
    ])
    .returning();

  [firstStudent, secondStudent, firstWarden, secondWarden] = await database
    .insert(users)
    .values([
      {
        name: "Complaint API Student One",
        email: "student.one@complaint-api.integration.test",
        password: "test-hash",
        role: USER_ROLES.STUDENT,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
        rollNo: "COMPLAINT-API-01",
      },
      {
        name: "Complaint API Student Two",
        email: "student.two@complaint-api.integration.test",
        password: "test-hash",
        role: USER_ROLES.STUDENT,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
        rollNo: "COMPLAINT-API-02",
      },
      {
        name: "Complaint API Warden One",
        email: "warden.one@complaint-api.integration.test",
        password: "test-hash",
        role: USER_ROLES.WARDEN,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
      },
      {
        name: "Complaint API Warden Two",
        email: "warden.two@complaint-api.integration.test",
        password: "test-hash",
        role: USER_ROLES.WARDEN,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
      },
    ])
    .returning();

  await database.insert(hostelMemberships).values([
    { userId: firstStudent.id, hostelId: firstHostel.id, isPrimary: true },
    { userId: firstWarden.id, hostelId: firstHostel.id, isPrimary: true },
    { userId: secondStudent.id, hostelId: secondHostel.id, isPrimary: true },
    { userId: secondWarden.id, hostelId: secondHostel.id, isPrimary: true },
  ]);
  await database.insert(studentProfiles).values([
    {
      userId: firstStudent.id,
      hostelId: firstHostel.id,
      rollNo: "COMPLAINT-API-01",
    },
    {
      userId: secondStudent.id,
      hostelId: secondHostel.id,
      rollNo: "COMPLAINT-API-02",
    },
  ]);
});

after(async () => {
  await pool.end();
});

test("student creation derives hostel and deadline and writes both histories", async () => {
  const createdAt = new Date("2026-09-07T08:00:00.000Z");
  const complaint = await createComplaint(
    database,
    { id: firstStudent.id, role: USER_ROLES.STUDENT },
    {
      categoryCode: "electrical",
      location: "Block A corridor",
      description: "The corridor ceiling light is flickering continuously.",
      requestedPriority: COMPLAINT_PRIORITIES.LOW,
    },
    { now: createdAt }
  );

  assert.equal(complaint.hostel.code, "API1");
  assert.equal(complaint.priority, COMPLAINT_PRIORITIES.HIGH);
  assert.equal(complaint.requestedPriority, COMPLAINT_PRIORITIES.LOW);
  assert.equal(
    new Date(complaint.sla.deadline).toISOString(),
    "2026-09-07T20:00:00.000Z"
  );
  assert.equal(complaint.status, COMPLAINT_STATUSES.CREATED);
  assert.equal(complaint.timeline.length, 1);
  assert.equal(complaint.timeline[0].type, "created");

  const [historyResult, auditResult] = await Promise.all([
    pool.query(
      "SELECT count(*)::integer AS count FROM complaint_events WHERE complaint_id = $1",
      [complaint.id]
    ),
    pool.query(
      `SELECT count(*)::integer AS count
       FROM audit_events
       WHERE action = 'complaint.created' AND resource_id = $1`,
      [String(complaint.id)]
    ),
  ]);
  assert.equal(historyResult.rows[0].count, 1);
  assert.equal(auditResult.rows[0].count, 1);
});

test("requesters may escalate priority but never submit their own deadline", async () => {
  const createdAt = new Date("2026-09-08T08:00:00.000Z");
  const complaint = await createComplaint(
    database,
    { id: firstStudent.id, role: USER_ROLES.STUDENT },
    {
      categoryCode: "other",
      location: "Main staircase",
      description: "A loose railing is creating an immediate fall hazard.",
      requestedPriority: COMPLAINT_PRIORITIES.CRITICAL,
    },
    { now: createdAt }
  );

  assert.equal(complaint.priority, COMPLAINT_PRIORITIES.CRITICAL);
  assert.equal(complaint.sla.policyMinutes, 120);
  assert.equal(
    new Date(complaint.sla.deadline).toISOString(),
    "2026-09-08T10:00:00.000Z"
  );
});

test("queues enforce ownership, hostel scope, filters, and pagination", async () => {
  const firstStudentActor = { id: firstStudent.id, role: USER_ROLES.STUDENT };
  const firstWardenActor = { id: firstWarden.id, role: USER_ROLES.WARDEN };
  const secondWardenActor = { id: secondWarden.id, role: USER_ROLES.WARDEN };
  const ownResult = await searchOwnComplaints(
    database,
    firstStudentActor,
    { page: 1, pageSize: 1, sortBy: "priority", sortOrder: "asc" },
    { now: new Date("2026-09-08T09:00:00.000Z") }
  );
  const managedResult = await searchManagedComplaints(
    database,
    firstWardenActor,
    { priority: COMPLAINT_PRIORITIES.CRITICAL },
    { now: new Date("2026-09-08T09:00:00.000Z") }
  );
  const unrelatedResult = await searchManagedComplaints(
    database,
    secondWardenActor,
    {},
    { now: new Date("2026-09-08T09:00:00.000Z") }
  );

  assert.equal(ownResult.pagination.total, 2);
  assert.equal(ownResult.data.length, 1);
  assert.equal(ownResult.data[0].priority, COMPLAINT_PRIORITIES.CRITICAL);
  assert.equal(managedResult.pagination.total, 1);
  assert.equal(unrelatedResult.pagination.total, 0);

  await assert.rejects(
    getComplaintById(
      database,
      { id: secondStudent.id, role: USER_ROLES.STUDENT },
      ownResult.data[0].id
    ),
    (error) => error.statusCode === 404 && error.code === "COMPLAINT_NOT_FOUND"
  );
});

test("invalid categories and out-of-scope staff creation leave no partial rows", async () => {
  const beforeResult = await pool.query(
    "SELECT count(*)::integer AS count FROM complaints"
  );
  const beforeCount = beforeResult.rows[0].count;

  await assert.rejects(
    createComplaint(
      database,
      { id: firstStudent.id, role: USER_ROLES.STUDENT },
      {
        categoryCode: "unknown",
        location: "Room 101",
        description: "This complaint has no supported category.",
      }
    ),
    (error) => error.code === "COMPLAINT_CATEGORY_NOT_FOUND"
  );
  await assert.rejects(
    createComplaint(
      database,
      { id: firstWarden.id, role: USER_ROLES.WARDEN },
      {
        categoryCode: "other",
        hostelCode: "API2",
        location: "Reception",
        description: "The reception desk needs a maintenance inspection.",
      }
    ),
    (error) => error.code === "HOSTEL_SCOPE_DENIED"
  );

  const afterResult = await pool.query(
    "SELECT count(*)::integer AS count FROM complaints"
  );
  assert.equal(afterResult.rows[0].count, beforeCount);
});
