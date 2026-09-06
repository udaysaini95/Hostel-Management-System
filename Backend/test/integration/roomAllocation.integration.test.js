import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { and, count, eq, isNull } from "drizzle-orm";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../src/db/schema.js";
import {
  auditEvents,
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
import { USER_ROLES } from "../../src/domain/roles.js";
import {
  allocateRoom,
  listRoomInventory,
  vacateRoomAllocation,
} from "../../src/services/roomAllocationService.js";

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

let administrator;
let firstWarden;
let secondWarden;
let firstHostel;
let secondHostel;
let students;
let singleRoom;
let sharedRoom;
let raceRoom;
let secondHostelRoom;
let firstAllocationId;

before(async () => {
  [firstHostel, secondHostel] = await database
    .insert(hostels)
    .values([
      { code: "RA1", name: "Room Allocation Hostel One" },
      { code: "RA2", name: "Room Allocation Hostel Two" },
    ])
    .returning();

  [administrator, firstWarden, secondWarden] = await database
    .insert(users)
    .values([
      {
        name: "Room Administrator",
        email: "admin@room-allocation.integration.test",
        password: "not-a-real-password-hash",
        role: USER_ROLES.ADMIN,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
      },
      {
        name: "First Room Warden",
        email: "warden-one@room-allocation.integration.test",
        password: "not-a-real-password-hash",
        role: USER_ROLES.WARDEN,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
      },
      {
        name: "Second Room Warden",
        email: "warden-two@room-allocation.integration.test",
        password: "not-a-real-password-hash",
        role: USER_ROLES.WARDEN,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
      },
    ])
    .returning();

  students = await database
    .insert(users)
    .values([
      {
        name: "Allocation Student One",
        email: "student-one@room-allocation.integration.test",
        password: "not-a-real-password-hash",
        role: USER_ROLES.STUDENT,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
        rollNo: "ROOM-001",
      },
      {
        name: "Allocation Student Two",
        email: "student-two@room-allocation.integration.test",
        password: "not-a-real-password-hash",
        role: USER_ROLES.STUDENT,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
        rollNo: "ROOM-002",
      },
      {
        name: "Allocation Student Three",
        email: "student-three@room-allocation.integration.test",
        password: "not-a-real-password-hash",
        role: USER_ROLES.STUDENT,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
        rollNo: "ROOM-003",
      },
      {
        name: "Other Hostel Student",
        email: "student-four@room-allocation.integration.test",
        password: "not-a-real-password-hash",
        role: USER_ROLES.STUDENT,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
        rollNo: "ROOM-004",
      },
      {
        name: "Suspended Allocation Student",
        email: "student-five@room-allocation.integration.test",
        password: "not-a-real-password-hash",
        role: USER_ROLES.STUDENT,
        accountStatus: ACCOUNT_STATUSES.SUSPENDED,
        rollNo: "ROOM-005",
      },
    ])
    .returning();

  await database.insert(hostelMemberships).values([
    { userId: firstWarden.id, hostelId: firstHostel.id, isPrimary: true },
    { userId: secondWarden.id, hostelId: secondHostel.id, isPrimary: true },
    ...students.map((student, index) => ({
      userId: student.id,
      hostelId: index === 3 ? secondHostel.id : firstHostel.id,
      isPrimary: true,
    })),
  ]);

  await database.insert(studentProfiles).values(
    students.map((student, index) => ({
      userId: student.id,
      hostelId: index === 3 ? secondHostel.id : firstHostel.id,
      rollNo: student.rollNo,
    }))
  );

  const [firstBlock, secondBlock] = await database
    .insert(hostelBlocks)
    .values([
      { hostelId: firstHostel.id, code: "A", name: "RA1 Block A" },
      { hostelId: secondHostel.id, code: "A", name: "RA2 Block A" },
    ])
    .returning();

  [singleRoom, sharedRoom, raceRoom, secondHostelRoom] = await database
    .insert(rooms)
    .values([
      { blockId: firstBlock.id, roomNumber: "101", floor: 1, capacity: 1 },
      { blockId: firstBlock.id, roomNumber: "102", floor: 1, capacity: 2 },
      { blockId: firstBlock.id, roomNumber: "103", floor: 1, capacity: 1 },
      { blockId: secondBlock.id, roomNumber: "101", floor: 1, capacity: 1 },
    ])
    .returning();
});

after(async () => {
  await pool.end();
});

test("room inventory is paginated and limited to a warden's hostels", async () => {
  const adminResult = await listRoomInventory(
    database,
    { id: administrator.id, role: USER_ROLES.ADMIN },
    { page: 1, pageSize: 2 }
  );
  const firstWardenResult = await listRoomInventory(database, {
    id: firstWarden.id,
    role: USER_ROLES.WARDEN,
  });
  const secondWardenResult = await listRoomInventory(database, {
    id: secondWarden.id,
    role: USER_ROLES.WARDEN,
  });

  assert.deepEqual(adminResult.pagination, {
    page: 1,
    pageSize: 2,
    total: 4,
    totalPages: 2,
  });
  assert.equal(firstWardenResult.pagination.total, 3);
  assert.ok(
    firstWardenResult.data.every((room) => room.hostel.code === "RA1")
  );
  assert.equal(secondWardenResult.pagination.total, 1);
  assert.equal(secondWardenResult.data[0].hostel.code, "RA2");
  assert.equal(firstWardenResult.data[0].availableBeds, 1);
});

test("allocation enforces student state, hostel scope, and one active room", async () => {
  const allocatedAt = new Date("2026-09-06T10:00:00.000Z");
  const result = await allocateRoom(
    database,
    { id: firstWarden.id, role: USER_ROLES.WARDEN },
    { studentUserId: students[0].id, roomId: singleRoom.id },
    { now: allocatedAt }
  );
  firstAllocationId = result.allocation.id;

  assert.equal(result.allocation.student.rollNo, "ROOM-001");
  assert.equal(result.allocation.room.label, "A-101");
  assert.equal(result.allocation.hostel.code, "RA1");

  const [storedStudent] = await database
    .select({ roomNo: users.roomNo })
    .from(users)
    .where(eq(users.id, students[0].id));
  const [auditEvent] = await database
    .select()
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.action, AUDIT_ACTIONS.ROOM_ALLOCATION_CREATED),
        eq(auditEvents.resourceId, String(firstAllocationId))
      )
    );

  assert.equal(storedStudent.roomNo, "A-101");
  assert.equal(auditEvent.actorUserId, firstWarden.id);
  assert.equal(auditEvent.metadata.occupancyAfter, 1);

  await assert.rejects(
    allocateRoom(
      database,
      { id: firstWarden.id, role: USER_ROLES.WARDEN },
      { studentUserId: students[3].id, roomId: secondHostelRoom.id }
    ),
    (error) => error.code === "HOSTEL_SCOPE_DENIED"
  );
  await assert.rejects(
    allocateRoom(
      database,
      { id: administrator.id, role: USER_ROLES.ADMIN },
      { studentUserId: students[3].id, roomId: sharedRoom.id }
    ),
    (error) => error.code === "ROOM_HOSTEL_MISMATCH"
  );
  await assert.rejects(
    allocateRoom(
      database,
      { id: administrator.id, role: USER_ROLES.ADMIN },
      { studentUserId: students[0].id, roomId: sharedRoom.id }
    ),
    (error) => error.code === "STUDENT_ALREADY_ALLOCATED"
  );
  await assert.rejects(
    allocateRoom(
      database,
      { id: administrator.id, role: USER_ROLES.ADMIN },
      { studentUserId: students[4].id, roomId: sharedRoom.id }
    ),
    (error) => error.code === "STUDENT_ACCOUNT_INACTIVE"
  );
});

