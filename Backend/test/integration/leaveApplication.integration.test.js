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
import {
  createLeaveRequest,
  listStudentLeaveRequests,
} from "../../src/services/leaveRequestService.js";

const { Pool } = pg;

if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    "Integration tests must be started through npm test or npm run test:integration."
  );
}

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 6 });
const database = drizzle(pool, { schema });

let administrator;
let student;
let studentWithoutRoom;
let suspendedStudent;
let raceStudent;
let databaseRaceStudent;
let databaseRaceContext;

before(async () => {
  const [hostel] = await database
    .insert(hostels)
    .values({ code: "LAPI", name: "Leave API Hostel" })
    .returning();

  [
    administrator,
    student,
    studentWithoutRoom,
    suspendedStudent,
    raceStudent,
    databaseRaceStudent,
  ] = await database
      .insert(users)
      .values([
        {
          name: "Leave API Administrator",
          email: "admin@leave-api.integration.test",
          password: "test-hash",
          role: USER_ROLES.ADMIN,
          accountStatus: ACCOUNT_STATUSES.ACTIVE,
        },
        {
          name: "Leave API Student",
          email: "student@leave-api.integration.test",
          password: "test-hash",
          role: USER_ROLES.STUDENT,
          accountStatus: ACCOUNT_STATUSES.ACTIVE,
          rollNo: "LAPI-001",
        },
        {
          name: "Student Without Room",
          email: "no-room@leave-api.integration.test",
          password: "test-hash",
          role: USER_ROLES.STUDENT,
          accountStatus: ACCOUNT_STATUSES.ACTIVE,
          rollNo: "LAPI-002",
        },
        {
          name: "Suspended Leave Student",
          email: "suspended@leave-api.integration.test",
          password: "test-hash",
          role: USER_ROLES.STUDENT,
          accountStatus: ACCOUNT_STATUSES.SUSPENDED,
          rollNo: "LAPI-003",
        },
        {
          name: "Concurrent Leave Student",
          email: "race@leave-api.integration.test",
          password: "test-hash",
          role: USER_ROLES.STUDENT,
          accountStatus: ACCOUNT_STATUSES.ACTIVE,
          rollNo: "LAPI-004",
        },
        {
          name: "Database Concurrent Student",
          email: "database-race@leave-api.integration.test",
          password: "test-hash",
          role: USER_ROLES.STUDENT,
          accountStatus: ACCOUNT_STATUSES.ACTIVE,
          rollNo: "LAPI-005",
        },
      ])
      .returning();

  await database.insert(hostelMemberships).values(
    [
      student,
      studentWithoutRoom,
      suspendedStudent,
      raceStudent,
      databaseRaceStudent,
    ].map(
      (entry) => ({
        userId: entry.id,
        hostelId: hostel.id,
        isPrimary: true,
      })
    )
  );

  const profiles = await database
    .insert(studentProfiles)
    .values(
      [
        student,
        studentWithoutRoom,
        suspendedStudent,
        raceStudent,
        databaseRaceStudent,
      ].map(
        (entry) => ({
          userId: entry.id,
          hostelId: hostel.id,
          rollNo: entry.rollNo,
        })
      )
    )
    .returning();

  const [block] = await database
    .insert(hostelBlocks)
    .values({ hostelId: hostel.id, code: "A", name: "Leave Block A" })
    .returning();
  const [room] = await database
    .insert(rooms)
    .values({ blockId: block.id, roomNumber: "101", floor: 1, capacity: 4 })
    .returning();

  const allocations = await database
    .insert(roomAllocations)
    .values(
      [profiles[0], profiles[2], profiles[3], profiles[4]].map((profile) => ({
        studentProfileId: profile.id,
        roomId: room.id,
        allocatedByUserId: administrator.id,
        allocatedAt: new Date("2026-09-01T08:00:00.000Z"),
        createdAt: new Date("2026-09-01T08:00:00.000Z"),
      }))
    )
    .returning();

  databaseRaceContext = {
    hostelId: hostel.id,
    studentProfileId: profiles[4].id,
    roomAllocationId: allocations[3].id,
  };
});

after(async () => {
  await pool.end();
});

test("student submission derives scope and writes leave and audit history", async () => {
  const leaveRequest = await createLeaveRequest(
    database,
    { id: student.id, role: USER_ROLES.STUDENT },
    {
      reason: "Family wedding in another city",
      departureAt: "2026-10-10T08:00:00.000Z",
      expectedReturnAt: "2026-10-12T18:00:00.000Z",
      isEmergency: false,
    },
    { now: new Date("2026-10-01T08:00:00.000Z") }
  );

  assert.equal(leaveRequest.status, LEAVE_STATUSES.PENDING);
  assert.equal(leaveRequest.hostel.code, "LAPI");
  assert.equal(leaveRequest.student.userId, student.id);
  assert.equal(leaveRequest.roomAllocation.room.label, "A-101");

  const [timeline, audit] = await Promise.all([
    pool.query(
      "SELECT event_type, actor_user_id FROM leave_events WHERE leave_request_id = $1",
      [leaveRequest.id]
    ),
    pool.query(
      "SELECT action FROM audit_events WHERE resource_type = 'leave_request' AND resource_id = $1",
      [String(leaveRequest.id)]
    ),
  ]);

  assert.deepEqual(timeline.rows, [
    { event_type: "submitted", actor_user_id: student.id },
  ]);
  assert.equal(audit.rows[0].action, AUDIT_ACTIONS.LEAVE_REQUEST_SUBMITTED);

  const history = await listStudentLeaveRequests(
    database,
    { id: student.id, role: USER_ROLES.STUDENT },
    { page: 1, pageSize: 10 }
  );
  assert.equal(history.data[0].id, leaveRequest.id);
  assert.equal(history.data[0].hostel.code, "LAPI");
  assert.equal(history.data[0].room.roomNumber, "101");
  assert.equal(history.pagination.total, 1);
});

