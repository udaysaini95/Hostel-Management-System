import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "../../src/db/schema.js";
import {
  hostelMemberships,
  hostels,
  messIssueEvents,
  messIssues,
  studentProfiles,
  users,
} from "../../src/db/schema.js";
import { ACCOUNT_STATUSES } from "../../src/domain/accountStatuses.js";
import { USER_ROLES } from "../../src/domain/roles.js";
import {
  createMessIssue,
  listManagedMessIssues,
  listOwnMessIssues,
  readMessIssueEvidence,
  transitionMessIssue,
} from "../../src/services/messIssueService.js";

const { Pool } = pg;
if (!process.env.TEST_DATABASE_URL) {
  throw new Error("Integration tests must be started through the repository test runner.");
}

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const database = drizzle(pool, { schema });
const actorFor = (user) => ({ id: user.id, role: user.role });
const storedFiles = new Map();
const storage = {
  async write(key, contents) { storedFiles.set(key, Buffer.from(contents)); },
  async read(key) {
    const contents = storedFiles.get(key);
    if (!contents) throw new Error("missing");
    return Buffer.from(contents);
  },
  async remove(key) { storedFiles.delete(key); },
};

let firstHostel;
let secondHostel;
let student;
let otherStudent;
let warden;
let administrator;
let issue;

before(async () => {
  [firstHostel, secondHostel] = await database.insert(hostels).values([
    { code: "MI1", name: "Mess Issue Hostel One" },
    { code: "MI2", name: "Mess Issue Hostel Two" },
  ]).returning();
  [student, otherStudent, warden, administrator] = await database.insert(users).values([
    {
      name: "Mess Issue Student",
      email: "student@mess-issue.integration.test",
      password: "test-hash",
      role: USER_ROLES.STUDENT,
      accountStatus: ACCOUNT_STATUSES.ACTIVE,
    },
    {
      name: "Other Mess Issue Student",
      email: "other-student@mess-issue.integration.test",
      password: "test-hash",
      role: USER_ROLES.STUDENT,
      accountStatus: ACCOUNT_STATUSES.ACTIVE,
    },
    {
      name: "Mess Issue Warden",
      email: "warden@mess-issue.integration.test",
      password: "test-hash",
      role: USER_ROLES.WARDEN,
      accountStatus: ACCOUNT_STATUSES.ACTIVE,
    },
    {
      name: "Mess Issue Admin",
      email: "admin@mess-issue.integration.test",
      password: "test-hash",
      role: USER_ROLES.ADMIN,
      accountStatus: ACCOUNT_STATUSES.ACTIVE,
    },
  ]).returning();
  await database.insert(hostelMemberships).values([
    { userId: student.id, hostelId: firstHostel.id, isPrimary: true },
    { userId: otherStudent.id, hostelId: secondHostel.id, isPrimary: true },
    { userId: warden.id, hostelId: firstHostel.id, isPrimary: true },
  ]);
  await database.insert(studentProfiles).values([
    { userId: student.id, hostelId: firstHostel.id, rollNo: "MESS-ISSUE-001" },
    { userId: otherStudent.id, hostelId: secondHostel.id, rollNo: "MESS-ISSUE-002" },
  ]);
});

after(async () => {
  await pool.end();
});

test("student report and private evidence appear immediately in own history", async () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  issue = await createMessIssue(
    database,
    actorFor(student),
    {
      issueType: "food_quality",
      mealType: "lunch",
      description: "The rice was cold and undercooked today.",
    },
    { buffer: png, mimetype: "image/png", originalname: "cold-rice.png" },
    { storage, createId: () => "mess-issue-evidence", now: new Date("2026-09-10T07:00:00Z") }
  );

  const history = await listOwnMessIssues(database, actorFor(student));
  assert.equal(history.data[0].id, issue.id);
  assert.equal(history.data[0].hostel.id, firstHostel.id);
  assert.equal(history.data[0].status, "reported");
  assert.equal(history.data[0].evidence.originalName, "cold-rice.png");

  const evidence = await readMessIssueEvidence(
    database,
    actorFor(student),
    issue.id,
    { storage }
  );
  assert.deepEqual(evidence.contents, png);
  await assert.rejects(
    () => readMessIssueEvidence(database, actorFor(otherStudent), issue.id, { storage }),
    { code: "MESS_ISSUE_ACCESS_DENIED" }
  );
});

test("warden queue is hostel scoped and permits only forward transitions", async () => {
  const queue = await listManagedMessIssues(database, actorFor(warden));
  assert.ok(queue.data.some((record) => record.id === issue.id));
  await assert.rejects(
    () => transitionMessIssue(database, actorFor(warden), issue.id, { status: "resolved" }),
    { code: "INVALID_MESS_ISSUE_TRANSITION" }
  );

  const started = await transitionMessIssue(
    database,
    actorFor(warden),
    issue.id,
    { status: "in_progress", note: "Reviewing the kitchen process" },
    { now: new Date("2026-09-10T08:00:00Z") }
  );
  assert.equal(started.status, "in_progress");
  const resolved = await transitionMessIssue(
    database,
    actorFor(administrator),
    issue.id,
    { status: "resolved", note: "Rice batch replaced" },
    { now: new Date("2026-09-10T09:00:00Z") }
  );
  assert.equal(resolved.status, "resolved");
  assert.equal(resolved.resolvedAt.toISOString(), "2026-09-10T09:00:00.000Z");

  const events = await database.select().from(messIssueEvents);
  const issueEvents = events.filter((event) => event.messIssueId === issue.id);
  assert.deepEqual(issueEvents.map((event) => event.toStatus), ["reported", "in_progress", "resolved"]);
  await readMessIssueEvidence(database, actorFor(warden), issue.id, { storage });
});

test("database rejects skipped workflow transitions and immutable event edits", async () => {
  const secondIssue = await createMessIssue(
    database,
    actorFor(student),
    {
      issueType: "quantity",
      mealType: "dinner",
      description: "Dinner portions were too small for residents.",
    },
    null,
    { storage, now: new Date("2026-09-10T10:00:00Z") }
  );

  await assert.rejects(
    pool.query(
      "UPDATE mess_issues SET status = 'resolved', resolved_at = now(), updated_at = now() WHERE id = $1",
      [secondIssue.id]
    ),
    (error) => error.code === "23514" && error.constraint === "mess_issue_status_transition_check"
  );

  const [event] = await database.select().from(messIssueEvents);
  await assert.rejects(
    database.update(messIssueEvents).set({ note: "changed" }).where(
      // The test intentionally targets an existing event to prove immutability.
      eq(messIssueEvents.id, event.id)
    ),
    (error) => (error.cause?.code || error.code) === "55000"
  );

  const adminQueue = await listManagedMessIssues(database, actorFor(administrator), {
    hostelId: secondHostel.id,
  });
  assert.equal(adminQueue.data.length, 0);
});
