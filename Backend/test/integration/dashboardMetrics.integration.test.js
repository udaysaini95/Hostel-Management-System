import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../src/db/schema.js";
import { USER_ROLES } from "../../src/domain/roles.js";
import { getDashboardSummary } from "../../src/services/dashboardService.js";

const { Pool } = pg;

if (!process.env.TEST_DATABASE_URL) {
  throw new Error("Integration tests must be started through the repository test runner.");
}

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const database = drizzle(pool, { schema });
const generatedAt = new Date("2026-09-10T12:00:00.000Z");
const actorFor = (user) => ({ id: user.id, role: user.role });

let actors;

before(async () => {
  const hostelResult = await pool.query(`
    insert into hostels (code, name)
    values ('DASH1', 'Dashboard Hostel One'), ('DASH2', 'Dashboard Hostel Two')
    returning id, code
  `);
  const hostelIds = Object.fromEntries(
    hostelResult.rows.map((hostel) => [hostel.code, hostel.id])
  );

  const userResult = await pool.query(`
    insert into users (name, email, password, role, account_status)
    values
      ('Dashboard Admin', 'dashboard.admin@integration.test', 'test-hash', 'admin', 'active'),
      ('Dashboard Warden', 'dashboard.warden@integration.test', 'test-hash', 'warden', 'active'),
      ('Dashboard Technician', 'dashboard.maintenance@integration.test', 'test-hash', 'maintenance', 'active'),
      ('Dashboard Guard', 'dashboard.guard@integration.test', 'test-hash', 'guard', 'active'),
      ('Dashboard Student One', 'dashboard.student.one@integration.test', 'test-hash', 'student', 'active'),
      ('Dashboard Student Two', 'dashboard.student.two@integration.test', 'test-hash', 'student', 'active')
    returning id, email, role
  `);
  actors = Object.fromEntries(
    userResult.rows.map((user) => [user.email.split("@")[0].split(".").at(-1), user])
  );
  const studentOne = userResult.rows.find((user) => user.email.includes("student.one"));
  const studentTwo = userResult.rows.find((user) => user.email.includes("student.two"));
  const warden = userResult.rows.find((user) => user.role === USER_ROLES.WARDEN);
  const maintenance = userResult.rows.find((user) => user.role === USER_ROLES.MAINTENANCE);
  const guard = userResult.rows.find((user) => user.role === USER_ROLES.GUARD);

  await pool.query(
    `insert into hostel_memberships (user_id, hostel_id, is_primary)
     values ($1, $6, true), ($2, $6, true), ($3, $6, true),
            ($4, $6, true), ($5, $7, true)`,
    [warden.id, maintenance.id, guard.id, studentOne.id, studentTwo.id,
      hostelIds.DASH1, hostelIds.DASH2]
  );

  const profileResult = await pool.query(
    `insert into student_profiles (user_id, hostel_id, roll_no)
     values ($1, $2, 'DASH-STUDENT-01'), ($3, $4, 'DASH-STUDENT-02')
     returning id, user_id`,
    [studentOne.id, hostelIds.DASH1, studentTwo.id, hostelIds.DASH2]
  );
  const profileIds = Object.fromEntries(
    profileResult.rows.map((profile) => [profile.user_id, profile.id])
  );

  const blockResult = await pool.query(
    `insert into hostel_blocks (hostel_id, code, name)
     values ($1, 'A', 'Dashboard Block') returning id`,
    [hostelIds.DASH1]
  );
  const roomResult = await pool.query(
    `insert into rooms (block_id, room_number, floor, capacity)
     values ($1, '101', 1, 4) returning id`,
    [blockResult.rows[0].id]
  );
  await pool.query(
    `insert into room_allocations
       (student_profile_id, room_id, allocated_by_user_id, allocated_at)
     values ($1, $2, $3, '2026-09-01T00:00:00Z')`,
    [profileIds[studentOne.id], roomResult.rows[0].id, warden.id]
  );

  const categoryResult = await pool.query(
    "select id from complaint_categories where code = 'other'"
  );
  const complaintResult = await pool.query(
    `insert into complaints (
       hostel_id, reported_by_user_id, student_profile_id, category_id,
       location, description, priority, sla_policy_minutes, sla_deadline,
       status, resolution_note, resolved_at, closed_at, created_at, updated_at
     ) values
       ($1, $3, $5, $7, 'Room 101', 'Assigned repair is beyond its deadline.',
        'high', 1440, '2026-09-09T00:00:00Z', 'assigned', null, null, null,
        '2026-09-07T00:00:00Z', '2026-09-07T00:00:00Z'),
       ($1, $3, $5, $7, 'Common room', 'Resolved work awaits student confirmation.',
        'medium', 1440, '2026-09-08T00:00:00Z', 'resolved', 'Repair completed.',
        '2026-09-08T02:00:00Z', null, '2026-09-07T00:00:00Z', '2026-09-08T02:00:00Z'),
       ($2, $4, $6, $7, 'Lobby', 'Other hostel repair must stay outside warden scope.',
        'critical', 1440, '2026-09-09T00:00:00Z', 'created', null, null, null,
        '2026-09-07T00:00:00Z', '2026-09-07T00:00:00Z')
     returning id, status`,
    [hostelIds.DASH1, hostelIds.DASH2, studentOne.id, studentTwo.id,
      profileIds[studentOne.id], profileIds[studentTwo.id], categoryResult.rows[0].id]
  );
  const assignedComplaint = complaintResult.rows.find((complaint) => complaint.status === "assigned");
  await pool.query(
    `insert into complaint_assignments
       (complaint_id, assignee_user_id, assigned_by_user_id, assigned_at)
     values ($1, $2, $3, '2026-09-07T01:00:00Z')`,
    [assignedComplaint.id, maintenance.id, warden.id]
  );

  await pool.query(
    `insert into leave_requests (
       hostel_id, student_user_id, student_profile_id, room_allocation_id,
       reason, departure_at, expected_return_at, status, created_at, updated_at
     ) values
       ($1, $2, $3, null, 'Academic visit awaiting approval.',
        '2026-09-12T08:00:00Z', '2026-09-12T18:00:00Z', 'pending',
        '2026-09-09T00:00:00Z', '2026-09-09T00:00:00Z'),
       ($1, $2, $3, null, 'Weekend visit with an overdue return.',
        '2026-09-08T08:00:00Z', '2026-09-09T18:00:00Z', 'exited',
        '2026-09-07T00:00:00Z', '2026-09-08T08:00:00Z')`,
    [hostelIds.DASH1, studentOne.id, profileIds[studentOne.id]]
  );

  const menuResult = await pool.query(
    `insert into mess_menus (hostel_id, menu_date, current_version)
     values ($1, '2026-09-10', 1) returning id`,
    [hostelIds.DASH1]
  );
  const versionResult = await pool.query(
    `insert into mess_menu_versions (menu_id, version, published_by_user_id, published_at)
     values ($1, 1, $2, '2026-09-10T05:00:00Z') returning id`,
    [menuResult.rows[0].id, warden.id]
  );
  await pool.query(
    `insert into mess_menu_items (menu_version_id, meal_type, position, name)
     values ($1, 'breakfast', 1, 'Poha'), ($1, 'lunch', 1, 'Dal and rice')`,
    [versionResult.rows[0].id]
  );
  await pool.query(
    `insert into mess_feedbacks
       (menu_id, menu_version_id, student_user_id, meal_type, rating, submitted_at)
     values ($1, $2, $3, 'breakfast', 4, '2026-09-10T08:00:00Z'),
            ($1, $2, $3, 'lunch', 2, '2026-09-10T09:00:00Z')`,
    [menuResult.rows[0].id, versionResult.rows[0].id, studentOne.id]
  );

  const noticeResult = await pool.query(
    `insert into notices
       (published_by_user_id, title, body, priority, audience_type, hostel_id, published_at)
     values ($1, 'Dashboard notice', 'An unread dashboard notice.', 'normal', 'hostel', $2,
             '2026-09-10T06:00:00Z') returning id`,
    [warden.id, hostelIds.DASH1]
  );
  await pool.query(
    `insert into notice_recipients (notice_id, user_id, created_at)
     values ($1, $2, '2026-09-10T06:00:00Z')`,
    [noticeResult.rows[0].id, studentOne.id]
  );

  await pool.query(
    `insert into audit_events
       (actor_user_id, actor_name, actor_email, actor_role, category, action,
        resource_type, resource_id, description, created_at)
     values ($1, 'Dashboard Warden', 'dashboard.warden@integration.test', 'warden',
             'gate', 'gate.movement.overridden', 'gate_event', '999',
             'Dashboard exception fixture', '2026-09-10T10:00:00Z')`,
    [warden.id]
  );
});

