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
import { USER_ROLES } from "../../src/domain/roles.js";
import {
  getMessFeedbackSummary,
  submitMessFeedback,
} from "../../src/services/messFeedbackService.js";
import { publishMessMenu } from "../../src/services/messMenuService.js";

const { Pool } = pg;

if (!process.env.TEST_DATABASE_URL) {
  throw new Error("Integration tests must be started through the repository test runner.");
}

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const database = drizzle(pool, { schema });
const actorFor = (user) => ({ id: user.id, role: user.role });

let firstHostel;
let secondHostel;
let student;
let warden;
let administrator;
let menu;

before(async () => {
  [firstHostel, secondHostel] = await database.insert(hostels).values([
    { code: "MF1", name: "Feedback Hostel One" },
    { code: "MF2", name: "Feedback Hostel Two" },
  ]).returning();

  [student, warden, administrator] = await database.insert(users).values([
    {
      name: "Feedback Student",
      email: "student@mess-feedback.integration.test",
      password: "test-hash",
      role: USER_ROLES.STUDENT,
      accountStatus: ACCOUNT_STATUSES.ACTIVE,
    },
    {
      name: "Feedback Warden",
      email: "warden@mess-feedback.integration.test",
      password: "test-hash",
      role: USER_ROLES.WARDEN,
      accountStatus: ACCOUNT_STATUSES.ACTIVE,
    },
    {
      name: "Feedback Administrator",
      email: "admin@mess-feedback.integration.test",
      password: "test-hash",
      role: USER_ROLES.ADMIN,
      accountStatus: ACCOUNT_STATUSES.ACTIVE,
    },
  ]).returning();

  await database.insert(hostelMemberships).values([
    { userId: student.id, hostelId: firstHostel.id, isPrimary: true },
    { userId: warden.id, hostelId: firstHostel.id, isPrimary: true },
  ]);
  await database.insert(studentProfiles).values({
    userId: student.id,
    hostelId: firstHostel.id,
    rollNo: "MESS-FEEDBACK-001",
  });

  menu = await publishMessMenu(database, actorFor(warden), {
    hostelId: firstHostel.id,
    date: "2026-09-09",
    meals: {
      breakfast: ["Poha"],
      lunch: ["Rajma", "Rice"],
      dinner: ["Roti", "Dal"],
    },
  });
});

after(async () => {
  await pool.end();
});

test("a student rating is scoped to a published hostel meal", async () => {
  const feedback = await submitMessFeedback(database, actorFor(student), {
    menuId: menu.id,
    mealType: "lunch",
    rating: 4,
    comment: "  Good dal, rice was a little cold.  ",
  }, { now: new Date("2026-09-09T08:30:00.000Z") });

  assert.equal(feedback.rating, 4);
  assert.equal(feedback.comment, "Good dal, rice was a little cold.");

  await assert.rejects(
    () => submitMessFeedback(database, actorFor(student), {
      menuId: menu.id,
      mealType: "lunch",
      rating: 5,
    }),
    { code: "MEAL_ALREADY_RATED" }
  );
  await assert.rejects(
    () => submitMessFeedback(database, actorFor(student), {
      menuId: menu.id,
      mealType: "snacks",
      rating: 3,
    }),
    { code: "MEAL_NOT_PUBLISHED" }
  );
});

test("feedback summaries use real aggregates and honest empty states", async () => {
  const summary = await getMessFeedbackSummary(database, actorFor(warden), {
    hostelId: firstHostel.id,
    from: "2026-09-01",
    to: "2026-09-30",
  });
  assert.deepEqual(summary.overall, { averageRating: 4, responseCount: 1 });
  assert.equal(summary.byMeal[0].mealType, "lunch");
  assert.equal(summary.recentComments[0].comment, "Good dal, rice was a little cold.");

  const empty = await getMessFeedbackSummary(database, actorFor(administrator), {
    hostelId: secondHostel.id,
    from: "2026-09-01",
    to: "2026-09-30",
  });
  assert.deepEqual(empty.overall, { averageRating: null, responseCount: 0 });
  assert.deepEqual(empty.byMeal, []);
  assert.deepEqual(empty.recentComments, []);

  await assert.rejects(
    () => getMessFeedbackSummary(database, actorFor(warden), {
      hostelId: secondHostel.id,
      from: "2026-09-01",
      to: "2026-09-30",
    }),
    { code: "HOSTEL_ACCESS_DENIED" }
  );
});

test("PostgreSQL rejects an out-of-range rating", async () => {
  const versionResult = await pool.query(
    "SELECT id FROM mess_menu_versions WHERE menu_id = $1 AND version = 1",
    [menu.id]
  );
  await assert.rejects(
    pool.query(
      `INSERT INTO mess_feedbacks
        (menu_id, menu_version_id, student_user_id, meal_type, rating)
       VALUES ($1, $2, $3, 'breakfast', 6)`,
      [menu.id, versionResult.rows[0].id, student.id]
    ),
    (error) => error.code === "23514" && error.constraint === "mess_feedbacks_rating_check"
  );
});
