import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../src/db/schema.js";
import { USER_ROLES } from "../../src/domain/roles.js";
import {
  getComplaintSlaMetrics,
  monitorComplaintSlaBreaches,
} from "../../src/services/complaintSlaService.js";

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
const database = drizzle(pool, { schema });
const metricTime = new Date("2026-09-08T12:00:00.000Z");

let adminUserId;
let wardenUserId;
let maintenanceUserId;
let overdueComplaintIds;
let resolvedComplaintId;

before(async () => {
  const hostelResult = await pool.query(
    `INSERT INTO hostels (code, name)
     VALUES
       ('SLA1', 'SLA Metrics Hostel One'),
       ('SLA2', 'SLA Metrics Hostel Two')
     RETURNING id, code`
  );
  const hostelByCode = Object.fromEntries(
    hostelResult.rows.map((hostel) => [hostel.code, hostel.id])
  );

  const userResult = await pool.query(
    `INSERT INTO users (name, email, password, role, account_status, roll_no)
     VALUES
       ('SLA Admin', 'sla.admin@integration.test', 'test-hash', 'admin', 'active', null),
       ('SLA Warden', 'sla.warden@integration.test', 'test-hash', 'warden', 'active', null),
       ('SLA Technician', 'sla.maintenance@integration.test', 'test-hash', 'maintenance', 'active', null),
       ('SLA Student One', 'sla.student.one@integration.test', 'test-hash', 'student', 'active', 'SLA-STUDENT-01'),
       ('SLA Student Two', 'sla.student.two@integration.test', 'test-hash', 'student', 'active', 'SLA-STUDENT-02')
     RETURNING id, role, email`
  );
  const userByEmail = Object.fromEntries(
    userResult.rows.map((user) => [user.email, user.id])
  );
  adminUserId = userByEmail["sla.admin@integration.test"];
  wardenUserId = userByEmail["sla.warden@integration.test"];
  maintenanceUserId = userByEmail["sla.maintenance@integration.test"];
  const studentOneId = userByEmail["sla.student.one@integration.test"];
  const studentTwoId = userByEmail["sla.student.two@integration.test"];

  await pool.query(
    `INSERT INTO hostel_memberships (user_id, hostel_id, is_primary)
     VALUES
       ($1, $4, true),
       ($2, $4, true),
       ($3, $4, true),
       ($5, $6, true)`,
    [
      wardenUserId,
      maintenanceUserId,
      studentOneId,
      hostelByCode.SLA1,
      studentTwoId,
      hostelByCode.SLA2,
    ]
  );

  const profileResult = await pool.query(
    `INSERT INTO student_profiles (user_id, hostel_id, roll_no)
     VALUES
       ($1, $2, 'SLA-STUDENT-01'),
       ($3, $4, 'SLA-STUDENT-02')
     RETURNING id, user_id`,
    [studentOneId, hostelByCode.SLA1, studentTwoId, hostelByCode.SLA2]
  );
  const profileByUser = Object.fromEntries(
    profileResult.rows.map((profile) => [profile.user_id, profile.id])
  );
  const categoryResult = await pool.query(
    "SELECT id FROM complaint_categories WHERE code = 'other'"
  );
  const categoryId = categoryResult.rows[0].id;

  const complaintResult = await pool.query(
    `INSERT INTO complaints (
       hostel_id, reported_by_user_id, student_profile_id, category_id,
       location, description, priority, sla_policy_minutes, sla_deadline,
       status, resolution_note, resolved_at, closed_at, created_at, updated_at
     )
     VALUES
       ($1, $3, $5, $7, 'SLA1 Lobby', 'Overdue lobby repair needs attention.',
        'high', 720, '2026-09-02T00:00:00Z', 'created', null, null, null,
        '2026-09-01T00:00:00Z', '2026-09-01T00:00:00Z'),
       ($1, $3, $5, $7, 'SLA1 Room 10', 'Assigned repair remains within its deadline.',
        'medium', 2880, '2026-09-09T00:00:00Z', 'assigned', null, null, null,
        '2026-09-07T00:00:00Z', '2026-09-07T00:00:00Z'),
       ($1, $3, $5, $7, 'SLA1 Room 11', 'Resolved repair crossed its original deadline.',
        'high', 720, '2026-09-02T00:00:00Z', 'resolved', 'Repair completed after a second visit.',
        '2026-09-03T02:00:00Z', null, '2026-09-01T00:00:00Z', '2026-09-03T02:00:00Z'),
       ($1, $3, $5, $7, 'SLA1 Room 12', 'Closed repair finished comfortably within SLA.',
        'high', 720, '2026-09-02T00:00:00Z', 'closed', 'Repair completed and confirmed.',
        '2026-09-01T01:00:00Z', '2026-09-01T02:00:00Z',
        '2026-09-01T00:00:00Z', '2026-09-01T02:00:00Z'),
       ($2, $4, $6, $7, 'SLA2 Lobby', 'Second hostel overdue repair needs attention.',
        'critical', 120, '2026-09-02T00:00:00Z', 'created', null, null, null,
        '2026-09-01T00:00:00Z', '2026-09-01T00:00:00Z')
     RETURNING id, hostel_id, status
    `,
    [
      hostelByCode.SLA1,
      hostelByCode.SLA2,
      studentOneId,
      studentTwoId,
      profileByUser[studentOneId],
      profileByUser[studentTwoId],
      categoryId,
    ]
  );
  const [overdueOne, assigned, resolved, closed, overdueTwo] =
    complaintResult.rows;
  overdueComplaintIds = [overdueOne.id, overdueTwo.id];
  resolvedComplaintId = resolved.id;

  await pool.query(
    `INSERT INTO complaint_assignments
       (complaint_id, assignee_user_id, assigned_by_user_id, assigned_at)
     VALUES
       ($1, $3, $4, '2026-09-07T01:00:00Z'),
       ($2, $3, $4, '2026-09-01T01:00:00Z')`,
    [assigned.id, resolved.id, maintenanceUserId, wardenUserId]
  );

  const createdEvents = complaintResult.rows.map((complaint, index) => ({
    complaintId: complaint.id,
    actorUserId: index === 4 ? studentTwoId : studentOneId,
    occurredAt:
      index === 1
        ? new Date("2026-09-07T00:00:00Z")
        : new Date("2026-09-01T00:00:00Z"),
  }));
  await database.insert(schema.complaintEvents).values(
    createdEvents.map((event) => ({
      complaintId: event.complaintId,
      eventType: "created",
      fromStatus: null,
      toStatus: "created",
      actorUserId: event.actorUserId,
      actorName: "SLA Test Student",
      actorRole: "student",
      occurredAt: event.occurredAt,
    }))
  );

  await database.insert(schema.complaintEvents).values([
    {
      complaintId: resolved.id,
      eventType: "resolved",
      fromStatus: "in_progress",
      toStatus: "resolved",
      actorUserId: maintenanceUserId,
      actorName: "SLA Technician",
      actorRole: "maintenance",
      occurredAt: new Date("2026-09-03T00:00:00Z"),
    },
    {
      complaintId: resolved.id,
      eventType: "reopened",
      fromStatus: "resolved",
      toStatus: "in_progress",
      actorUserId: studentOneId,
      actorName: "SLA Student One",
      actorRole: "student",
      occurredAt: new Date("2026-09-03T01:00:00Z"),
    },
    {
      complaintId: resolved.id,
      eventType: "resolved",
      fromStatus: "in_progress",
      toStatus: "resolved",
      actorUserId: maintenanceUserId,
      actorName: "SLA Technician",
      actorRole: "maintenance",
      occurredAt: new Date("2026-09-03T02:00:00Z"),
    },
    {
      complaintId: closed.id,
      eventType: "resolved",
      fromStatus: "in_progress",
      toStatus: "resolved",
      actorUserId: maintenanceUserId,
      actorName: "SLA Technician",
      actorRole: "maintenance",
      occurredAt: new Date("2026-09-01T01:00:00Z"),
    },
    {
      complaintId: closed.id,
      eventType: "closed",
      fromStatus: "resolved",
      toStatus: "closed",
      actorUserId: studentOneId,
      actorName: "SLA Student One",
      actorRole: "student",
      occurredAt: new Date("2026-09-01T02:00:00Z"),
    },
  ]);
});

