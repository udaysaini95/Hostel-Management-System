import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../src/db/schema.js";
import { REPORT_TYPES } from "../../src/domain/reports.js";
import { getOperationalReport } from "../../src/services/reportService.js";

const { Pool } = pg;

if (!process.env.TEST_DATABASE_URL) {
  throw new Error("Integration tests must be started through the repository test runner.");
}

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const database = drizzle(pool, { schema });
const now = new Date("2026-09-10T12:00:00.000Z");
const periodFilters = {
  page: 1,
  pageSize: 25,
  from: "2026-09-01T00:00:00.000Z",
  to: "2026-09-10T12:00:00.000Z",
};

let actors;
let hostelIds;

before(async () => {
  const hostelResult = await pool.query(`
    insert into hostels (code, name)
    values ('REP1', 'Reporting Hostel One'), ('REP2', 'Reporting Hostel Two')
    returning id, code
  `);
  hostelIds = Object.fromEntries(hostelResult.rows.map((row) => [row.code, row.id]));

  const userResult = await pool.query(`
    insert into users (name, email, password, role, account_status)
    values
      ('Report Admin', 'report.admin@integration.test', 'test-hash', 'admin', 'active'),
      ('Report Warden', 'report.warden@integration.test', 'test-hash', 'warden', 'active'),
      ('Report Student One', 'report.student.one@integration.test', 'test-hash', 'student', 'active'),
      ('Report Student Two', 'report.student.two@integration.test', 'test-hash', 'student', 'active')
    returning id, email, role
  `);
  actors = Object.fromEntries(
    userResult.rows.map((user) => [user.email.split("@")[0].split(".").at(-1), user])
  );

  await pool.query(
    `insert into hostel_memberships (user_id, hostel_id, is_primary)
     values ($1, $4, true), ($2, $4, true), ($3, $5, true)`,
    [actors.warden.id, actors.one.id, actors.two.id, hostelIds.REP1, hostelIds.REP2]
  );

  const profileResult = await pool.query(
    `insert into student_profiles (user_id, hostel_id, roll_no)
     values ($1, $2, 'REP-STUDENT-01'), ($3, $4, 'REP-STUDENT-02')
     returning id, user_id`,
    [actors.one.id, hostelIds.REP1, actors.two.id, hostelIds.REP2]
  );
  const profileIds = Object.fromEntries(
    profileResult.rows.map((profile) => [profile.user_id, profile.id])
  );
  const categoryResult = await pool.query(
    "select id from complaint_categories where code = 'other'"
  );
  const categoryId = categoryResult.rows[0].id;

  const complaintResult = await pool.query(
    `insert into complaints (
       hostel_id, reported_by_user_id, student_profile_id, category_id,
       location, description, priority, sla_policy_minutes, sla_deadline,
       status, resolution_note, resolved_at, created_at, updated_at
     ) values
       ($1, $3, $5, $7, 'Room 101', 'Resolved within the reporting SLA.',
        'medium', 1440, '2026-09-06T08:00:00Z', 'resolved', 'Completed in time.',
        '2026-09-05T12:00:00Z', '2026-09-05T08:00:00Z', '2026-09-05T12:00:00Z'),
       ($1, $3, $5, $7, 'Hallway', 'Open complaint beyond its deadline.',
        'high', 1440, '2026-09-07T08:00:00Z', 'assigned', null, null,
        '2026-09-06T08:00:00Z', '2026-09-06T08:00:00Z'),
       ($2, $4, $6, $7, 'Lobby', 'Other hostel complaint outside warden scope.',
        'critical', 1440, '2026-09-08T08:00:00Z', 'created', null, null,
        '2026-09-07T08:00:00Z', '2026-09-07T08:00:00Z')
     returning id, status`,
    [hostelIds.REP1, hostelIds.REP2, actors.one.id, actors.two.id,
      profileIds[actors.one.id], profileIds[actors.two.id], categoryId]
  );
  const resolvedComplaint = complaintResult.rows.find((row) => row.status === "resolved");
  await pool.query(
    `insert into complaint_events (
       complaint_id, event_type, from_status, to_status, actor_user_id,
       actor_name, actor_role, note, occurred_at
     ) values ($1, 'resolved', 'in_progress', 'resolved', $2,
       'Report Warden', 'warden', 'Completed in time.', '2026-09-05T12:00:00Z')`,
    [resolvedComplaint.id, actors.warden.id]
  );

  const leaveResult = await pool.query(
    `insert into leave_requests (
       hostel_id, student_user_id, student_profile_id, reason,
       departure_at, expected_return_at, is_emergency, status, created_at, updated_at
     ) values
       ($1, $2, $3, 'Academic visit awaiting review.',
        '2026-09-12T08:00:00Z', '2026-09-12T18:00:00Z', true, 'pending',
        '2026-09-05T08:00:00Z', '2026-09-05T08:00:00Z'),
       ($1, $2, $3, 'Approved weekend visit.',
        '2026-09-06T08:00:00Z', '2026-09-07T18:00:00Z', false, 'approved',
        '2026-09-04T08:00:00Z', '2026-09-04T08:00:00Z'),
       ($4, $5, $6, 'Other hostel leave request.',
        '2026-09-13T08:00:00Z', '2026-09-13T18:00:00Z', false, 'pending',
        '2026-09-07T08:00:00Z', '2026-09-07T08:00:00Z')
     returning id, status, hostel_id`,
    [hostelIds.REP1, actors.one.id, profileIds[actors.one.id], hostelIds.REP2,
      actors.two.id, profileIds[actors.two.id]]
  );
  const movementLeave = leaveResult.rows.find(
    (row) => row.hostel_id === hostelIds.REP1 && row.status === "approved"
  );
  await pool.query(
    `insert into gate_events (
       leave_request_id, movement, verification_method, performed_by_user_id,
       actor_name, actor_role, idempotency_key, note, occurred_at
     ) values
       ($1, 'exit', 'override', $2, 'Report Warden', 'warden',
        'report-exit-event-0001', 'Verified reporting fixture exit.', '2026-09-06T08:00:00Z'),
       ($1, 'return', 'override', $2, 'Report Warden', 'warden',
        'report-return-event-01', 'Verified reporting fixture return.', '2026-09-07T17:00:00Z')`,
    [movementLeave.id, actors.warden.id]
  );

  const menuResult = await pool.query(
    `insert into mess_menus (hostel_id, menu_date, current_version)
     values ($1, '2026-09-05', 1), ($2, '2026-09-05', 1)
     returning id, hostel_id`,
    [hostelIds.REP1, hostelIds.REP2]
  );
  for (const menu of menuResult.rows) {
    const publisher = menu.hostel_id === hostelIds.REP1 ? actors.warden : actors.admin;
    const versionResult = await pool.query(
      `insert into mess_menu_versions (menu_id, version, published_by_user_id, published_at)
       values ($1, 1, $2, '2026-09-05T05:00:00Z') returning id`,
      [menu.id, publisher.id]
    );
    const student = menu.hostel_id === hostelIds.REP1 ? actors.one : actors.two;
    if (menu.hostel_id === hostelIds.REP1) {
      await pool.query(
        `insert into mess_menu_items (menu_version_id, meal_type, position, name)
         values ($1, 'breakfast', 1, 'Poha'), ($1, 'lunch', 1, 'Dal and rice')`,
        [versionResult.rows[0].id]
      );
      await pool.query(
        `insert into mess_feedbacks
           (menu_id, menu_version_id, student_user_id, meal_type, rating, submitted_at)
         values ($1, $2, $3, 'breakfast', 4, '2026-09-05T08:00:00Z'),
                ($1, $2, $3, 'lunch', 2, '2026-09-05T13:00:00Z')`,
        [menu.id, versionResult.rows[0].id, student.id]
      );
    } else {
      await pool.query(
        `insert into mess_menu_items (menu_version_id, meal_type, position, name)
         values ($1, 'dinner', 1, 'Vegetable curry')`,
        [versionResult.rows[0].id]
      );
      await pool.query(
        `insert into mess_feedbacks
           (menu_id, menu_version_id, student_user_id, meal_type, rating, submitted_at)
         values ($1, $2, $3, 'dinner', 5, '2026-09-05T20:00:00Z')`,
        [menu.id, versionResult.rows[0].id, student.id]
      );
    }
  }
});

