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

let hostelId;
let studentId;
let studentProfileId;
let roomAllocationId;
let wardenId;
let guardId;
let leaveRequestId;
let gatePassId;

before(async () => {
  const hostelResult = await pool.query(
    `INSERT INTO hostels (code, name)
     VALUES ('LEV1', 'Leave Foundation Hostel')
     RETURNING id`
  );
  hostelId = hostelResult.rows[0].id;

  const userResult = await pool.query(
    `INSERT INTO users (name, email, password, role, account_status, roll_no)
     VALUES
       ('Leave Student', 'leave.student@integration.test', 'test-hash', 'student', 'active', 'LEV-STUDENT-01'),
       ('Leave Warden', 'leave.warden@integration.test', 'test-hash', 'warden', 'active', null),
       ('Leave Guard', 'leave.guard@integration.test', 'test-hash', 'guard', 'active', null)
     RETURNING id, role`
  );
  const userByRole = Object.fromEntries(
    userResult.rows.map((user) => [user.role, user.id])
  );
  studentId = userByRole.student;
  wardenId = userByRole.warden;
  guardId = userByRole.guard;

  await pool.query(
    `INSERT INTO hostel_memberships (user_id, hostel_id, is_primary)
     VALUES ($1, $4, true), ($2, $4, true), ($3, $4, true)`,
    [studentId, wardenId, guardId, hostelId]
  );

  const blockResult = await pool.query(
    `INSERT INTO hostel_blocks (hostel_id, code, name)
     VALUES ($1, 'A', 'Leave Test Block')
     RETURNING id`,
    [hostelId]
  );
  const roomResult = await pool.query(
    `INSERT INTO rooms (block_id, room_number, floor, capacity)
     VALUES ($1, '101', 1, 2)
     RETURNING id`,
    [blockResult.rows[0].id]
  );
  const profileResult = await pool.query(
    `INSERT INTO student_profiles (user_id, hostel_id, roll_no)
     VALUES ($1, $2, 'LEV-STUDENT-01')
     RETURNING id`,
    [studentId, hostelId]
  );
  studentProfileId = profileResult.rows[0].id;
  const allocationResult = await pool.query(
    `INSERT INTO room_allocations (
       student_profile_id, room_id, allocated_by_user_id, allocated_at
     )
     VALUES ($1, $2, $3, '2026-09-01T00:00:00Z')
     RETURNING id`,
    [studentProfileId, roomResult.rows[0].id, wardenId]
  );
  roomAllocationId = allocationResult.rows[0].id;
});

after(async () => {
  await pool.end();
});

test("migration preserves compatibility tables and creates normalized leave entities", async () => {
  const result = await pool.query(
    `SELECT
       to_regclass('public.legacy_leaves') IS NOT NULL AS has_legacy_leaves,
       to_regclass('public.legacy_gate_logs') IS NOT NULL AS has_legacy_gate_logs,
       to_regclass('public.leave_requests') IS NOT NULL AS has_leave_requests,
       to_regclass('public.leave_decisions') IS NOT NULL AS has_leave_decisions,
       to_regclass('public.gate_passes') IS NOT NULL AS has_gate_passes,
       to_regclass('public.leave_events') IS NOT NULL AS has_leave_events,
       to_regclass('public.gate_events') IS NOT NULL AS has_gate_events`
  );

  assert.deepEqual(result.rows[0], {
    has_legacy_leaves: true,
    has_legacy_gate_logs: true,
    has_leave_requests: true,
    has_leave_decisions: true,
    has_gate_passes: true,
    has_leave_events: true,
    has_gate_events: true,
  });
});

