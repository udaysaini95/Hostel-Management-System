import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../src/db/schema.js";
import {
  auditEventHostels,
  hostels,
  users,
} from "../../src/db/schema.js";
import {
  appendAuditEvent,
  searchAuditEvents,
} from "../../src/services/auditEventService.js";
import {
  AUDIT_ACTIONS,
  AUDIT_CATEGORIES,
  AUDIT_RESOURCE_TYPES,
} from "../../src/domain/auditEvents.js";
import { ACCOUNT_STATUSES } from "../../src/domain/accountStatuses.js";
import { USER_ROLES } from "../../src/domain/roles.js";

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
const postgresErrorCode = (error) => error.code ?? error.cause?.code;

let adminUser;
let firstHostel;
let secondHostel;

before(async () => {
  [firstHostel, secondHostel] = await database
    .insert(hostels)
    .values([
      { code: "H1", name: "Hostel One" },
      { code: "H2", name: "Hostel Two" },
    ])
    .returning();

  [adminUser] = await database
    .insert(users)
    .values({
      name: "Integration Test Admin",
      email: "admin@integration.test",
      password: "not-a-real-password-hash",
      role: USER_ROLES.ADMIN,
      accountStatus: ACCOUNT_STATUSES.ACTIVE,
      emailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
    })
    .returning();
});

after(async () => {
  await pool.end();
});

