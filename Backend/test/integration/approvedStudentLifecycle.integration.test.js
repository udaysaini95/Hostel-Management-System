import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../src/db/schema.js";
import {
  approvedStudents,
  auditEventHostels,
  auditEvents,
  hostels,
  studentActivationTokens,
  users,
} from "../../src/db/schema.js";
import { ACCOUNT_STATUSES } from "../../src/domain/accountStatuses.js";
import { APPROVED_STUDENT_STATUSES } from "../../src/domain/approvedStudentStatuses.js";
import { AUDIT_ACTIONS } from "../../src/domain/auditEvents.js";
import { USER_ROLES } from "../../src/domain/roles.js";
import {
  reinstateApprovedStudent,
  reissueApprovedStudentActivation,
  revokeApprovedStudent,
  searchApprovedStudents,
} from "../../src/services/approvedStudentService.js";
import { hashSecureToken } from "../../src/services/secureTokenService.js";

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

let adminUser;
let firstHostel;
let secondHostel;
let firstApproval;
let secondApproval;
let otherHostelApproval;

before(async () => {
  [firstHostel, secondHostel] = await database
    .insert(hostels)
    .values([
      { code: "ON1", name: "Onboarding Test Hostel One" },
      { code: "ON2", name: "Onboarding Test Hostel Two" },
    ])
    .returning();

  [adminUser] = await database
    .insert(users)
    .values({
      name: "Onboarding Test Admin",
      email: "admin@onboarding.integration.test",
      password: "not-a-real-password-hash",
      role: USER_ROLES.ADMIN,
      accountStatus: ACCOUNT_STATUSES.ACTIVE,
      emailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
    })
    .returning();

  [firstApproval, secondApproval, otherHostelApproval] = await database
    .insert(approvedStudents)
    .values([
      {
        name: "Onboarding Student One",
        email: "student.one@onboarding.integration.test",
        rollNo: "ONB-001",
        hostelId: firstHostel.id,
        approvedByUserId: adminUser.id,
        approvedAt: new Date("2026-09-01T09:00:00.000Z"),
      },
      {
        name: "Onboarding Student Two",
        email: "student.two@onboarding.integration.test",
        rollNo: "ONB-002",
        hostelId: firstHostel.id,
        approvedByUserId: adminUser.id,
        approvedAt: new Date("2026-09-02T09:00:00.000Z"),
      },
      {
        name: "Onboarding Student Other Hostel",
        email: "student.other@onboarding.integration.test",
        rollNo: "ONB-003",
        hostelId: secondHostel.id,
        approvedByUserId: adminUser.id,
        approvedAt: new Date("2026-09-03T09:00:00.000Z"),
      },
    ])
    .returning();
});

after(async () => {
  await pool.end();
});

test("approved-student management is paginated and hostel scoped", async () => {
  const firstPage = await searchApprovedStudents(
    database,
    {
      page: 1,
      pageSize: 1,
      search: "onboarding student",
      hostelCode: firstHostel.code,
      status: APPROVED_STUDENT_STATUSES.APPROVED,
    },
    { now: new Date("2026-09-05T12:00:00.000Z") }
  );
  const secondPage = await searchApprovedStudents(
    database,
    {
      page: 2,
      pageSize: 1,
      search: "onboarding student",
      hostelCode: firstHostel.code,
      status: APPROVED_STUDENT_STATUSES.APPROVED,
    },
    { now: new Date("2026-09-05T12:00:00.000Z") }
  );

  assert.deepEqual(firstPage.pagination, {
    page: 1,
    pageSize: 1,
    total: 2,
    totalPages: 2,
  });
  assert.equal(firstPage.data.length, 1);
  assert.equal(secondPage.data.length, 1);
  assert.notEqual(firstPage.data[0].id, secondPage.data[0].id);
  assert.equal(firstPage.data[0].hostel.code, "ON1");
  assert.equal(secondPage.data[0].hostel.code, "ON1");
  assert.notEqual(firstPage.data[0].id, otherHostelApproval.id);
  assert.notEqual(secondPage.data[0].id, otherHostelApproval.id);
});