after(async () => {
  await pool.end();
});

test("student dashboard returns owned records and the current hostel menu", async () => {
  const summary = await getDashboardSummary(database, actorFor(actors.one), { now: generatedAt });

  assert.equal(summary.role, USER_ROLES.STUDENT);
  assert.equal(summary.scope.kind, "own");
  assert.equal(summary.data.activeComplaints.value, 2);
  assert.equal(summary.data.unreadNotices.value, 1);
  assert.equal(summary.data.latestLeave.value.status, "pending");
  assert.equal(summary.data.todayMenu.value.date, "2026-09-10");
  assert.deepEqual(
    summary.data.todayMenu.value.items.map((item) => item.name),
    ["Poha", "Dal and rice"]
  );
});

test("warden metrics reconcile exactly inside assigned hostel scope", async () => {
  const summary = await getDashboardSummary(database, actorFor(actors.warden), { now: generatedAt });
  const metrics = summary.data;

  assert.deepEqual(summary.scope.hostelIds.length, 1);
  assert.equal(metrics.pendingLeaveRequests.value, 1);
  assert.equal(metrics.openComplaints.value, 2);
  assert.equal(metrics.slaBreachedComplaints.value, 2);
  assert.equal(metrics.studentsOutside.value, 1);
  assert.equal(metrics.overdueReturns.value, 1);
  assert.equal(metrics.messAverageRating.value, 3);
  assert.equal(metrics.messAverageRating.responseCount, 2);
});