test("leave request dates and student scope are enforced by PostgreSQL", async () => {
  const valid = await pool.query(
    `INSERT INTO leave_requests (
       hostel_id, student_user_id, student_profile_id, room_allocation_id,
       reason, departure_at, expected_return_at, is_emergency,
       created_at, updated_at
     )
     VALUES (
       $1, $2, $3, $4, 'Family function outside the city',
       '2026-09-11T08:00:00Z', '2026-09-12T18:00:00Z', false,
       '2026-09-10T08:00:00Z', '2026-09-10T08:00:00Z'
     )
     RETURNING id, status, is_emergency`,
    [hostelId, studentId, studentProfileId, roomAllocationId]
  );
  leaveRequestId = valid.rows[0].id;

  assert.equal(valid.rows[0].status, "pending");
  assert.equal(valid.rows[0].is_emergency, false);

  await assert.rejects(
    pool.query(
      `INSERT INTO leave_requests (
         hostel_id, student_user_id, student_profile_id, reason,
         departure_at, expected_return_at, created_at, updated_at
       )
       VALUES ($1, $2, $3, 'Invalid reversed leave dates',
         '2026-09-12T08:00:00Z', '2026-09-11T08:00:00Z',
         '2026-09-10T08:00:00Z', '2026-09-10T08:00:00Z')`,
      [hostelId, studentId, studentProfileId]
    ),
    (error) =>
      postgresErrorCode(error) === "23514" &&
      error.constraint === "leave_requests_date_order_check"
  );

  await assert.rejects(
    pool.query(
      `INSERT INTO leave_requests (
         hostel_id, student_user_id, student_profile_id, reason,
         departure_at, expected_return_at, created_at, updated_at
       )
       VALUES ($1, $2, $3, 'Departure is already in the past',
         '2026-09-09T08:00:00Z', '2026-09-12T08:00:00Z',
         '2026-09-10T08:00:00Z', '2026-09-10T08:00:00Z')`,
      [hostelId, studentId, studentProfileId]
    ),
    (error) =>
      postgresErrorCode(error) === "23514" &&
      error.constraint === "leave_requests_departure_future_check"
  );

  await assert.rejects(
    pool.query(
      `INSERT INTO leave_requests (
         hostel_id, student_user_id, student_profile_id, reason,
         departure_at, expected_return_at, created_at, updated_at
       )
       VALUES ($1, $2, $3, 'Profile does not belong to this account',
         '2026-09-11T08:00:00Z', '2026-09-12T08:00:00Z',
         '2026-09-10T08:00:00Z', '2026-09-10T08:00:00Z')`,
      [hostelId, wardenId, studentProfileId]
    ),
    (error) => postgresErrorCode(error) === "23514"
  );
});

test("database guard permits only defined state transitions and immutable request data", async () => {
  const stateRequest = await pool.query(
    `INSERT INTO leave_requests (
       hostel_id, student_user_id, student_profile_id, room_allocation_id,
       reason, departure_at, expected_return_at, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, 'Separate request for transition checks',
       '2026-09-13T08:00:00Z', '2026-09-14T18:00:00Z',
       '2026-09-10T08:00:00Z', '2026-09-10T08:00:00Z')
     RETURNING id`,
    [hostelId, studentId, studentProfileId, roomAllocationId]
  );
  const stateRequestId = stateRequest.rows[0].id;

  await assert.rejects(
    pool.query(
      "UPDATE leave_requests SET status = 'exited' WHERE id = $1",
      [stateRequestId]
    ),
    (error) => postgresErrorCode(error) === "23514"
  );
  await assert.rejects(
    pool.query(
      "UPDATE leave_requests SET reason = 'Changed later' WHERE id = $1",
      [stateRequestId]
    ),
    (error) => postgresErrorCode(error) === "55000"
  );

  await pool.query(
    "UPDATE leave_requests SET status = 'approved', updated_at = '2026-09-10T09:00:00Z' WHERE id = $1",
    [stateRequestId]
  );
  await pool.query(
    "UPDATE leave_requests SET status = 'exited', updated_at = '2026-09-11T08:00:00Z' WHERE id = $1",
    [stateRequestId]
  );
  const returned = await pool.query(
    "UPDATE leave_requests SET status = 'returned', updated_at = '2026-09-12T17:00:00Z' WHERE id = $1 RETURNING status",
    [stateRequestId]
  );

  assert.equal(returned.rows[0].status, "returned");
  await assert.rejects(
    pool.query(
      "UPDATE leave_requests SET status = 'approved' WHERE id = $1",
      [stateRequestId]
    ),
    (error) => postgresErrorCode(error) === "23514"
  );
  await assert.rejects(
    pool.query("DELETE FROM leave_requests WHERE id = $1", [stateRequestId]),
    (error) => postgresErrorCode(error) === "55000"
  );
});

