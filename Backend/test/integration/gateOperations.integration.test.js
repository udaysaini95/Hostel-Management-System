import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq } from "drizzle-orm";
import * as schema from "../../src/db/schema.js";
import {
  auditEvents,
  gatePasses,
  hostelBlocks,
  hostelMemberships,
  hostels,
  leaveDecisions,
  leaveEvents,
  leaveRequests,
  roomAllocations,
  rooms,
  studentProfiles,
  users,
} from "../../src/db/schema.js";
import { ACCOUNT_STATUSES } from "../../src/domain/accountStatuses.js";
import { AUDIT_ACTIONS } from "../../src/domain/auditEvents.js";
import { LEAVE_STATUSES } from "../../src/domain/leaveWorkflow.js";
import { USER_ROLES } from "../../src/domain/roles.js";
import {
  expireUnusedGatePasses,
  getGateMovementHistory,
  getOutsideRoster,
} from "../../src/services/gateOperationsService.js";
import { recordGateOverride } from "../../src/services/gateOverrideService.js";

const { Pool } = pg;

if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    "Integration tests must be started through npm test or npm run test:integration."
  );
}

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const database = drizzle(pool, { schema });

let administrator;
let firstWarden;
let secondWarden;
let guard;
let firstHostel;
let secondHostel;
let overdueLeave;
let expiringLeave;
let otherHostelLeave;

const actorFor = (user) => ({ id: user.id, role: user.role });

const createApprovedLeave = async ({ student, profile, allocation, hostel, approver, number }) => {
  const [request] = await database
    .insert(leaveRequests)
    .values({
      hostelId: hostel.id,
      studentUserId: student.id,
      studentProfileId: profile.id,
      roomAllocationId: allocation.id,
      reason: `Gate operations test leave ${number}`,
      departureAt: new Date("2026-09-07T08:00:00.000Z"),
      expectedReturnAt: new Date("2026-09-08T18:00:00.000Z"),
      createdAt: new Date("2026-09-01T08:00:00.000Z"),
      updatedAt: new Date("2026-09-01T08:00:00.000Z"),
    })
    .returning();

  await database.insert(leaveDecisions).values({
    leaveRequestId: request.id,
    outcome: "approved",
    decidedByUserId: approver.id,
    actorName: approver.name,
    actorRole: approver.role,
    note: "Travel details checked for gate operations test",
    decidedAt: new Date("2026-09-02T08:00:00.000Z"),
  });

  return request;
};

before(async () => {
  [firstHostel, secondHostel] = await database
    .insert(hostels)
    .values([
      { code: "GO1", name: "Gate Operations Hostel One" },
      { code: "GO2", name: "Gate Operations Hostel Two" },
    ])
    .returning();

  [administrator, firstWarden, secondWarden, guard] = await database
    .insert(users)
    .values([
      {
        name: "Gate Operations Administrator",
        email: "admin@gate-operations.integration.test",
        password: "test-hash",
        role: USER_ROLES.ADMIN,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
      },
      {
        name: "Gate Operations Warden One",
        email: "warden-one@gate-operations.integration.test",
        password: "test-hash",
        role: USER_ROLES.WARDEN,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
      },
      {
        name: "Gate Operations Warden Two",
        email: "warden-two@gate-operations.integration.test",
        password: "test-hash",
        role: USER_ROLES.WARDEN,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
      },
      {
        name: "Gate Operations Guard",
        email: "guard@gate-operations.integration.test",
        password: "test-hash",
        role: USER_ROLES.GUARD,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
      },
    ])
    .returning();

  const students = await database
    .insert(users)
    .values([1, 2, 3].map((number) => ({
      name: `Gate Operations Student ${number}`,
      email: `student-${number}@gate-operations.integration.test`,
      password: "test-hash",
      role: USER_ROLES.STUDENT,
      accountStatus: ACCOUNT_STATUSES.ACTIVE,
      rollNo: `GO-${number}`,
    })))
    .returning();

  await database.insert(hostelMemberships).values([
    { userId: firstWarden.id, hostelId: firstHostel.id, isPrimary: true },
    { userId: secondWarden.id, hostelId: secondHostel.id, isPrimary: true },
    { userId: guard.id, hostelId: firstHostel.id, isPrimary: true },
    { userId: students[0].id, hostelId: firstHostel.id, isPrimary: true },
    { userId: students[1].id, hostelId: firstHostel.id, isPrimary: true },
    { userId: students[2].id, hostelId: secondHostel.id, isPrimary: true },
  ]);

  const profiles = await database
    .insert(studentProfiles)
    .values(students.map((student, index) => ({
      userId: student.id,
      hostelId: index === 2 ? secondHostel.id : firstHostel.id,
      rollNo: student.rollNo,
    })))
    .returning();
  const blocks = await database
    .insert(hostelBlocks)
    .values([
      { hostelId: firstHostel.id, code: "A", name: "Block A" },
      { hostelId: secondHostel.id, code: "B", name: "Block B" },
    ])
    .returning();
  const roomRows = await database
    .insert(rooms)
    .values([
      { blockId: blocks[0].id, roomNumber: "101", floor: 1, capacity: 2 },
      { blockId: blocks[1].id, roomNumber: "201", floor: 2, capacity: 1 },
    ])
    .returning();
  const allocations = await database
    .insert(roomAllocations)
    .values(profiles.map((profile, index) => ({
      studentProfileId: profile.id,
      roomId: index === 2 ? roomRows[1].id : roomRows[0].id,
      allocatedByUserId: administrator.id,
      allocatedAt: new Date("2026-08-01T08:00:00.000Z"),
      createdAt: new Date("2026-08-01T08:00:00.000Z"),
    })))
    .returning();

  overdueLeave = await createApprovedLeave({
    student: students[0], profile: profiles[0], allocation: allocations[0],
    hostel: firstHostel, approver: firstWarden, number: 1,
  });
  expiringLeave = await createApprovedLeave({
    student: students[1], profile: profiles[1], allocation: allocations[1],
    hostel: firstHostel, approver: firstWarden, number: 2,
  });
  otherHostelLeave = await createApprovedLeave({
    student: students[2], profile: profiles[2], allocation: allocations[2],
    hostel: secondHostel, approver: secondWarden, number: 3,
  });

  await database.insert(gatePasses).values({
    leaveRequestId: expiringLeave.id,
    tokenHash: "c".repeat(64),
    issuedByUserId: firstWarden.id,
    issuedAt: new Date("2026-09-02T08:00:00.000Z"),
    validFrom: new Date("2026-09-07T08:00:00.000Z"),
    expiresAt: new Date("2026-09-08T18:00:00.000Z"),
    qrStorageKey: "gate-passes/test/expiry.png",
    pdfStorageKey: "gate-passes/test/expiry.pdf",
  });
});

