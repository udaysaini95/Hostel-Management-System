import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray } from "drizzle-orm";
import * as schema from "../../src/db/schema.js";
import {
  hostelMemberships,
  hostels,
  messMenuItems,
  messMenus,
  messMenuVersions,
  studentProfiles,
  users,
} from "../../src/db/schema.js";
import { ACCOUNT_STATUSES } from "../../src/domain/accountStatuses.js";
import { USER_ROLES } from "../../src/domain/roles.js";
import {
  getMessMenuByDate,
  listMessMenuVersions,
  listMessMenus,
  publishMessMenu,
} from "../../src/services/messMenuService.js";

const { Pool } = pg;

if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    "Integration tests must be started through npm test or npm run test:integration."
  );
}

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const database = drizzle(pool, { schema });

let firstHostel;
let secondHostel;
let warden;
let student;
let administrator;

const actorFor = (user) => ({ id: user.id, role: user.role });

before(async () => {
  [firstHostel, secondHostel] = await database
    .insert(hostels)
    .values([
      { code: "MM1", name: "Mess Menu Hostel One" },
      { code: "MM2", name: "Mess Menu Hostel Two" },
    ])
    .returning();

  [warden, student, administrator] = await database
    .insert(users)
    .values([
      {
        name: "Mess Menu Warden",
        email: "warden@mess-menu.integration.test",
        password: "test-hash",
        role: USER_ROLES.WARDEN,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
      },
      {
        name: "Mess Menu Student",
        email: "student@mess-menu.integration.test",
        password: "test-hash",
        role: USER_ROLES.STUDENT,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
      },
      {
        name: "Mess Menu Administrator",
        email: "admin@mess-menu.integration.test",
        password: "test-hash",
        role: USER_ROLES.ADMIN,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
      },
    ])
    .returning();

  await database.insert(hostelMemberships).values([
    { userId: warden.id, hostelId: firstHostel.id, isPrimary: true },
    { userId: student.id, hostelId: firstHostel.id, isPrimary: true },
  ]);
  await database.insert(studentProfiles).values({
    userId: student.id,
    hostelId: firstHostel.id,
    rollNo: "MESS-MENU-001",
  });
});

after(async () => {
  await pool.end();
});

test("same hostel and calendar date updates one menu while retaining revisions", async () => {
  const date = "2026-01-01";
  const first = await publishMessMenu(database, actorFor(warden), {
    hostelId: firstHostel.id,
    date,
    meals: {
      breakfast: ["Poha", "Tea"],
      lunch: ["Rajma", "Rice"],
      dinner: ["Roti", "Dal"],
    },
  }, { now: new Date("2025-12-31T18:45:00.000Z") });

  const second = await publishMessMenu(database, actorFor(warden), {
    hostelId: firstHostel.id,
    date,
    meals: {
      breakfast: ["Idli", "Sambar"],
      lunch: ["Rajma", "Rice"],
      snacks: ["Fruit"],
      dinner: ["Roti", "Dal"],
    },
  }, { now: new Date("2026-01-01T02:30:00.000Z") });

  assert.equal(first.id, second.id);
  assert.equal(first.date, date);
  assert.equal(second.version, 2);

  const storedMenus = await database
    .select()
    .from(messMenus)
    .where(eq(messMenus.id, first.id));
  const storedVersions = await database
    .select()
    .from(messMenuVersions)
    .where(eq(messMenuVersions.menuId, first.id));
  assert.equal(storedMenus.length, 1);
  assert.equal(storedMenus[0].currentVersion, 2);
  assert.equal(storedVersions.length, 2);

  const current = await getMessMenuByDate(database, actorFor(student), { date });
  assert.equal(current.date, "2026-01-01");
  assert.equal(current.version, 2);
  assert.deepEqual(current.meals.breakfast, ["Idli", "Sambar"]);

  const history = await listMessMenuVersions(database, actorFor(warden), {
    date,
    hostelId: firstHostel.id,
  });
  assert.deepEqual(history.versions.map((version) => version.version), [2, 1]);
  assert.deepEqual(history.versions[1].meals.breakfast, ["Poha", "Tea"]);
});

test("calendar queries return only the requested hostel and date range", async () => {
  await publishMessMenu(database, actorFor(administrator), {
    hostelId: secondHostel.id,
    date: "2026-01-01",
    meals: {
      breakfast: ["Dosa"],
      lunch: ["Sambar rice"],
      dinner: ["Vegetable pulao"],
    },
  });

  const result = await listMessMenus(database, actorFor(student), {
    from: "2026-01-01",
    to: "2026-01-07",
  });
  assert.equal(result.hostel.id, firstHostel.id);
  assert.equal(result.menus.length, 1);
  assert.equal(result.menus[0].hostel.id, firstHostel.id);

  await assert.rejects(
    () => getMessMenuByDate(database, actorFor(student), {
      date: "2026-01-01",
      hostelId: secondHostel.id,
    }),
    { code: "MESS_MENU_ACCESS_DENIED" }
  );
  await assert.rejects(
    () => publishMessMenu(database, actorFor(warden), {
      hostelId: secondHostel.id,
      date: "2026-01-02",
      meals: {
        breakfast: ["Poha"],
        lunch: ["Rice"],
        dinner: ["Dal"],
      },
    }),
    { code: "HOSTEL_ACCESS_DENIED" }
  );
});

test("normalized menu items retain positions and immutable old revision rows", async () => {
  const menu = await database
    .select({ id: messMenus.id })
    .from(messMenus)
    .where(eq(messMenus.hostelId, firstHostel.id))
    .limit(1);
  const versions = await database
    .select({ id: messMenuVersions.id })
    .from(messMenuVersions)
    .where(eq(messMenuVersions.menuId, menu[0].id));
  const items = await database
    .select()
    .from(messMenuItems)
    .where(inArray(messMenuItems.menuVersionId, versions.map((version) => version.id)));

  assert.ok(items.some((item) => item.name === "Poha" && item.position === 1));
  assert.ok(items.some((item) => item.name === "Idli" && item.position === 1));
  await assert.rejects(
    () => database
      .update(messMenuItems)
      .set({ name: "Changed after publication" })
      .where(eq(messMenuItems.id, items[0].id)),
    (error) => error.cause?.message === "Mess menu history is immutable"
  );
});
