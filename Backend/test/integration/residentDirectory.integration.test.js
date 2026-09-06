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
import { USER_ROLES } from "../../src/domain/roles.js";
import { searchResidents } from "../../src/services/residentDirectoryService.js";

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
let warden;
let firstStudent;

before(async () => {
  const [firstHostel, secondHostel] = await database
    .insert(hostels)
    .values([
      { code: "RD1", name: "Resident Directory Hostel One" },
      { code: "RD2", name: "Resident Directory Hostel Two" },
    ])
    .returning();

  [administrator, warden] = await database
    .insert(users)
    .values([
      {
        name: "Directory Administrator",
        email: "admin@resident-directory.integration.test",
        password: "not-a-real-password-hash",
        role: USER_ROLES.ADMIN,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
      },
      {
        name: "Directory Warden",
        email: "warden@resident-directory.integration.test",
        password: "not-a-real-password-hash",
        role: USER_ROLES.WARDEN,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
      },
    ])
    .returning();

  const students = await database
    .insert(users)
    .values([
      {
        name: "Aanya Resident",
        email: "aanya@resident-directory.integration.test",
        password: "not-a-real-password-hash",
        role: USER_ROLES.STUDENT,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
        rollNo: "DIR-001",
      },
      {
        name: "Bharat Resident",
        email: "bharat@resident-directory.integration.test",
        password: "not-a-real-password-hash",
        role: USER_ROLES.STUDENT,
        accountStatus: ACCOUNT_STATUSES.SUSPENDED,
        rollNo: "DIR-002",
      },
      {
        name: "Charu Resident",
        email: "charu@resident-directory.integration.test",
        password: "not-a-real-password-hash",
        role: USER_ROLES.STUDENT,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
        rollNo: "DIR-003",
      },
      {
        name: "Diya Resident",
        email: "diya@resident-directory.integration.test",
        password: "not-a-real-password-hash",
        role: USER_ROLES.STUDENT,
        accountStatus: ACCOUNT_STATUSES.PENDING,
        rollNo: "DIR-004",
      },
    ])
    .returning();
  [firstStudent] = students;

  await database.insert(hostelMemberships).values([
    { userId: warden.id, hostelId: firstHostel.id, isPrimary: true },
    { userId: students[0].id, hostelId: firstHostel.id, isPrimary: true },
    { userId: students[1].id, hostelId: firstHostel.id, isPrimary: true },
    { userId: students[2].id, hostelId: secondHostel.id, isPrimary: true },
    { userId: students[3].id, hostelId: secondHostel.id, isPrimary: true },
  ]);

  const profiles = await database
    .insert(studentProfiles)
    .values([
      {
        userId: students[0].id,
        hostelId: firstHostel.id,
        rollNo: "DIR-001",
        phone: "+91 90000 00001",
        guardianName: "Guardian One",
        guardianPhone: "+91 91000 00001",
      },
      {
        userId: students[1].id,
        hostelId: firstHostel.id,
        rollNo: "DIR-002",
        phone: "+91 90000 00002",
        guardianName: "Guardian Two",
        guardianPhone: "+91 91000 00002",
      },
      {
        userId: students[2].id,
        hostelId: secondHostel.id,
        rollNo: "DIR-003",
        phone: "+91 90000 00003",
        guardianName: "Guardian Three",
        guardianPhone: "+91 91000 00003",
      },
      {
        userId: students[3].id,
        hostelId: secondHostel.id,
        rollNo: "DIR-004",
      },
    ])
    .returning();

  const [firstBlock, secondBlock, thirdBlock] = await database
    .insert(hostelBlocks)
    .values([
      { hostelId: firstHostel.id, code: "A", name: "RD1 A Block" },
      { hostelId: firstHostel.id, code: "B", name: "RD1 B Block" },
      { hostelId: secondHostel.id, code: "A", name: "RD2 A Block" },
    ])
    .returning();
  const [firstRoom, secondRoom, thirdRoom] = await database
    .insert(rooms)
    .values([
      { blockId: firstBlock.id, roomNumber: "101", floor: 1, capacity: 2 },
      { blockId: secondBlock.id, roomNumber: "201", floor: 2, capacity: 2 },
      { blockId: thirdBlock.id, roomNumber: "101", floor: 1, capacity: 3 },
    ])
    .returning();

  await database.insert(roomAllocations).values([
    {
      studentProfileId: profiles[0].id,
      roomId: firstRoom.id,
      allocatedByUserId: administrator.id,
    },
    {
      studentProfileId: profiles[1].id,
      roomId: secondRoom.id,
      allocatedByUserId: administrator.id,
    },
    {
      studentProfileId: profiles[2].id,
      roomId: thirdRoom.id,
      allocatedByUserId: administrator.id,
    },
  ]);
});

