import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../src/db/schema.js";
import {
  hostelBlocks,
  hostelMemberships,
  hostels,
  roomAllocations,
  rooms,
  studentProfiles,
  users,
} from "../../src/db/schema.js";
import { ACCOUNT_STATUSES } from "../../src/domain/accountStatuses.js";
import { AUDIT_ACTIONS } from "../../src/domain/auditEvents.js";
import { LEAVE_STATUSES } from "../../src/domain/leaveWorkflow.js";
import { USER_ROLES } from "../../src/domain/roles.js";
import { decideLeaveRequest } from "../../src/services/leaveDecisionService.js";
import { createLeaveRequest } from "../../src/services/leaveRequestService.js";

const { Pool } = pg;

if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    "Integration tests must be started through npm test or npm run test:integration."
  );
}

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 6 });
const database = drizzle(pool, { schema });

let administrator;
let firstWarden;
let secondWarden;
let suspendedWarden;
let students;
let pendingLeaves;

before(async () => {
  const [firstHostel, secondHostel] = await database
    .insert(hostels)
    .values([
      { code: "LD1", name: "Leave Decision Hostel One" },
      { code: "LD2", name: "Leave Decision Hostel Two" },
    ])
    .returning();

  [administrator, firstWarden, secondWarden, suspendedWarden] = await database
    .insert(users)
    .values([
      {
        name: "Leave Decision Administrator",
        email: "admin@leave-decision.integration.test",
        password: "test-hash",
        role: USER_ROLES.ADMIN,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
      },
      {
        name: "Leave Decision Warden One",
        email: "warden-one@leave-decision.integration.test",
        password: "test-hash",
        role: USER_ROLES.WARDEN,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
      },
      {
        name: "Leave Decision Warden Two",
        email: "warden-two@leave-decision.integration.test",
        password: "test-hash",
        role: USER_ROLES.WARDEN,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
      },
      {
        name: "Suspended Leave Warden",
        email: "suspended@leave-decision.integration.test",
        password: "test-hash",
        role: USER_ROLES.WARDEN,
        accountStatus: ACCOUNT_STATUSES.SUSPENDED,
      },
    ])
    .returning();

  students = await database
    .insert(users)
    .values(
      [1, 2, 3, 4].map((number) => ({
        name: `Leave Decision Student ${number}`,
        email: `student-${number}@leave-decision.integration.test`,
        password: "test-hash",
        role: USER_ROLES.STUDENT,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
        rollNo: `LD-${String(number).padStart(3, "0")}`,
      }))
    )
    .returning();

  await database.insert(hostelMemberships).values([
    { userId: firstWarden.id, hostelId: firstHostel.id, isPrimary: true },
    { userId: secondWarden.id, hostelId: secondHostel.id, isPrimary: true },
    { userId: suspendedWarden.id, hostelId: firstHostel.id, isPrimary: true },
    ...students.map((student) => ({
      userId: student.id,
      hostelId: firstHostel.id,
      isPrimary: true,
    })),
  ]);

  const profiles = await database
    .insert(studentProfiles)
    .values(
      students.map((student) => ({
        userId: student.id,
        hostelId: firstHostel.id,
        rollNo: student.rollNo,
      }))
    )
    .returning();
  const [block] = await database
    .insert(hostelBlocks)
    .values({ hostelId: firstHostel.id, code: "A", name: "Decision Block A" })
    .returning();
  const [room] = await database
    .insert(rooms)
    .values({ blockId: block.id, roomNumber: "201", floor: 2, capacity: 4 })
    .returning();

  await database.insert(roomAllocations).values(
    profiles.map((profile) => ({
      studentProfileId: profile.id,
      roomId: room.id,
      allocatedByUserId: administrator.id,
      allocatedAt: new Date("2026-09-01T08:00:00.000Z"),
      createdAt: new Date("2026-09-01T08:00:00.000Z"),
    }))
  );

  pendingLeaves = await Promise.all(
    students.map((student, index) =>
      createLeaveRequest(
        database,
        { id: student.id, role: USER_ROLES.STUDENT },
        {
          reason: `Verified leave request number ${index + 1}`,
          departureAt: `2026-11-${String(index + 10).padStart(2, "0")}T08:00:00Z`,
          expectedReturnAt: `2026-11-${String(index + 11).padStart(2, "0")}T18:00:00Z`,
          isEmergency: index === 1,
        },
        { now: new Date("2026-10-01T08:00:00.000Z") }
      )
    )
  );
});

