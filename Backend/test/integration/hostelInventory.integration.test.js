import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../src/db/schema.js";
import {
  auditEvents,
  hostelMemberships,
  hostels,
  roomAllocations,
  studentProfiles,
  users,
} from "../../src/db/schema.js";
import { ACCOUNT_STATUSES } from "../../src/domain/accountStatuses.js";
import { AUDIT_ACTIONS } from "../../src/domain/auditEvents.js";
import { USER_ROLES } from "../../src/domain/roles.js";
import {
  createHostelRoom,
  getHostelInventory,
  setHostelRoomStatus,
  updateHostelRoom,
} from "../../src/services/hostelInventoryService.js";

const { Pool } = pg;

if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    "Integration tests must be started through npm test or npm run test:integration."
  );
}

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 4 });
const database = drizzle(pool, { schema });

let administrator;
let hostel;

before(async () => {
  [administrator] = await database
    .insert(users)
    .values({
      name: "Inventory Administrator",
      email: "admin@hostel-inventory.integration.test",
      password: "not-a-real-password-hash",
      role: USER_ROLES.ADMIN,
      accountStatus: ACCOUNT_STATUSES.ACTIVE,
    })
    .returning();
  [hostel] = await database
    .insert(hostels)
    .values({ code: "HIT", name: "Hostel Inventory Test" })
    .returning();
});

after(async () => {
  await pool.end();
});

test("administrators create hostel rooms with audit history", async () => {
  const room = await createHostelRoom(
    database,
    hostel.id,
    { roomNumber: "101", floor: 1, capacity: 2 },
    administrator.id
  );
  const inventory = await getHostelInventory(database, hostel.id);
  const events = await database
    .select({ action: auditEvents.action })
    .from(auditEvents)
    .where(eq(auditEvents.actorUserId, administrator.id));

  assert.equal(inventory.rooms.length, 1);
  assert.equal(inventory.rooms[0].availableBeds, 2);
  assert.ok(events.some((event) => event.action === AUDIT_ACTIONS.ROOM_CREATED));

  const [student] = await database
    .insert(users)
    .values({
      name: "Inventory Student",
      email: "student@hostel-inventory.integration.test",
      password: "not-a-real-password-hash",
      role: USER_ROLES.STUDENT,
      accountStatus: ACCOUNT_STATUSES.ACTIVE,
      rollNo: "HIT-001",
    })
    .returning();
  await database.insert(hostelMemberships).values({
    userId: student.id,
    hostelId: hostel.id,
    isPrimary: true,
  });
  const [profile] = await database
    .insert(studentProfiles)
    .values({ userId: student.id, hostelId: hostel.id, rollNo: student.rollNo })
    .returning();
  await database.insert(roomAllocations).values({
    studentProfileId: profile.id,
    roomId: room.id,
    allocatedByUserId: administrator.id,
  });

  await assert.rejects(
    updateHostelRoom(
      database,
      hostel.id,
      room.id,
      { floor: 1, capacity: 0 },
      administrator.id
    ),
    (error) => error.code === "ROOM_CAPACITY_BELOW_OCCUPANCY"
  );
  await assert.rejects(
    setHostelRoomStatus(
      database,
      hostel.id,
      room.id,
      false,
      administrator.id
    ),
    (error) => error.code === "ROOM_DEACTIVATION_BLOCKED"
  );
});