after(async () => {
  await pool.end();
});

test("warden overrides are scoped, idempotent, and unavailable to guards", async () => {
  const input = {
    leaveRequestId: overdueLeave.id,
    action: "exit",
    reason: "QR scanner was offline; identity checked against the roster.",
    idempotencyKey: "gate-operations-override-001",
  };
  const movement = await recordGateOverride(
    database,
    actorFor(firstWarden),
    input,
    { now: new Date("2026-09-07T08:15:00.000Z") }
  );
  const replay = await recordGateOverride(
    database,
    actorFor(firstWarden),
    input,
    { now: new Date("2026-09-07T08:16:00.000Z") }
  );

  assert.equal(movement.verificationMethod, "override");
  assert.equal(movement.status, LEAVE_STATUSES.EXITED);
  assert.equal(replay.replayed, true);
  await assert.rejects(
    recordGateOverride(database, actorFor(guard), {
      ...input,
      leaveRequestId: expiringLeave.id,
      idempotencyKey: "gate-operations-override-002",
    }),
    (error) => error.code === "GATE_EXCEPTION_ACCESS_DENIED"
  );
  await assert.rejects(
    recordGateOverride(database, actorFor(firstWarden), {
      ...input,
      leaveRequestId: otherHostelLeave.id,
      idempotencyKey: "gate-operations-override-003",
    }),
    (error) => error.code === "LEAVE_REQUEST_NOT_FOUND"
  );
});

test("outside roster and movement history enforce hostel and override filters", async () => {
  const now = new Date("2026-09-09T12:00:00.000Z");
  const roster = await getOutsideRoster(
    database,
    actorFor(firstWarden),
    { overdue: true, pageSize: 10 },
    { now }
  );
  const history = await getGateMovementHistory(
    database,
    actorFor(firstWarden),
    { overrideOnly: true, pageSize: 10 }
  );
  const otherRoster = await getOutsideRoster(
    database,
    actorFor(secondWarden),
    {},
    { now }
  );

  assert.equal(roster.data.length, 1);
  assert.equal(roster.data[0].leaveRequestId, overdueLeave.id);
  assert.equal(roster.data[0].overdue, true);
  assert.deepEqual(roster.data[0].student.room, {
    blockCode: "A",
    roomNumber: "101",
  });
  assert.equal(history.data.length, 1);
  assert.equal(history.data[0].isOverride, true);
  assert.equal(history.data[0].actor.id, firstWarden.id);
  assert.equal(otherRoster.data.length, 0);
});

test("expired unused passes change state and produce timeline and audit records", async () => {
  const now = new Date("2026-09-09T12:00:00.000Z");
  const result = await expireUnusedGatePasses(
    database,
    actorFor(firstWarden),
    { hostelCode: "GO1", limit: 10 },
    { now }
  );
  const [request] = await database
    .select({ status: leaveRequests.status })
    .from(leaveRequests)
    .where(eq(leaveRequests.id, expiringLeave.id));
  const timeline = await database
    .select()
    .from(leaveEvents)
    .where(
      and(
        eq(leaveEvents.leaveRequestId, expiringLeave.id),
        eq(leaveEvents.eventType, "expired")
      )
    );
  const audit = await database
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.action, AUDIT_ACTIONS.GATE_PASS_EXPIRED));

  assert.equal(result.expiredCount, 1);
  assert.equal(request.status, LEAVE_STATUSES.EXPIRED);
  assert.equal(timeline.length, 1);
  assert.equal(audit.some((event) => event.actorUserId === firstWarden.id), true);
});