test("past and reversed leave dates are rejected before any write", async () => {
  const actor = { id: student.id, role: USER_ROLES.STUDENT };
  const now = new Date("2026-10-01T08:00:00.000Z");

  await assert.rejects(
    createLeaveRequest(
      database,
      actor,
      {
        reason: "A leave request in the past",
        departureAt: "2026-09-30T08:00:00.000Z",
        expectedReturnAt: "2026-10-01T18:00:00.000Z",
      },
      { now }
    ),
    (error) => error.code === "PAST_DEPARTURE_TIME"
  );
  await assert.rejects(
    createLeaveRequest(
      database,
      actor,
      {
        reason: "A leave request with reversed dates",
        departureAt: "2026-10-20T08:00:00.000Z",
        expectedReturnAt: "2026-10-19T18:00:00.000Z",
      },
      { now }
    ),
    (error) => error.code === "INVALID_LEAVE_DATE_RANGE"
  );
});

test("active student profile and room allocation are required", async () => {
  const input = {
    reason: "Visiting family for the weekend",
    departureAt: "2026-11-01T08:00:00.000Z",
    expectedReturnAt: "2026-11-02T18:00:00.000Z",
  };
  const options = { now: new Date("2026-10-01T08:00:00.000Z") };

  await assert.rejects(
    createLeaveRequest(
      database,
      { id: studentWithoutRoom.id, role: USER_ROLES.STUDENT },
      input,
      options
    ),
    (error) => error.code === "ACTIVE_ROOM_ALLOCATION_REQUIRED"
  );
  await assert.rejects(
    createLeaveRequest(
      database,
      { id: suspendedStudent.id, role: USER_ROLES.STUDENT },
      input,
      options
    ),
    (error) => error.code === "STUDENT_ACCOUNT_INACTIVE"
  );
  await assert.rejects(
    createLeaveRequest(
      database,
      { id: administrator.id, role: USER_ROLES.ADMIN },
      input,
      options
    ),
    (error) => error.code === "LEAVE_CREATE_DENIED"
  );
});

test("overlapping active requests fail while adjacent requests are allowed", async () => {
  const actor = { id: student.id, role: USER_ROLES.STUDENT };
  const now = new Date("2026-10-01T08:00:00.000Z");

  await assert.rejects(
    createLeaveRequest(
      database,
      actor,
      {
        reason: "Overlaps the existing family leave",
        departureAt: "2026-10-11T08:00:00.000Z",
        expectedReturnAt: "2026-10-13T18:00:00.000Z",
      },
      { now }
    ),
    (error) =>
      error.statusCode === 409 && error.code === "LEAVE_REQUEST_OVERLAP"
  );

  const adjacent = await createLeaveRequest(
    database,
    actor,
    {
      reason: "Begins when the previous leave ends",
      departureAt: "2026-10-12T18:00:00.000Z",
      expectedReturnAt: "2026-10-13T18:00:00.000Z",
    },
    { now }
  );
  assert.equal(adjacent.status, LEAVE_STATUSES.PENDING);
});

test("concurrent overlapping submissions create exactly one request", async () => {
  const input = {
    reason: "Concurrent submission safety test",
    departureAt: "2026-12-01T08:00:00.000Z",
    expectedReturnAt: "2026-12-02T18:00:00.000Z",
  };
  const actor = { id: raceStudent.id, role: USER_ROLES.STUDENT };
  const options = { now: new Date("2026-10-01T08:00:00.000Z") };

  const results = await Promise.allSettled([
    createLeaveRequest(database, actor, input, options),
    createLeaveRequest(database, actor, input, options),
  ]);
  const fulfilled = results.filter((result) => result.status === "fulfilled");
  const rejected = results.filter((result) => result.status === "rejected");

  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].reason.code, "LEAVE_REQUEST_OVERLAP");

  const countResult = await pool.query(
    "SELECT count(*)::integer AS count FROM leave_requests WHERE student_user_id = $1",
    [raceStudent.id]
  );
  assert.equal(countResult.rows[0].count, 1);
});

test("database constraint also protects simultaneous direct inserts", async () => {
  const insert = () =>
    pool.query(
      `INSERT INTO leave_requests (
         hostel_id, student_user_id, student_profile_id, room_allocation_id,
         reason, departure_at, expected_return_at, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, 'Direct database overlap test',
         '2026-12-10T08:00:00Z', '2026-12-11T18:00:00Z',
         '2026-10-01T08:00:00Z', '2026-10-01T08:00:00Z'
       ) RETURNING id`,
      [
        databaseRaceContext.hostelId,
        databaseRaceStudent.id,
        databaseRaceContext.studentProfileId,
        databaseRaceContext.roomAllocationId,
      ]
    );

  const results = await Promise.allSettled([insert(), insert()]);
  const fulfilled = results.filter((result) => result.status === "fulfilled");
  const rejected = results.filter((result) => result.status === "rejected");

  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.ok(["23P01", "40P01"].includes(rejected[0].reason.code));
  if (rejected[0].reason.code === "23P01") {
    assert.equal(
      rejected[0].reason.constraint,
      "leave_requests_no_active_overlap"
    );
  }
});