after(async () => {
  await pool.end();
});

test("SLA metrics reconcile and respect institution, hostel, and assignment scope", async () => {
  const adminMetrics = await getComplaintSlaMetrics(
    database,
    { id: adminUserId, role: USER_ROLES.ADMIN },
    {},
    { now: metricTime }
  );
  const wardenMetrics = await getComplaintSlaMetrics(
    database,
    { id: wardenUserId, role: USER_ROLES.WARDEN },
    {},
    { now: metricTime }
  );
  const maintenanceMetrics = await getComplaintSlaMetrics(
    database,
    { id: maintenanceUserId, role: USER_ROLES.MAINTENANCE },
    {},
    { now: metricTime }
  );

  assert.deepEqual(
    {
      open: adminMetrics.counts.open,
      actionable: adminMetrics.counts.actionable,
      awaiting: adminMetrics.counts.awaitingStudentConfirmation,
      breached: adminMetrics.counts.slaBreached,
      unassigned: adminMetrics.counts.unassigned,
    },
    { open: 4, actionable: 3, awaiting: 1, breached: 2, unassigned: 2 }
  );
  assert.deepEqual(adminMetrics.counts.byPriority, {
    critical: 1,
    high: 1,
    medium: 1,
    low: 0,
  });
  assert.deepEqual(adminMetrics.resolution, {
    firstResolvedComplaints: 2,
    withinSla: 1,
    afterSla: 1,
    compliancePercent: 50,
    averageFirstResolutionMinutes: 1470,
    reopenedComplaints: 1,
    reopenEvents: 1,
  });

  assert.equal(wardenMetrics.scope.kind, "managed_hostels");
  assert.equal(wardenMetrics.counts.open, 3);
  assert.equal(wardenMetrics.counts.slaBreached, 1);

  assert.equal(maintenanceMetrics.scope.kind, "active_assignments");
  assert.equal(maintenanceMetrics.counts.open, 2);
  assert.equal(maintenanceMetrics.counts.actionable, 1);
  assert.equal(maintenanceMetrics.counts.awaitingStudentConfirmation, 1);
  assert.equal(maintenanceMetrics.counts.slaBreached, 0);
  assert.equal(maintenanceMetrics.resolution.firstResolvedComplaints, 1);
});