test("concurrent allocation cannot overfill a room", async () => {
  await assert.rejects(
    allocateRoom(
      database,
      { id: administrator.id, role: USER_ROLES.ADMIN },
      { studentUserId: students[1].id, roomId: singleRoom.id }
    ),
    (error) => error.code === "ROOM_CAPACITY_REACHED"
  );

  const attempts = await Promise.allSettled([
    allocateRoom(
      database,
      { id: administrator.id, role: USER_ROLES.ADMIN },
      { studentUserId: students[1].id, roomId: raceRoom.id }
    ),
    allocateRoom(
      database,
      { id: administrator.id, role: USER_ROLES.ADMIN },
      { studentUserId: students[2].id, roomId: raceRoom.id }
    ),
  ]);
  const successes = attempts.filter((attempt) => attempt.status === "fulfilled");
  const failures = attempts.filter((attempt) => attempt.status === "rejected");
  const [activeCount] = await database
    .select({ total: count() })
    .from(roomAllocations)
    .where(
      and(
        eq(roomAllocations.roomId, raceRoom.id),
        isNull(roomAllocations.vacatedAt)
      )
    );

  assert.equal(successes.length, 1);
  assert.equal(failures.length, 1);
  assert.equal(failures[0].reason.code, "ROOM_CAPACITY_REACHED");
  assert.equal(Number(activeCount.total), 1);
});