after(async () => {
  await pool.end();
});

test("warden approval records one decision, status, timeline, and audit event", async () => {
  const result = await decideLeaveRequest(
    database,
    { id: firstWarden.id, role: USER_ROLES.WARDEN },
    pendingLeaves[0].id,
    { outcome: "approved", note: "Student identity and travel dates verified" },
    { now: new Date("2026-10-02T08:00:00.000Z") }
  );

  assert.equal(result.leaveRequest.status, LEAVE_STATUSES.APPROVED);
  assert.equal(result.decision.outcome, "approved");
  assert.equal(result.decision.actor.userId, firstWarden.id);
  assert.equal(result.decision.note, "Student identity and travel dates verified");

  const [timeline, audit] = await Promise.all([
    pool.query(
      "SELECT event_type, from_status, to_status, note FROM leave_events WHERE leave_request_id = $1 ORDER BY id",
      [pendingLeaves[0].id]
    ),
    pool.query(
      "SELECT action FROM audit_events WHERE resource_type = 'leave_request' AND resource_id = $1 ORDER BY id",
      [String(pendingLeaves[0].id)]
    ),
  ]);

  assert.deepEqual(
    timeline.rows.map((event) => event.event_type),
    ["submitted", "approved"]
  );
  assert.deepEqual(timeline.rows[1], {
    event_type: "approved",
    from_status: "pending",
    to_status: "approved",
    note: "Student identity and travel dates verified",
  });
  assert.equal(audit.rows.at(-1).action, AUDIT_ACTIONS.LEAVE_REQUEST_APPROVED);
});

test("administrator can reject a request with an auditable note", async () => {
  const result = await decideLeaveRequest(
    database,
    { id: administrator.id, role: USER_ROLES.ADMIN },
    pendingLeaves[1].id,
    { outcome: "rejected", note: "Travel dates conflict with hostel records" },
    { now: new Date("2026-10-02T09:00:00.000Z") }
  );

  assert.equal(result.leaveRequest.status, LEAVE_STATUSES.REJECTED);
  assert.equal(result.decision.actor.userId, administrator.id);

  const audit = await pool.query(
    "SELECT action FROM audit_events WHERE resource_type = 'leave_request' AND resource_id = $1 ORDER BY id",
    [String(pendingLeaves[1].id)]
  );
  assert.equal(audit.rows.at(-1).action, AUDIT_ACTIONS.LEAVE_REQUEST_REJECTED);
});

test("hostel scope and current staff state are enforced", async () => {
  const input = { outcome: "approved", note: "All submitted details verified" };
  const options = { now: new Date("2026-10-02T10:00:00.000Z") };

  await assert.rejects(
    decideLeaveRequest(
      database,
      { id: secondWarden.id, role: USER_ROLES.WARDEN },
      pendingLeaves[2].id,
      input,
      options
    ),
    (error) => error.statusCode === 404 && error.code === "LEAVE_REQUEST_NOT_FOUND"
  );
  await assert.rejects(
    decideLeaveRequest(
      database,
      { id: suspendedWarden.id, role: USER_ROLES.WARDEN },
      pendingLeaves[2].id,
      input,
      options
    ),
    (error) => error.statusCode === 403 && error.code === "STAFF_ACCOUNT_INACTIVE"
  );
  await assert.rejects(
    decideLeaveRequest(
      database,
      { id: students[2].id, role: USER_ROLES.STUDENT },
      pendingLeaves[2].id,
      input,
      options
    ),
    (error) => error.statusCode === 403 && error.code === "LEAVE_DECISION_DENIED"
  );
});

