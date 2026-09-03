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
      "hostel_memberships",
      "hostels",
      "users",
    ]
  );
  assert.equal(migrationsResult.rows[0].count, 5);
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