after(async () => {
  await pool.end();
});

const actorFor = (actor) => ({ id: actor.id, role: actor.role });

test("warden complaint report reconciles definitions, filters, and pagination", async () => {
  const report = await getOperationalReport(
    database,
    actorFor(actors.warden),
    REPORT_TYPES.COMPLAINTS,
    { ...periodFilters, pageSize: 1 },
    { now }
  );

  assert.equal(report.scope.kind, "assigned_hostels");
  assert.deepEqual(report.scope.hostelIds, [hostelIds.REP1]);
  assert.equal(report.summary.total, 2);
  assert.equal(report.summary.open, 2);
  assert.equal(report.summary.currentSlaBreaches, 2);
  assert.equal(report.summary.firstResolvedComplaints, 1);
  assert.equal(report.summary.resolvedWithinSla, 1);
  assert.equal(report.summary.resolutionCompliancePercent, 100);
  assert.equal(report.summary.averageFirstResolutionHours, 4);
  assert.equal(report.data.length, 1);
  assert.deepEqual(report.pagination, { page: 1, pageSize: 1, total: 2, totalPages: 2 });
});

test("warden reports reconcile leave, gate, and mess rows inside hostel scope", async () => {
  const [leave, gate, mess] = await Promise.all([
    getOperationalReport(database, actorFor(actors.warden), REPORT_TYPES.LEAVES, periodFilters, { now }),
    getOperationalReport(database, actorFor(actors.warden), REPORT_TYPES.GATE, periodFilters, { now }),
    getOperationalReport(database, actorFor(actors.warden), REPORT_TYPES.MESS, periodFilters, { now }),
  ]);

  assert.equal(leave.summary.total, 2);
  assert.equal(leave.summary.emergency, 1);
  assert.equal(gate.summary.total, 2);
  assert.equal(gate.summary.exits, 1);
  assert.equal(gate.summary.returns, 1);
  assert.equal(gate.summary.overrides, 2);
  assert.equal(mess.summary.responses, 2);
  assert.equal(mess.summary.averageRating, 3);
  assert.equal(mess.pagination.total, 2);
});

