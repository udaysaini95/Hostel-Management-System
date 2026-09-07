import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

const { Pool } = pg;

if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    "Integration tests must be started through npm test or npm run test:integration."
  );
}

const pool = new Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  max: 2,
});

const postgresErrorCode = (error) => error.code ?? error.cause?.code;

let complaintId;
let maintenanceUserId;
let wardenUserId;

before(async () => {
  const hostelResult = await pool.query(
    `INSERT INTO hostels (code, name)
     VALUES ('CMP1', 'Complaint Integration Hostel')
     RETURNING id`
  );
  const hostelId = hostelResult.rows[0].id;

  const usersResult = await pool.query(
    `INSERT INTO users (name, email, password, role, account_status, roll_no)
     VALUES
       ('Complaint Student', 'complaint.student@integration.test', 'test-hash', 'student', 'active', 'CMP-STUDENT-01'),
       ('Complaint Warden', 'complaint.warden@integration.test', 'test-hash', 'warden', 'active', null),
       ('Complaint Technician', 'complaint.maintenance@integration.test', 'test-hash', 'maintenance', 'active', null),
       ('Wrong Assignee', 'complaint.guard@integration.test', 'test-hash', 'guard', 'active', null)
     RETURNING id, role`
  );
  const userByRole = Object.fromEntries(
    usersResult.rows.map((user) => [user.role, user.id])
  );
  wardenUserId = userByRole.warden;
  maintenanceUserId = userByRole.maintenance;

  await pool.query(
    `INSERT INTO hostel_memberships (user_id, hostel_id, is_primary)
     VALUES ($1, $4, true), ($2, $4, true), ($3, $4, true)`,
    [userByRole.student, wardenUserId, maintenanceUserId, hostelId]
  );

  const profileResult = await pool.query(
    `INSERT INTO student_profiles (user_id, hostel_id, roll_no)
     VALUES ($1, $2, 'CMP-STUDENT-01')
     RETURNING id`,
    [userByRole.student, hostelId]
  );
  const categoryResult = await pool.query(
    "SELECT id, default_priority, sla_minutes FROM complaint_categories WHERE code = 'electrical'"
  );
  const category = categoryResult.rows[0];
  const createdAt = new Date("2026-09-07T08:00:00.000Z");
  const deadline = new Date(
    createdAt.getTime() + category.sla_minutes * 60 * 1000
  );

  const complaintResult = await pool.query(
    `INSERT INTO complaints (
       hostel_id, reported_by_user_id, student_profile_id, category_id,
       location, description, priority, sla_policy_minutes, sla_deadline,
       created_at, updated_at
     )
     VALUES ($1, $2, $3, $4, 'Block A, Room 101',
       'The ceiling light is flickering continuously.', $5, $6, $7, $8, $8)
     RETURNING id`,
    [
      hostelId,
      userByRole.student,
      profileResult.rows[0].id,
      category.id,
      category.default_priority,
      category.sla_minutes,
      deadline,
      createdAt,
    ]
  );
  complaintId = complaintResult.rows[0].id;

  await pool.query(
    `INSERT INTO complaint_events (
       complaint_id, event_type, from_status, to_status,
       actor_user_id, actor_name, actor_role
     )
     VALUES ($1, 'created', null, 'created', $2,
       'Complaint Student', 'student')`,
    [complaintId, userByRole.student]
  );
});

after(async () => {
  await pool.end();
});

test("the migration seeds category policies and preserves the legacy tables", async () => {
  const result = await pool.query(
    `SELECT
       (SELECT count(*)::integer FROM complaint_categories) AS categories,
       to_regclass('public.legacy_complaints') IS NOT NULL AS has_legacy_complaints,
       to_regclass('public.legacy_complaint_timelines') IS NOT NULL AS has_legacy_timeline`
  );

  assert.deepEqual(result.rows[0], {
    categories: 6,
    has_legacy_complaints: true,
    has_legacy_timeline: true,
  });
});

test("only one active assignment is allowed and assignees must be maintenance staff", async () => {
  await pool.query(
    `INSERT INTO complaint_assignments
       (complaint_id, assignee_user_id, assigned_by_user_id)
     VALUES ($1, $2, $3)`,
    [complaintId, maintenanceUserId, wardenUserId]
  );

  await assert.rejects(
    pool.query(
      `INSERT INTO complaint_assignments
         (complaint_id, assignee_user_id, assigned_by_user_id)
       VALUES ($1, $2, $3)`,
      [complaintId, maintenanceUserId, wardenUserId]
    ),
    (error) =>
      postgresErrorCode(error) === "23505" &&
      error.constraint === "complaint_assignments_one_active_per_complaint"
  );

  const guardResult = await pool.query(
    "SELECT id FROM users WHERE email = 'complaint.guard@integration.test'"
  );
  await assert.rejects(
    pool.query(
      `INSERT INTO complaint_assignments
         (complaint_id, assignee_user_id, assigned_by_user_id)
       VALUES ($1, $2, $3)`,
      [complaintId, guardResult.rows[0].id, wardenUserId]
    ),
    (error) => postgresErrorCode(error) === "23514"
  );
});

test("complaint timeline events cannot be edited or deleted", async () => {
  const eventResult = await pool.query(
    "SELECT id FROM complaint_events WHERE complaint_id = $1",
    [complaintId]
  );
  const eventId = eventResult.rows[0].id;

  await assert.rejects(
    pool.query("UPDATE complaint_events SET actor_name = 'Changed' WHERE id = $1", [
      eventId,
    ]),
    (error) => postgresErrorCode(error) === "55000"
  );
  await assert.rejects(
    pool.query("DELETE FROM complaint_events WHERE id = $1", [eventId]),
    (error) => postgresErrorCode(error) === "55000"
  );
});