test("simultaneous decisions produce exactly one immutable outcome", async () => {
  const decidedAt = new Date("2026-10-02T11:00:00.000Z");
  const results = await Promise.allSettled([
    decideLeaveRequest(
      database,
      { id: firstWarden.id, role: USER_ROLES.WARDEN },
      pendingLeaves[2].id,
      { outcome: "approved", note: "Warden verified this leave request" },
      { now: decidedAt }
    ),
    decideLeaveRequest(
      database,
      { id: administrator.id, role: USER_ROLES.ADMIN },
      pendingLeaves[2].id,
      { outcome: "rejected", note: "Administrator rejected this leave request" },
      { now: decidedAt }
    ),
  ]);
  const fulfilled = results.filter((result) => result.status === "fulfilled");
  const rejected = results.filter((result) => result.status === "rejected");

  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].reason.code, "LEAVE_ALREADY_DECIDED");

  const records = await pool.query(
    `SELECT lr.status, count(ld.id)::integer AS decision_count
     FROM leave_requests lr
     LEFT JOIN leave_decisions ld ON ld.leave_request_id = lr.id
     WHERE lr.id = $1
     GROUP BY lr.status`,
    [pendingLeaves[2].id]
  );
  assert.equal(records.rows[0].decision_count, 1);
  assert.equal(records.rows[0].status, fulfilled[0].value.decision.outcome);
});

test("database decision guard rejects forged staff and applies valid status", async () => {
  await assert.rejects(
    pool.query(
      `INSERT INTO leave_decisions (
         leave_request_id, outcome, decided_by_user_id,
         actor_name, actor_role, note, decided_at
       ) VALUES ($1, 'approved', $2, $3, 'warden', $4, $5)`,
      [
        pendingLeaves[3].id,
        secondWarden.id,
        secondWarden.name,
        "Attempt from a different hostel",
        "2026-10-02T12:00:00Z",
      ]
    ),
    (error) => error.code === "42501"
  );
  await assert.rejects(
    pool.query(
      `INSERT INTO leave_decisions (
         leave_request_id, outcome, decided_by_user_id,
         actor_name, actor_role, note, decided_at
       ) VALUES ($1, 'approved', $2, 'Forged Name', 'warden', $3, $4)`,
      [
        pendingLeaves[3].id,
        firstWarden.id,
        "Actor snapshot must be authentic",
        "2026-10-02T12:00:00Z",
      ]
    ),
    (error) =>
      error.code === "23514" &&
      error.constraint === "leave_decisions_actor_identity_check"
  );

  await pool.query(
    `INSERT INTO leave_decisions (
       leave_request_id, outcome, decided_by_user_id,
       actor_name, actor_role, note, decided_at
     ) VALUES ($1, 'approved', $2, $3, 'warden', $4, $5)`,
    [
      pendingLeaves[3].id,
      firstWarden.id,
      firstWarden.name,
      "Valid direct decision for constraint verification",
      "2026-10-02T12:00:00Z",
    ]
  );

  const request = await pool.query(
    "SELECT status, updated_at FROM leave_requests WHERE id = $1",
    [pendingLeaves[3].id]
  );
  assert.equal(request.rows[0].status, LEAVE_STATUSES.APPROVED);
  assert.equal(
    request.rows[0].updated_at.toISOString(),
    "2026-10-02T12:00:00.000Z"
  );
});

test("an already decided request cannot be decided again", async () => {
  await assert.rejects(
    decideLeaveRequest(
      database,
      { id: administrator.id, role: USER_ROLES.ADMIN },
      pendingLeaves[0].id,
      { outcome: "rejected", note: "Attempt to replace the original decision" },
      { now: new Date("2026-10-03T08:00:00.000Z") }
    ),
    (error) => error.code === "LEAVE_ALREADY_DECIDED"
  );

  const records = await pool.query(
    "SELECT count(*)::integer AS count FROM leave_decisions WHERE leave_request_id = $1",
    [pendingLeaves[0].id]
  );
  assert.equal(records.rows[0].count, 1);
});