test("inventory availability reflects active allocations", async () => {
  const actor = { id: firstWarden.id, role: USER_ROLES.WARDEN };
  const fullRooms = await listRoomInventory(database, actor, {
    availability: "full",
  });
  const availableRooms = await listRoomInventory(database, actor, {
    availability: "available",
  });

  assert.equal(fullRooms.pagination.total, 2);
  assert.ok(fullRooms.data.every((room) => room.isFull));
  assert.equal(availableRooms.pagination.total, 1);
  assert.equal(availableRooms.data[0].id, sharedRoom.id);
  assert.equal(availableRooms.data[0].availableBeds, 2);
});

test("vacating closes history and allows a later allocation", async () => {
  const actor = { id: firstWarden.id, role: USER_ROLES.WARDEN };

  await assert.rejects(
    vacateRoomAllocation(
      database,
      { id: secondWarden.id, role: USER_ROLES.WARDEN },
      firstAllocationId,
      { reason: "Wrong hostel attempt" }
    ),
    (error) => error.code === "HOSTEL_SCOPE_DENIED"
  );

  const vacancy = await vacateRoomAllocation(
    database,
    actor,
    firstAllocationId,
    { reason: "Resident moved after approved request" },
    { now: new Date("2026-09-07T10:00:00.000Z") }
  );

  assert.equal(vacancy.allocation.vacateReason, "Resident moved after approved request");
  assert.ok(vacancy.allocation.vacatedAt instanceof Date);

  const [storedStudent] = await database
    .select({ roomNo: users.roomNo })
    .from(users)
    .where(eq(users.id, students[0].id));
  const [vacancyAudit] = await database
    .select()
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.action, AUDIT_ACTIONS.ROOM_ALLOCATION_VACATED),
        eq(auditEvents.resourceId, String(firstAllocationId))
      )
    );

  assert.equal(storedStudent.roomNo, null);
  assert.equal(vacancyAudit.metadata.reason, "Resident moved after approved request");

  await allocateRoom(
    database,
    actor,
    { studentUserId: students[0].id, roomId: sharedRoom.id },
    { now: new Date("2026-09-08T10:00:00.000Z") }
  );

  const [profile] = await database
    .select({ id: studentProfiles.id })
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, students[0].id));
  const history = await database
    .select()
    .from(roomAllocations)
    .where(eq(roomAllocations.studentProfileId, profile.id));

  assert.equal(history.length, 2);
  assert.equal(history.filter((allocation) => !allocation.vacatedAt).length, 1);

  await assert.rejects(
    vacateRoomAllocation(
      database,
      actor,
      firstAllocationId,
      { reason: "Duplicate vacancy attempt" }
    ),
    (error) => error.code === "ROOM_ALREADY_VACATED"
  );
});
