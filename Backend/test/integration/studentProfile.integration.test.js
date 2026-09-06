import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { eq } from "drizzle-orm";
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
import {
  getOwnStudentProfile,
  updateOwnStudentProfile,
} from "../../src/services/studentProfileService.js";

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
let administrator;

before(async () => {
  const [hostel] = await database
    .insert(hostels)
    .values({ code: "SP1", name: "Student Profile Test Hostel" })
    .returning();
  [administrator] = await database
    .insert(users)
    .values({
      name: "Student Profile Test Admin",
      email: "admin@student-profile.integration.test",
      password: "not-a-real-password-hash",
      role: USER_ROLES.ADMIN,
      accountStatus: ACCOUNT_STATUSES.ACTIVE,
    })
    .returning();

  [firstStudent, secondStudent] = await database
    .insert(users)
    .values([
      {
        name: "Profile Student One",
        email: "student.one@student-profile.integration.test",
        password: "not-a-real-password-hash",
        role: USER_ROLES.STUDENT,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
        rollNo: "PROFILE-001",
      },
      {
        name: "Profile Student Two",
        email: "student.two@student-profile.integration.test",
        password: "not-a-real-password-hash",
        role: USER_ROLES.STUDENT,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
        rollNo: "PROFILE-002",
      },
    ])
    .returning();

  await database.insert(hostelMemberships).values([
    { userId: firstStudent.id, hostelId: hostel.id, isPrimary: true },
    { userId: secondStudent.id, hostelId: hostel.id, isPrimary: true },
  ]);

  const [firstProfile] = await database
    .insert(studentProfiles)
    .values([
      {
        userId: firstStudent.id,
        hostelId: hostel.id,
        rollNo: "PROFILE-001",
        phone: "+91 98765 40001",
        guardianName: "First Guardian",
        guardianPhone: "+91 98765 50001",
      },
      {
        userId: secondStudent.id,
        hostelId: hostel.id,
        rollNo: "PROFILE-002",
        guardianName: "Second Guardian",
        guardianPhone: "+91 98765 50002",
      },
    ])
    .returning();

  const [block] = await database
    .insert(hostelBlocks)
    .values({ hostelId: hostel.id, code: "A", name: "Academic Block" })
    .returning();
  const [room] = await database
    .insert(rooms)
    .values({ blockId: block.id, roomNumber: "301", floor: 3, capacity: 2 })
    .returning();

  await database.insert(roomAllocations).values({
    studentProfileId: firstProfile.id,
    roomId: room.id,
    allocatedByUserId: administrator.id,
    allocatedAt: new Date("2026-09-01T09:00:00.000Z"),
  });
});

after(async () => {
  await pool.end();
});

test("a student reads only their normalized profile and current room", async () => {
  const profile = await getOwnStudentProfile(database, firstStudent.id);

  assert.equal(profile.userId, firstStudent.id);
  assert.equal(profile.name, "Profile Student One");
  assert.equal(profile.email, "student.one@student-profile.integration.test");
  assert.equal(profile.rollNo, "PROFILE-001");
  assert.deepEqual(profile.guardian, {
    name: "First Guardian",
    phone: "+91 98765 50001",
  });
  assert.deepEqual(profile.hostel, {
    code: "SP1",
    name: "Student Profile Test Hostel",
  });
  assert.ok(Number.isSafeInteger(profile.currentAllocation.id));
  assert.deepEqual(profile.currentAllocation.room, {
    number: "301",
    label: "A-301",
    floor: 3,
    capacity: 2,
  });
  assert.equal(profile.profileComplete, true);
  assert.equal(Object.hasOwn(profile, "password"), false);
  assert.equal(JSON.stringify(profile).includes("Second Guardian"), false);
});

test("a student update changes only that student's editable contact fields", async () => {
  const updatedAt = new Date("2026-09-06T12:00:00.000Z");
  const profile = await updateOwnStudentProfile(
    database,
    firstStudent.id,
    {
      phone: "+91 98765 40010",
      guardianName: "Updated Guardian",
      guardianPhone: "+91 98765 50010",
    },
    { now: updatedAt }
  );
  const [otherProfile] = await database
    .select()
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, secondStudent.id));
  const [legacyAccount] = await database
    .select({ phone: users.phone })
    .from(users)
    .where(eq(users.id, firstStudent.id));

  assert.equal(profile.phone, "+91 98765 40010");
  assert.deepEqual(profile.guardian, {
    name: "Updated Guardian",
    phone: "+91 98765 50010",
  });
  assert.deepEqual(profile.updatedAt, updatedAt);
  assert.equal(otherProfile.guardianName, "Second Guardian");
  assert.equal(otherProfile.phone, null);
  assert.equal(legacyAccount.phone, "+91 98765 40010");
});

test("non-students and invalid identities cannot use the own-profile service", async () => {
  await assert.rejects(
    getOwnStudentProfile(database, 0),
    (error) => error.code === "AUTHENTICATION_REQUIRED"
  );
  await assert.rejects(
    getOwnStudentProfile(database, administrator.id),
    (error) => error.code === "STUDENT_PROFILE_NOT_FOUND"
  );
});