after(async () => {
  await pool.end();
});

test("administrators can paginate and filter the complete resident directory", async () => {
  const actor = { id: administrator.id, role: USER_ROLES.ADMIN };
  const firstPage = await searchResidents(database, actor, {
    page: 1,
    pageSize: 2,
  });
  const secondPage = await searchResidents(database, actor, {
    page: 2,
    pageSize: 2,
  });
  const byHostel = await searchResidents(database, actor, {
    hostelCode: "RD2",
  });
  const byBlock = await searchResidents(database, actor, { blockCode: "B" });
  const byRoom = await searchResidents(database, actor, { roomNumber: "101" });
  const byStatus = await searchResidents(database, actor, {
    accountStatus: ACCOUNT_STATUSES.SUSPENDED,
  });
  const bySearch = await searchResidents(database, actor, { search: "charu" });

  assert.deepEqual(firstPage.pagination, {
    page: 1,
    pageSize: 2,
    total: 4,
    totalPages: 2,
  });
  assert.deepEqual(
    firstPage.data.map((resident) => resident.name),
    ["Aanya Resident", "Bharat Resident"]
  );
  assert.deepEqual(
    secondPage.data.map((resident) => resident.name),
    ["Charu Resident", "Diya Resident"]
  );
  assert.equal(byHostel.pagination.total, 2);
  assert.ok(byHostel.data.every((resident) => resident.hostel.code === "RD2"));
  assert.deepEqual(byBlock.data.map((resident) => resident.rollNo), ["DIR-002"]);
  assert.equal(byRoom.pagination.total, 2);
  assert.deepEqual(byStatus.data.map((resident) => resident.rollNo), ["DIR-002"]);
  assert.deepEqual(bySearch.data.map((resident) => resident.rollNo), ["DIR-003"]);
});

test("wardens see only residents from their assigned hostels", async () => {
  const actor = { id: warden.id, role: USER_ROLES.WARDEN };
  const assignedResidents = await searchResidents(database, actor);
  const otherHostel = await searchResidents(database, actor, {
    hostelCode: "RD2",
  });

  assert.equal(assignedResidents.pagination.total, 2);
  assert.ok(
    assignedResidents.data.every((resident) => resident.hostel.code === "RD1")
  );
  assert.deepEqual(otherHostel.data, []);
  assert.equal(otherHostel.pagination.total, 0);
});

test("directory rows expose operational fields without private guardian data", async () => {
  const result = await searchResidents(
    database,
    { id: administrator.id, role: USER_ROLES.ADMIN },
    { search: "DIR-001" }
  );
  const [resident] = result.data;

  assert.equal(resident.phone, "+91 90000 00001");
  assert.equal(resident.currentAllocation.room.label, "A-101");
  assert.equal(resident.profileComplete, true);
  assert.equal(Object.hasOwn(resident, "guardian"), false);
  assert.equal(Object.hasOwn(resident, "password"), false);
});

test("students and stale role claims cannot search the directory", async () => {
  await assert.rejects(
    searchResidents(database, {
      id: firstStudent.id,
      role: USER_ROLES.STUDENT,
    }),
    (error) => error.code === "RESIDENT_DIRECTORY_ACCESS_DENIED"
  );
  await assert.rejects(
    searchResidents(database, {
      id: administrator.id,
      role: USER_ROLES.WARDEN,
    }),
    (error) => error.code === "RESIDENT_DIRECTORY_ACCESS_DENIED"
  );
});