test("decisions, secure passes, and movement events preserve one auditable history", async () => {
  await pool.query(
    `INSERT INTO leave_decisions (
       leave_request_id, outcome, decided_by_user_id,
       actor_name, actor_role, note, decided_at
     )
     VALUES ($1, 'approved', $2, 'Leave Warden', 'warden',
       'Approved after reviewing the travel details.', '2026-09-10T09:00:00Z')`,
    [leaveRequestId, wardenId]
  );
  await assert.rejects(
    pool.query(
      `INSERT INTO leave_decisions (
         leave_request_id, outcome, decided_by_user_id,
         actor_name, actor_role, note, decided_at
       )
       VALUES ($1, 'rejected', $2, 'Leave Warden', 'warden',
         'A second decision must not be accepted.', '2026-09-10T09:01:00Z')`,
      [leaveRequestId, wardenId]
    ),
    (error) =>
      postgresErrorCode(error) === "23514" &&
      error.constraint === "leave_decisions_status_match_check"
  );

  await assert.rejects(
    pool.query(
      `INSERT INTO gate_passes (
         leave_request_id, token_hash, issued_by_user_id,
         issued_at, valid_from, expires_at
       ) VALUES ($1, repeat('b', 64), $2,
         '2026-09-10T09:00:00Z', '2026-09-11T08:00:00Z', '2026-09-12T18:00:00Z')`,
      [leaveRequestId, wardenId]
    ),
    (error) =>
      postgresErrorCode(error) === "23514" &&
      error.constraint === "gate_passes_artifacts_required_check"
  );
  await assert.rejects(
    pool.query(
      `INSERT INTO gate_passes (
         leave_request_id, token_hash, issued_by_user_id,
         issued_at, valid_from, expires_at, qr_storage_key, pdf_storage_key
       ) VALUES ($1, repeat('c', 64), $2,
         '2026-09-10T09:00:00Z', '2026-09-11T08:00:00Z', '2026-09-12T18:00:00Z',
         'gate-passes/forged/pass.png', 'gate-passes/forged/pass.pdf')`,
      [leaveRequestId, studentId]
    ),
    (error) => postgresErrorCode(error) === "42501"
  );

  const passResult = await pool.query(
    `INSERT INTO gate_passes (
       leave_request_id, token_hash, issued_by_user_id,
       issued_at, valid_from, expires_at, qr_storage_key, pdf_storage_key
     )
     VALUES ($1, repeat('a', 64), $2,
       '2026-09-10T09:00:00Z', '2026-09-11T08:00:00Z', '2026-09-12T18:00:00Z',
       'gate-passes/foundation/pass.png', 'gate-passes/foundation/pass.pdf')
     RETURNING id`,
    [leaveRequestId, wardenId]
  );
  gatePassId = passResult.rows[0].id;

  const eventResult = await pool.query(
    `INSERT INTO leave_events (
       leave_request_id, event_type, from_status, to_status,
       actor_user_id, actor_name, actor_role, occurred_at
     )
     VALUES ($1, 'submitted', null, 'pending', $2,
       'Leave Student', 'student', '2026-09-10T08:00:00Z')
     RETURNING id`,
    [leaveRequestId, studentId]
  );
  await assert.rejects(
    pool.query(
      "UPDATE leave_events SET actor_name = 'Changed' WHERE id = $1",
      [eventResult.rows[0].id]
    ),
    (error) => postgresErrorCode(error) === "55000"
  );

  await pool.query(
    `INSERT INTO gate_events (
       leave_request_id, gate_pass_id, movement, verification_method,
       performed_by_user_id, actor_name, actor_role, idempotency_key, occurred_at
     )
     VALUES ($1, $2, 'exit', 'qr', $3, 'Leave Guard', 'guard',
       'leave-exit-request-0001', '2026-09-11T08:00:00Z')`,
    [leaveRequestId, gatePassId, guardId]
  );

  await assert.rejects(
    pool.query(
      `INSERT INTO gate_events (
         leave_request_id, gate_pass_id, movement, verification_method,
         performed_by_user_id, actor_name, actor_role, idempotency_key, occurred_at
       )
       VALUES ($1, $2, 'exit', 'manual', $3, 'Leave Guard', 'guard',
         'leave-exit-request-0002', '2026-09-11T08:01:00Z')`,
      [leaveRequestId, gatePassId, guardId]
    ),
    (error) =>
      postgresErrorCode(error) === "23514" &&
      error.constraint === "gate_events_movement_state_check"
  );
});