test("admin sees institution data while unassigned hostel requests are denied to wardens", async () => {
  const adminReport = await getOperationalReport(
    database,
    actorFor(actors.admin),
    REPORT_TYPES.COMPLAINTS,
    periodFilters,
    { now }
  );
  assert.equal(adminReport.scope.kind, "institution");
  assert.ok(adminReport.summary.total >= 3);

  await assert.rejects(
    getOperationalReport(
      database,
      actorFor(actors.warden),
      REPORT_TYPES.LEAVES,
      { ...periodFilters, hostelId: hostelIds.REP2 },
      { now }
    ),
    (error) => error.code === "REPORT_HOSTEL_ACCESS_DENIED"
  );
});

test("student accounts cannot bypass route permissions by calling the report service", async () => {
  await assert.rejects(
    getOperationalReport(
      database,
      actorFor(actors.one),
      REPORT_TYPES.COMPLAINTS,
      periodFilters,
      { now }
    ),
    (error) => error.code === "REPORT_ACCESS_DENIED"
  );
});

test("report-specific filters change both summary and source rows", async () => {
  const report = await getOperationalReport(
    database,
    actorFor(actors.warden),
    REPORT_TYPES.GATE,
    { ...periodFilters, movement: "return" },
    { now }
  );

  assert.equal(report.summary.total, 1);
  assert.equal(report.summary.exits, 0);
  assert.equal(report.summary.returns, 1);
  assert.deepEqual(report.filters, { movement: "return" });
  assert.equal(report.data[0].movement, "return");
});