test("SLA monitor records each actionable breach exactly once", async () => {
  const firstRun = await monitorComplaintSlaBreaches(database, {
    now: metricTime,
    batchSize: 10,
  });
  const secondRun = await monitorComplaintSlaBreaches(database, {
    now: new Date("2026-09-08T12:01:00.000Z"),
    batchSize: 10,
  });

  assert.equal(firstRun.processed, 2);
  assert.deepEqual(
    firstRun.breaches.map((breach) => breach.complaintId).sort((a, b) => a - b),
    [...overdueComplaintIds].sort((a, b) => a - b)
  );
  assert.equal(secondRun.processed, 0);

  const result = await pool.query(
    `SELECT
       (SELECT count(*)::integer
        FROM complaint_events
        WHERE event_type = 'sla_breached'
          AND complaint_id = ANY($1::integer[])) AS timeline_events,
       (SELECT count(*)::integer
        FROM audit_events
        WHERE action = 'complaint.sla.breached'
          AND resource_id = ANY($2::text[])) AS audit_events,
       (SELECT sla_breached_at
        FROM complaints
        WHERE id = $3) AS resolved_breach_time`,
    [overdueComplaintIds, overdueComplaintIds.map(String), resolvedComplaintId]
  );

  assert.equal(result.rows[0].timeline_events, 2);
  assert.equal(result.rows[0].audit_events, 2);
  assert.equal(result.rows[0].resolved_breach_time, null);

  const metrics = await getComplaintSlaMetrics(
    database,
    { id: adminUserId, role: USER_ROLES.ADMIN },
    {},
    { now: metricTime }
  );
  assert.equal(metrics.counts.recordedBreaches, 2);
});