test("all versioned migrations apply to an empty PostgreSQL database", async () => {
  const tablesResult = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'users',
        'hostels',
        'hostel_memberships',
        'student_profiles',
        'staff_profiles',
        'hostel_blocks',
        'rooms',
        'room_allocations',
        'approved_students',
        'audit_events'
      )
    ORDER BY table_name
  `);
  const migrationsResult = await pool.query(`
    SELECT count(*)::integer AS count
    FROM drizzle.__drizzle_migrations
  `);

  assert.deepEqual(
    tablesResult.rows.map((row) => row.table_name),
    [
      "approved_students",
      "audit_events",
      "hostel_blocks",
      "hostel_memberships",
      "hostels",
      "room_allocations",
      "rooms",
      "staff_profiles",
      "student_profiles",
      "users",
    ]
  );
  assert.equal(migrationsResult.rows[0].count, 6);
});

test("PostgreSQL enforces hostel and primary-membership constraints", async () => {
  await assert.rejects(
    pool.query(
      "INSERT INTO hostels (code, name) VALUES ($1, $2)",
      ["invalid code", "Invalid Hostel"]
    ),
    (error) =>
      postgresErrorCode(error) === "23514" &&
      error.constraint === "hostels_code_format_check"
  );

  const userResult = await pool.query(
    `
      INSERT INTO users (name, email, password, role, account_status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `,
    [
      "Hostel Warden",
      "warden@integration.test",
      "not-a-real-password-hash",
      USER_ROLES.WARDEN,
      ACCOUNT_STATUSES.ACTIVE,
    ]
  );
  const wardenId = userResult.rows[0].id;

  await pool.query(
    `
      INSERT INTO hostel_memberships (user_id, hostel_id, is_primary)
      VALUES ($1, $2, true)
    `,
    [wardenId, firstHostel.id]
  );

  await assert.rejects(
    pool.query(
      `
        INSERT INTO hostel_memberships (user_id, hostel_id, is_primary)
        VALUES ($1, $2, true)
      `,
      [wardenId, secondHostel.id]
    ),
    (error) =>
      postgresErrorCode(error) === "23505" &&
      error.constraint === "hostel_memberships_one_primary_per_user"
  );
});

test("PostgreSQL enforces profile, room, and allocation-history constraints", async () => {
  const firstStudentResult = await pool.query(
    `
      INSERT INTO users (name, email, password, role, account_status, roll_no)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `,
    [
      "First Resident",
      "resident.one@integration.test",
      "not-a-real-password-hash",
      USER_ROLES.STUDENT,
      ACCOUNT_STATUSES.ACTIVE,
      "INT-RES-001",
    ]
  );
  const secondStudentResult = await pool.query(
    `
      INSERT INTO users (name, email, password, role, account_status, roll_no)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `,
    [
      "Second Resident",
      "resident.two@integration.test",
      "not-a-real-password-hash",
      USER_ROLES.STUDENT,
      ACCOUNT_STATUSES.ACTIVE,
      "INT-RES-002",
    ]
  );
  const firstStudentId = firstStudentResult.rows[0].id;
  const secondStudentId = secondStudentResult.rows[0].id;

  await pool.query(
    `
      INSERT INTO hostel_memberships (user_id, hostel_id, is_primary)
      VALUES ($1, $2, true), ($3, $2, true)
    `,
    [firstStudentId, firstHostel.id, secondStudentId]
  );

  const firstProfileResult = await pool.query(
    `
      INSERT INTO student_profiles (user_id, hostel_id, roll_no)
      VALUES ($1, $2, $3)
      RETURNING id
    `,
    [firstStudentId, firstHostel.id, "INT-RES-001"]
  );
  const firstProfileId = firstProfileResult.rows[0].id;

  await assert.rejects(
    pool.query(
      `
        INSERT INTO student_profiles (user_id, hostel_id, roll_no)
        VALUES ($1, $2, $3)
      `,
      [secondStudentId, firstHostel.id, "INT-RES-001"]
    ),
    (error) =>
      postgresErrorCode(error) === "23505" &&
      error.constraint === "student_profiles_roll_no_unique"
  );

  await assert.rejects(
    pool.query(
      `
        INSERT INTO student_profiles (user_id, hostel_id, roll_no)
        VALUES ($1, $2, $3)
      `,
      [secondStudentId, secondHostel.id, "INT-RES-002"]
    ),
    (error) =>
      postgresErrorCode(error) === "23503" &&
      error.constraint === "student_profiles_membership_fk"
  );

  await assert.rejects(
    pool.query(
      `
        INSERT INTO student_profiles (user_id, hostel_id, roll_no)
        VALUES ($1, $2, $3)
      `,
      [adminUser.id, firstHostel.id, "INT-ADMIN-001"]
    ),
    (error) =>
      postgresErrorCode(error) === "23514" &&
      error.message.includes("student account")
  );

  const firstBlockResult = await pool.query(
    `
      INSERT INTO hostel_blocks (hostel_id, code, name)
      VALUES ($1, $2, $3)
      RETURNING id
    `,
    [firstHostel.id, "A", "Hostel One - A Block"]
  );
  const secondBlockResult = await pool.query(
    `
      INSERT INTO hostel_blocks (hostel_id, code, name)
      VALUES ($1, $2, $3)
      RETURNING id
    `,
    [secondHostel.id, "A", "Hostel Two - A Block"]
  );
  const firstBlockId = firstBlockResult.rows[0].id;
  const secondBlockId = secondBlockResult.rows[0].id;

  await assert.rejects(
    pool.query(
      "INSERT INTO hostel_blocks (hostel_id, code, name) VALUES ($1, $2, $3)",
      [firstHostel.id, "A", "Duplicate A Block"]
    ),
    (error) =>
      postgresErrorCode(error) === "23505" &&
      error.constraint === "hostel_blocks_hostel_code_unique"
  );

  const firstRoomResult = await pool.query(
    `
      INSERT INTO rooms (block_id, room_number, floor, capacity)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `,
    [firstBlockId, "101", 1, 2]
  );
  await pool.query(
    `
      INSERT INTO rooms (block_id, room_number, floor, capacity)
      VALUES ($1, $2, $3, $4)
    `,
    [secondBlockId, "101", 1, 2]
  );

  await assert.rejects(
    pool.query(
      "INSERT INTO rooms (block_id, room_number, floor, capacity) VALUES ($1, $2, $3, $4)",
      [firstBlockId, "101", 1, 2]
    ),
    (error) =>
      postgresErrorCode(error) === "23505" &&
      error.constraint === "rooms_block_number_unique"
  );
  await assert.rejects(
    pool.query(
      "INSERT INTO rooms (block_id, room_number, floor, capacity) VALUES ($1, $2, $3, $4)",
      [firstBlockId, "999", 9, 0]
    ),
    (error) =>
      postgresErrorCode(error) === "23514" &&
      error.constraint === "rooms_capacity_bounds_check"
  );

  const secondRoomResult = await pool.query(
    `
      INSERT INTO rooms (block_id, room_number, floor, capacity)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `,
    [firstBlockId, "102", 1, 2]
  );
  const firstRoomId = firstRoomResult.rows[0].id;
  const secondRoomId = secondRoomResult.rows[0].id;
  const firstAllocationResult = await pool.query(
    `
      INSERT INTO room_allocations
        (student_profile_id, room_id, allocated_by_user_id, allocated_at)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `,
    [
      firstProfileId,
      firstRoomId,
      adminUser.id,
      new Date("2026-08-01T09:00:00.000Z"),
    ]
  );

  await assert.rejects(
    pool.query(
      `
        INSERT INTO room_allocations
          (student_profile_id, room_id, allocated_by_user_id, allocated_at)
        VALUES ($1, $2, $3, $4)
      `,
      [
        firstProfileId,
        secondRoomId,
        adminUser.id,
        new Date("2026-08-02T09:00:00.000Z"),
      ]
    ),
    (error) =>
      postgresErrorCode(error) === "23505" &&
      error.constraint === "room_allocations_one_active_per_student"
  );

  await pool.query(
    `
      UPDATE room_allocations
      SET vacated_at = $1, vacated_by_user_id = $2, vacate_reason = $3
      WHERE id = $4
    `,
    [
      new Date("2026-08-15T09:00:00.000Z"),
      adminUser.id,
      "Moved to a quieter room",
      firstAllocationResult.rows[0].id,
    ]
  );
  await pool.query(
    `
      INSERT INTO room_allocations
        (student_profile_id, room_id, allocated_by_user_id, allocated_at)
      VALUES ($1, $2, $3, $4)
    `,
    [
      firstProfileId,
      secondRoomId,
      adminUser.id,
      new Date("2026-08-15T09:01:00.000Z"),
    ]
  );

  const historyResult = await pool.query(
    `
      SELECT count(*)::integer AS total,
             count(*) FILTER (WHERE vacated_at IS NULL)::integer AS active
      FROM room_allocations
      WHERE student_profile_id = $1
    `,
    [firstProfileId]
  );

  assert.deepEqual(historyResult.rows[0], { total: 2, active: 1 });
});

test("a failed transaction leaves none of its earlier writes behind", async () => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO hostels (code, name) VALUES ($1, $2)",
      ["TX1", "Transaction Test Hostel"]
    );
    await assert.rejects(
      client.query(
        "INSERT INTO hostels (code, name) VALUES ($1, $2)",
        ["not valid", "Constraint Failure"]
      ),
      (error) => postgresErrorCode(error) === "23514"
    );
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }

  const result = await pool.query(
    "SELECT count(*)::integer AS count FROM hostels WHERE code = $1",
    ["TX1"]
  );

  assert.equal(result.rows[0].count, 0);
});

test("audit events can be searched but cannot be changed or deleted", async () => {
  const event = await appendAuditEvent(database, {
    actor: adminUser,
    category: AUDIT_CATEGORIES.STUDENT,
    action: AUDIT_ACTIONS.STUDENT_APPROVAL_CREATED,
    resourceType: AUDIT_RESOURCE_TYPES.APPROVED_STUDENT,
    resourceId: "42",
    description: "Approved a student during an integration test",
    metadata: { source: "integration-test" },
    assignedHostels: [firstHostel],
  });
  const result = await searchAuditEvents(
    database,
    { id: adminUser.id, role: USER_ROLES.ADMIN },
    {
      page: 1,
      pageSize: 10,
      action: AUDIT_ACTIONS.STUDENT_APPROVAL_CREATED,
    }
  );

  assert.equal(result.pagination.total, 1);
  assert.equal(result.data[0].id, event.id);
  assert.deepEqual(result.data[0].hostels, [
    { id: firstHostel.id, code: "H1" },
  ]);

  await assert.rejects(
    pool.query(
      "UPDATE audit_events SET description = $1 WHERE id = $2",
      ["Changed description", event.id]
    ),
    (error) => postgresErrorCode(error) === "55000"
  );
  await assert.rejects(
    database
      .delete(auditEventHostels)
      .where(eq(auditEventHostels.auditEventId, event.id)),
    (error) => postgresErrorCode(error) === "55000"
  );
});