test("activation reissue replaces links without exposing token data in records", async () => {
  const now = new Date("2026-09-05T12:00:00.000Z");
  const rawToken = "A".repeat(43);
  const result = await reissueApprovedStudentActivation(
    database,
    firstApproval.id,
    adminUser.id,
    { now, token: rawToken }
  );
  const [storedToken] = await database
    .select()
    .from(studentActivationTokens)
    .where(
      and(
        eq(studentActivationTokens.approvedStudentId, firstApproval.id),
        eq(studentActivationTokens.tokenHash, hashSecureToken(rawToken))
      )
    );
  const [auditEvent] = await database
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.action, AUDIT_ACTIONS.STUDENT_ACTIVATION_REISSUED));
  const [auditHostel] = await database
    .select()
    .from(auditEventHostels)
    .where(eq(auditEventHostels.auditEventId, auditEvent.id));

  assert.equal(result.approval.status, APPROVED_STUDENT_STATUSES.ACTIVATION_PENDING);
  assert.equal(Object.hasOwn(result.approval, "token"), false);
  assert.equal(Object.hasOwn(result.approval, "tokenHash"), false);
  assert.equal(result.delivery.token, rawToken);
  assert.equal(storedToken.tokenHash, hashSecureToken(rawToken));
  assert.notEqual(storedToken.tokenHash, rawToken);
  assert.equal(auditEvent.resourceId, String(firstApproval.id));
  assert.equal(auditHostel.hostelId, firstHostel.id);

  const expiredResult = await searchApprovedStudents(
    database,
    {
      status: APPROVED_STUDENT_STATUSES.ACTIVATION_EXPIRED,
      hostelCode: firstHostel.code,
    },
    { now: new Date(result.delivery.expiresAt.getTime() + 1) }
  );

  assert.equal(expiredResult.pagination.total, 1);
  assert.equal(expiredResult.data[0].id, firstApproval.id);
});

test("revocation invalidates activation and records its reason", async () => {
  const now = new Date("2026-09-05T12:10:00.000Z");
  const reason = "Student admission was withdrawn";
  const result = await revokeApprovedStudent(
    database,
    firstApproval.id,
    { reason },
    adminUser.id,
    { now }
  );
  const [storedToken] = await database
    .select()
    .from(studentActivationTokens)
    .where(eq(studentActivationTokens.approvedStudentId, firstApproval.id));
  const [auditEvent] = await database
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.action, AUDIT_ACTIONS.STUDENT_APPROVAL_REVOKED));

  assert.equal(result.approval.status, APPROVED_STUDENT_STATUSES.REVOKED);
  assert.deepEqual(storedToken.revokedAt, now);
  assert.equal(auditEvent.metadata.reason, reason);
  assert.equal(
    auditEvent.metadata.previousStatus,
    APPROVED_STUDENT_STATUSES.ACTIVATION_PENDING
  );

  await assert.rejects(
    revokeApprovedStudent(
      database,
      firstApproval.id,
      { reason },
      adminUser.id,
      { now }
    ),
    (error) => error.code === "STUDENT_APPROVAL_ALREADY_REVOKED"
  );
  await assert.rejects(
    reissueApprovedStudentActivation(
      database,
      firstApproval.id,
      adminUser.id,
      { now, token: "B".repeat(43) }
    ),
    (error) => error.code === "STUDENT_APPROVAL_REVOKED"
  );

  const reinstatedAt = new Date("2026-09-05T12:15:00.000Z");
  const reinstatement = await reinstateApprovedStudent(
    database,
    firstApproval.id,
    { reason: "Student admission was restored" },
    adminUser.id,
    { now: reinstatedAt }
  );
  const [reinstatementAudit] = await database
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.action, AUDIT_ACTIONS.STUDENT_APPROVAL_REINSTATED));

  assert.equal(
    reinstatement.approval.status,
    APPROVED_STUDENT_STATUSES.APPROVED
  );
  assert.equal(reinstatementAudit.resourceId, String(firstApproval.id));
  assert.equal(
    reinstatementAudit.metadata.reason,
    "Student admission was restored"
  );
});

test("activated approvals cannot be revoked or reissued", async () => {
  const now = new Date("2026-09-05T13:00:00.000Z");
  const [studentUser] = await database
    .insert(users)
    .values({
      name: secondApproval.name,
      email: secondApproval.email,
      password: "not-a-real-password-hash",
      role: USER_ROLES.STUDENT,
      accountStatus: ACCOUNT_STATUSES.ACTIVE,
      emailVerifiedAt: now,
      rollNo: secondApproval.rollNo,
    })
    .returning();

  await database
    .update(approvedStudents)
    .set({
      activatedUserId: studentUser.id,
      activatedAt: now,
      updatedAt: now,
    })
    .where(eq(approvedStudents.id, secondApproval.id));

  await assert.rejects(
    revokeApprovedStudent(
      database,
      secondApproval.id,
      { reason: "Account already exists" },
      adminUser.id,
      { now }
    ),
    (error) => error.code === "STUDENT_ALREADY_ACTIVATED"
  );
  await assert.rejects(
    reissueApprovedStudentActivation(
      database,
      secondApproval.id,
      adminUser.id,
      { now, token: "C".repeat(43) }
    ),
    (error) => error.code === "STUDENT_ALREADY_ACTIVATED"
  );

  const activated = await searchApprovedStudents(
    database,
    {
      status: APPROVED_STUDENT_STATUSES.ACTIVATED,
      hostelCode: firstHostel.code,
    },
    { now }
  );

  assert.equal(activated.pagination.total, 1);
  assert.equal(activated.data[0].id, secondApproval.id);
});
