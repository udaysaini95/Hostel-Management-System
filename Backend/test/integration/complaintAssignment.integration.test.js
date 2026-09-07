import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../src/db/schema.js";
import {
  complaintAssignments,
  hostelMemberships,
  hostels,
  studentProfiles,
  users,
} from "../../src/db/schema.js";
import { ACCOUNT_STATUSES } from "../../src/domain/accountStatuses.js";
import { COMPLAINT_STATUSES } from "../../src/domain/complaintWorkflow.js";
import { USER_ROLES } from "../../src/domain/roles.js";
import {
  assignComplaint,
  listMaintenanceAssignees,
} from "../../src/services/complaintAssignmentService.js";
import {
  createComplaint,
  searchAssignedComplaints,
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

let student;
let firstHostel;
let firstWarden;
let otherWarden;
let firstTechnician;
let secondTechnician;
let foreignTechnician;
let suspendedTechnician;
let admin;

const actorFor = (user) => ({ id: user.id, role: user.role });

const createTestComplaint = (location, now = new Date()) =>
  createComplaint(
    database,
    actorFor(student),
    {
      categoryCode: "electrical",
      location,
      description: "The electrical fixture is unsafe and needs inspection.",
    },
    { now }
  );

before(async () => {
  let secondHostel;
  [firstHostel, secondHostel] = await database
    .insert(hostels)
    .values([
      { code: "ASG1", name: "Assignment Hostel One" },
      { code: "ASG2", name: "Assignment Hostel Two" },
    ])
    .returning();

  [
    student,
    firstWarden,
    otherWarden,
    firstTechnician,
    secondTechnician,
    foreignTechnician,
    suspendedTechnician,
    admin,
  ] = await database
    .insert(users)
    .values([
      {
        name: "Assignment Student",
        email: "student@assignment.integration.test",
        password: "test-hash",
        role: USER_ROLES.STUDENT,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
        rollNo: "ASSIGNMENT-STUDENT-01",
      },
      {
        name: "Assignment Warden",
        email: "warden@assignment.integration.test",
        password: "test-hash",
        role: USER_ROLES.WARDEN,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
      },
      {
        name: "Other Hostel Warden",
        email: "other.warden@assignment.integration.test",
        password: "test-hash",
        role: USER_ROLES.WARDEN,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
      },
      {
        name: "Asha Technician",
        email: "asha@assignment.integration.test",
        password: "test-hash",
        role: USER_ROLES.MAINTENANCE,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
      },
      {
        name: "Bilal Technician",
        email: "bilal@assignment.integration.test",
        password: "test-hash",
        role: USER_ROLES.MAINTENANCE,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
      },
      {
        name: "Foreign Technician",
        email: "foreign@assignment.integration.test",
        password: "test-hash",
        role: USER_ROLES.MAINTENANCE,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
      },
      {
        name: "Suspended Technician",
        email: "suspended@assignment.integration.test",
        password: "test-hash",
        role: USER_ROLES.MAINTENANCE,
        accountStatus: ACCOUNT_STATUSES.SUSPENDED,
      },
      {
        name: "Assignment Administrator",
        email: "admin@assignment.integration.test",
        password: "test-hash",
        role: USER_ROLES.ADMIN,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
      },
    ])
    .returning();

  await database.insert(hostelMemberships).values([
    { userId: student.id, hostelId: firstHostel.id, isPrimary: true },
    { userId: firstWarden.id, hostelId: firstHostel.id, isPrimary: true },
    { userId: firstTechnician.id, hostelId: firstHostel.id, isPrimary: true },
    { userId: secondTechnician.id, hostelId: firstHostel.id, isPrimary: true },
    {
      userId: suspendedTechnician.id,
      hostelId: firstHostel.id,
      isPrimary: true,
    },
    { userId: otherWarden.id, hostelId: secondHostel.id, isPrimary: true },
    { userId: foreignTechnician.id, hostelId: secondHostel.id, isPrimary: true },
  ]);
  await database.insert(studentProfiles).values({
    userId: student.id,
    hostelId: firstHostel.id,
    rollNo: "ASSIGNMENT-STUDENT-01",
  });
});

after(async () => {
  await pool.end();
});

test("warden sees only active maintenance assignees in their hostel", async () => {
  const result = await listMaintenanceAssignees(
    database,
    actorFor(firstWarden),
    { hostelCode: "ASG1" }
  );

  assert.equal(result.hostel.code, "ASG1");
  assert.deepEqual(
    result.data.map((user) => user.name),
    ["Asha Technician", "Bilal Technician"]
  );
  assert.ok(result.data.every((user) => user.activeAssignmentCount === 0));

  await assert.rejects(
    listMaintenanceAssignees(database, actorFor(otherWarden), {
      hostelCode: "ASG1",
    }),
    (error) => error.statusCode === 404 && error.code === "HOSTEL_NOT_FOUND"
  );
});

test("assignment and reassignment preserve history and update the active queue", async () => {
  const createdAt = new Date("2026-09-08T08:00:00.000Z");
  const complaint = await createTestComplaint("Block A switchboard", createdAt);
  const firstResult = await assignComplaint(
    database,
    actorFor(firstWarden),
    complaint.id,
    { assigneeUserId: firstTechnician.id },
    { now: new Date("2026-09-08T08:05:00.000Z") }
  );

  assert.equal(firstResult.assignment.kind, "initial");
  assert.equal(firstResult.complaint.status, COMPLAINT_STATUSES.ASSIGNED);
  assert.equal(
    firstResult.complaint.assignment.assignee.id,
    firstTechnician.id
  );
  assert.equal(firstResult.complaint.timeline.at(-1).type, "assigned");

  const secondResult = await assignComplaint(
    database,
    actorFor(firstWarden),
    complaint.id,
    {
      assigneeUserId: secondTechnician.id,
      reason: "Asha is handling an emergency repair.",
    },
    { now: new Date("2026-09-08T09:00:00.000Z") }
  );

  assert.equal(secondResult.assignment.kind, "reassignment");
  assert.equal(secondResult.assignment.previousAssignee.id, firstTechnician.id);
  assert.equal(
    secondResult.complaint.assignment.assignee.id,
    secondTechnician.id
  );
  assert.equal(secondResult.complaint.timeline.at(-1).type, "reassigned");

  const assignmentRows = await database
    .select()
    .from(complaintAssignments)
    .where(eq(complaintAssignments.complaintId, complaint.id));
  assert.equal(assignmentRows.length, 2);
  assert.equal(assignmentRows.filter((row) => row.endedAt === null).length, 1);
  assert.equal(
    assignmentRows.find((row) => row.endedAt !== null).endReason,
    "Asha is handling an emergency repair."
  );

  const oldQueue = await searchAssignedComplaints(
    database,
    actorFor(firstTechnician),
    {}
  );
  const newQueue = await searchAssignedComplaints(
    database,
    actorFor(secondTechnician),
    {
      status: COMPLAINT_STATUSES.ASSIGNED,
      priority: "high",
      categoryCode: "electrical",
      slaState: "open",
      createdFrom: "2026-09-08T00:00:00.000Z",
      createdTo: "2026-09-08T23:59:59.000Z",
    },
    { now: new Date("2026-09-08T10:00:00.000Z") }
  );

  assert.equal(oldQueue.data.some((item) => item.id === complaint.id), false);
  assert.equal(newQueue.data.some((item) => item.id === complaint.id), true);
  assert.equal(newQueue.data[0].assignment.assignee.id, secondTechnician.id);

  const auditResult = await pool.query(
    `SELECT action
     FROM audit_events
     WHERE resource_type = 'complaint_assignment'
       AND metadata->>'complaintId' = $1
     ORDER BY created_at, id`,
    [String(complaint.id)]
  );
  assert.deepEqual(
    auditResult.rows.map((row) => row.action),
    ["complaint.assigned", "complaint.reassigned"]
  );
});

test("hostel scope and reassignment rules reject unsafe changes", async () => {
  const complaint = await createTestComplaint("Block B distribution board");

  await assert.rejects(
    assignComplaint(
      database,
      actorFor(otherWarden),
      complaint.id,
      { assigneeUserId: firstTechnician.id }
    ),
    (error) => error.statusCode === 404 && error.code === "COMPLAINT_NOT_FOUND"
  );
  await assert.rejects(
    assignComplaint(
      database,
      actorFor(firstWarden),
      complaint.id,
      { assigneeUserId: foreignTechnician.id }
    ),
    (error) => error.code === "ASSIGNEE_NOT_AVAILABLE"
  );

  await assignComplaint(
    database,
    actorFor(firstWarden),
    complaint.id,
    { assigneeUserId: firstTechnician.id }
  );
  await assert.rejects(
    assignComplaint(
      database,
      actorFor(firstWarden),
      complaint.id,
      { assigneeUserId: secondTechnician.id }
    ),
    (error) => error.code === "REASSIGNMENT_REASON_REQUIRED"
  );
});

test("concurrent initial assignment leaves exactly one active assignee", async () => {
  const complaint = await createTestComplaint(
    "Block C panel",
    new Date("2026-09-08T11:00:00.000Z")
  );
  const assignedAt = new Date("2026-09-08T12:00:00.000Z");
  const attempts = await Promise.allSettled([
    assignComplaint(
      database,
      actorFor(firstWarden),
      complaint.id,
      { assigneeUserId: firstTechnician.id },
      { now: assignedAt }
    ),
    assignComplaint(
      database,
      actorFor(firstWarden),
      complaint.id,
      { assigneeUserId: secondTechnician.id },
      { now: assignedAt }
    ),
  ]);

  assert.equal(
    attempts.filter((attempt) => attempt.status === "fulfilled").length,
    1
  );
  assert.equal(
    attempts.filter((attempt) => attempt.status === "rejected").length,
    1
  );

  const activeResult = await pool.query(
    `SELECT count(*)::integer AS count
     FROM complaint_assignments
     WHERE complaint_id = $1 AND ended_at IS NULL`,
    [complaint.id]
  );
  assert.equal(activeResult.rows[0].count, 1);
});

test("admin can replace historical staff after their hostel access is removed", async () => {
  const complaint = await createTestComplaint(
    "Block D panel",
    new Date("2026-09-08T14:00:00.000Z")
  );
  await assignComplaint(
    database,
    actorFor(firstWarden),
    complaint.id,
    { assigneeUserId: firstTechnician.id },
    { now: new Date("2026-09-08T14:05:00.000Z") }
  );

  await database
    .delete(hostelMemberships)
    .where(eq(hostelMemberships.userId, firstWarden.id));
  await database
    .delete(hostelMemberships)
    .where(eq(hostelMemberships.userId, firstTechnician.id));

  const result = await assignComplaint(
    database,
    actorFor(admin),
    complaint.id,
    {
      assigneeUserId: secondTechnician.id,
      reason: "Previous staff hostel access was removed.",
    },
    { now: new Date("2026-09-08T14:10:00.000Z") }
  );

  assert.equal(result.assignment.kind, "reassignment");
  assert.equal(result.complaint.assignment.assignee.id, secondTechnician.id);
});