test("maintenance and guard dashboards retain assignment and hostel boundaries", async () => {
  const maintenance = await getDashboardSummary(
    database,
    actorFor(actors.maintenance),
    { now: generatedAt }
  );
  const guard = await getDashboardSummary(database, actorFor(actors.guard), { now: generatedAt });

  assert.equal(maintenance.data.assignedWork.value, 1);
  assert.equal(maintenance.data.slaBreachedWork.value, 1);
  assert.equal(maintenance.data.workItems.length, 1);
  assert.equal(Object.hasOwn(maintenance.data.workItems[0], "student"), false);
  assert.equal(guard.data.studentsOutside.value, 1);
  assert.equal(guard.data.overdueReturns.value, 1);
});

test("admin occupancy and account values reconcile with persisted source rows", async () => {
  const summary = await getDashboardSummary(database, actorFor(actors.admin), { now: generatedAt });
  const source = await pool.query(`
    select
      (select count(*)::integer from users) as total_users,
      (select count(*)::integer from users where account_status = 'active') as active_users,
      (select coalesce(sum(capacity), 0)::integer from rooms where is_active = true) as capacity,
      (select count(*)::integer from room_allocations allocation
       inner join rooms room on room.id = allocation.room_id
       where allocation.vacated_at is null and room.is_active = true) as occupied_beds
  `);
  const record = source.rows[0];
  const administration = summary.data.administration;

  assert.equal(administration.totalUsers.value, record.total_users);
  assert.equal(administration.activeUsers.value, record.active_users);
  assert.equal(administration.roomOccupancy.capacity, record.capacity);
  assert.equal(administration.roomOccupancy.occupiedBeds, record.occupied_beds);
  assert.equal(
    administration.roomOccupancy.value,
    Number(((record.occupied_beds / record.capacity) * 100).toFixed(1))
  );
  assert.ok(administration.auditExceptions.value >= 1);
});
