import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../src/db/schema.js";
import {
  hostelBlocks,
  hostelMemberships,
  hostels,
  roomAllocations,
  rooms,
  studentProfiles,
  users,
} from "../../src/db/schema.js";
import { ACCOUNT_STATUSES } from "../../src/domain/accountStatuses.js";
import { AUDIT_ACTIONS } from "../../src/domain/auditEvents.js";
import { LEAVE_STATUSES } from "../../src/domain/leaveWorkflow.js";
import { USER_ROLES } from "../../src/domain/roles.js";
import {
  getGatePass,
  readGatePassArtifact,
} from "../../src/services/gatePassService.js";
import { verifySecureGatePass } from "../../src/services/gatePassVerificationService.js";
import { recordGateMovement } from "../../src/services/gateMovementService.js";
import { decideLeaveRequest } from "../../src/services/leaveDecisionService.js";
import { createLeaveRequest } from "../../src/services/leaveRequestService.js";
import { listLeaveRequestsForReview } from "../../src/services/leaveReviewService.js";

const { Pool } = pg;

if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    "Integration tests must be started through npm test or npm run test:integration."
  );
}

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 6 });
const database = drizzle(pool, { schema });

let administrator;
let firstWarden;
let secondWarden;
let suspendedWarden;
let firstGuard;
let secondGuard;
let students;
let pendingLeaves;

const firstGatePassToken = "A".repeat(43);
const secondGatePassToken = "B".repeat(43);

const gatePassFiles = new Map();
const gatePassStorage = {
  async write(key, contents) {
    if (gatePassFiles.has(key)) {
      throw new Error("File already exists");
    }
    gatePassFiles.set(key, Buffer.from(contents));
  },
  async read(key) {
    const contents = gatePassFiles.get(key);
    if (!contents) throw new Error("File not found");
    return contents;
  },
  async remove(key) {
    gatePassFiles.delete(key);
  },
};

const decisionOptions = (now, gatePassOverrides = {}) => ({
  now,
  gatePassOptions: { storage: gatePassStorage, ...gatePassOverrides },
});

before(async () => {
  const [firstHostel, secondHostel] = await database
    .insert(hostels)
    .values([
      { code: "LD1", name: "Leave Decision Hostel One" },
      { code: "LD2", name: "Leave Decision Hostel Two" },
    ])
    .returning();

  [
    administrator,
    firstWarden,
    secondWarden,
    suspendedWarden,
    firstGuard,
    secondGuard,
  ] = await database
    .insert(users)
    .values([
      {
        name: "Leave Decision Administrator",
        email: "admin@leave-decision.integration.test",
        password: "test-hash",
        role: USER_ROLES.ADMIN,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
      },
      {
        name: "Leave Decision Warden One",
        email: "warden-one@leave-decision.integration.test",
        password: "test-hash",
        role: USER_ROLES.WARDEN,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
      },
      {
        name: "Leave Decision Warden Two",
        email: "warden-two@leave-decision.integration.test",
        password: "test-hash",
        role: USER_ROLES.WARDEN,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
      },
      {
        name: "Suspended Leave Warden",
        email: "suspended@leave-decision.integration.test",
        password: "test-hash",
        role: USER_ROLES.WARDEN,
        accountStatus: ACCOUNT_STATUSES.SUSPENDED,
      },
      {
        name: "Leave Gate Guard One",
        email: "guard-one@leave-decision.integration.test",
        password: "test-hash",
        role: USER_ROLES.GUARD,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
      },
      {
        name: "Leave Gate Guard Two",
        email: "guard-two@leave-decision.integration.test",
        password: "test-hash",
        role: USER_ROLES.GUARD,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
      },
    ])
    .returning();

  students = await database
    .insert(users)
    .values(
      [1, 2, 3, 4, 5].map((number) => ({
        name: `Leave Decision Student ${number}`,
        email: `student-${number}@leave-decision.integration.test`,
        password: "test-hash",
        role: USER_ROLES.STUDENT,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
        rollNo: `LD-${String(number).padStart(3, "0")}`,
      }))
    )
    .returning();

  await database.insert(hostelMemberships).values([
    { userId: firstWarden.id, hostelId: firstHostel.id, isPrimary: true },
    { userId: secondWarden.id, hostelId: secondHostel.id, isPrimary: true },
    { userId: suspendedWarden.id, hostelId: firstHostel.id, isPrimary: true },
    { userId: firstGuard.id, hostelId: firstHostel.id, isPrimary: true },
    { userId: secondGuard.id, hostelId: secondHostel.id, isPrimary: true },
    ...students.map((student) => ({
      userId: student.id,
      hostelId: firstHostel.id,
      isPrimary: true,
    })),
  ]);

  const profiles = await database
    .insert(studentProfiles)
    .values(
      students.map((student) => ({
        userId: student.id,
        hostelId: firstHostel.id,
        rollNo: student.rollNo,
      }))
    )
    .returning();
  const [block] = await database
    .insert(hostelBlocks)
    .values({ hostelId: firstHostel.id, code: "A", name: "Decision Block A" })
    .returning();
  const [room] = await database
    .insert(rooms)
    .values({ blockId: block.id, roomNumber: "201", floor: 2, capacity: 5 })
    .returning();

  await database.insert(roomAllocations).values(
    profiles.map((profile) => ({
      studentProfileId: profile.id,
      roomId: room.id,
      allocatedByUserId: administrator.id,
      allocatedAt: new Date("2026-09-01T08:00:00.000Z"),
      createdAt: new Date("2026-09-01T08:00:00.000Z"),
    }))
  );

  pendingLeaves = await Promise.all(
    students.map((student, index) =>
      createLeaveRequest(
        database,
        { id: student.id, role: USER_ROLES.STUDENT },
        {
          reason: `Verified leave request number ${index + 1}`,
          departureAt: `2026-11-${String(index + 10).padStart(2, "0")}T08:00:00Z`,
          expectedReturnAt: `2026-11-${String(index + 11).padStart(2, "0")}T18:00:00Z`,
          isEmergency: index === 1,
        },
        { now: new Date("2026-10-01T08:00:00.000Z") }
      )
    )
  );
});

after(async () => {
  await pool.end();
});

test("leave review queue is pending by default and respects hostel scope", async () => {
  const wardenQueue = await listLeaveRequestsForReview(
    database,
    { id: firstWarden.id, role: USER_ROLES.WARDEN }
  );
  const otherHostelQueue = await listLeaveRequestsForReview(
    database,
    { id: secondWarden.id, role: USER_ROLES.WARDEN }
  );
  const searchResult = await listLeaveRequestsForReview(
    database,
    { id: administrator.id, role: USER_ROLES.ADMIN },
    { status: "all", search: "LD-002" }
  );

  assert.equal(wardenQueue.pagination.total, 5);
  assert.equal(wardenQueue.data[0].isEmergency, true);
  assert.equal(wardenQueue.data.every((leave) => leave.status === "pending"), true);
  assert.equal(wardenQueue.data[0].room.label, "A-201");
  assert.deepEqual(wardenQueue.data[0].reviewWarnings.activeRequests, []);
  assert.equal(otherHostelQueue.pagination.total, 0);
  assert.equal(searchResult.pagination.total, 1);
  assert.equal(searchResult.data[0].student.rollNo, "LD-002");

  await assert.rejects(
    listLeaveRequestsForReview(
      database,
      { id: suspendedWarden.id, role: USER_ROLES.WARDEN }
    ),
    (error) =>
      error.statusCode === 403 && error.code === "STAFF_ACCOUNT_INACTIVE"
  );
  await assert.rejects(
    listLeaveRequestsForReview(
      database,
      { id: students[0].id, role: USER_ROLES.STUDENT }
    ),
    (error) =>
      error.statusCode === 403 && error.code === "LEAVE_REVIEW_DENIED"
  );
});

test("warden approval records one decision, status, timeline, and audit event", async () => {
  const result = await decideLeaveRequest(
    database,
    { id: firstWarden.id, role: USER_ROLES.WARDEN },
    pendingLeaves[0].id,
    { outcome: "approved", note: "Student identity and travel dates verified" },
    decisionOptions(new Date("2026-10-02T08:00:00.000Z"), {
      createToken: () => firstGatePassToken,
    })
  );

  assert.equal(result.leaveRequest.status, LEAVE_STATUSES.APPROVED);
  assert.equal(result.decision.outcome, "approved");
  assert.equal(result.decision.actor.userId, firstWarden.id);
  assert.equal(result.decision.note, "Student identity and travel dates verified");
  assert.equal(result.gatePass.leaveRequestId, pendingLeaves[0].id);
  assert.match(result.gatePass.qrUrl, /\/pass\/qr$/);
  assert.match(result.gatePass.pdfUrl, /\/pass\/pdf$/);

  const [timeline, audit, pass, notification] = await Promise.all([
    pool.query(
      "SELECT event_type, from_status, to_status, note FROM leave_events WHERE leave_request_id = $1 ORDER BY id",
      [pendingLeaves[0].id]
    ),
    pool.query(
      "SELECT action FROM audit_events WHERE resource_type = 'leave_request' AND resource_id = $1 ORDER BY id",
      [String(pendingLeaves[0].id)]
    ),
    pool.query(
      `SELECT token_hash, qr_storage_key, pdf_storage_key
       FROM gate_passes WHERE leave_request_id = $1`,
      [pendingLeaves[0].id]
    ),
    pool.query(
      `SELECT recipient_user_id, link_path
       FROM notifications
       WHERE event_type = 'leave_decided' AND resource_id = $1`,
      [pendingLeaves[0].id]
    ),
  ]);

  assert.deepEqual(
    timeline.rows.map((event) => event.event_type),
    ["submitted", "approved", "pass_issued"]
  );
  assert.deepEqual(timeline.rows[1], {
    event_type: "approved",
    from_status: "pending",
    to_status: "approved",
    note: "Student identity and travel dates verified",
  });
  assert.equal(audit.rows.at(-1).action, AUDIT_ACTIONS.LEAVE_REQUEST_APPROVED);
  assert.match(pass.rows[0].token_hash, /^[a-f0-9]{64}$/);
  assert.equal(gatePassFiles.has(pass.rows[0].qr_storage_key), true);
  assert.equal(gatePassFiles.has(pass.rows[0].pdf_storage_key), true);
  assert.equal(JSON.stringify(result).includes(pass.rows[0].token_hash), false);
  assert.deepEqual(notification.rows, [{
    recipient_user_id: students[0].id,
    link_path: "/student/leaves",
  }]);
});

test("pass metadata and files follow ownership and hostel scope", async () => {
  const ownPass = await getGatePass(
    database,
    { id: students[0].id, role: USER_ROLES.STUDENT },
    pendingLeaves[0].id,
    { now: new Date("2026-11-10T10:00:00.000Z") }
  );
  const wardenPass = await getGatePass(
    database,
    { id: firstWarden.id, role: USER_ROLES.WARDEN },
    pendingLeaves[0].id
  );
  const adminPass = await getGatePass(
    database,
    { id: administrator.id, role: USER_ROLES.ADMIN },
    pendingLeaves[0].id
  );
  const qr = await readGatePassArtifact(
    database,
    { id: students[0].id, role: USER_ROLES.STUDENT },
    pendingLeaves[0].id,
    "qr",
    { storage: gatePassStorage }
  );
  const pdf = await readGatePassArtifact(
    database,
    { id: firstWarden.id, role: USER_ROLES.WARDEN },
    pendingLeaves[0].id,
    "pdf",
    { storage: gatePassStorage }
  );

  assert.equal(ownPass.usable, true);
  assert.equal(wardenPass.id, ownPass.id);
  assert.equal(adminPass.id, ownPass.id);
  assert.deepEqual([...qr.contents.subarray(0, 4)], [137, 80, 78, 71]);
  assert.equal(pdf.contents.subarray(0, 4).toString(), "%PDF");

  for (const actor of [
    { id: students[1].id, role: USER_ROLES.STUDENT },
    { id: secondWarden.id, role: USER_ROLES.WARDEN },
  ]) {
    await assert.rejects(
      getGatePass(database, actor, pendingLeaves[0].id),
      (error) => error.statusCode === 404 && error.code === "GATE_PASS_NOT_FOUND"
    );
  }
});

test("authoritative verification returns one server-owned gate action", async () => {
  const qrResult = await verifySecureGatePass(
    database,
    { id: firstGuard.id, role: USER_ROLES.GUARD },
    `hostelmate://gate-pass/${firstGatePassToken}`,
    { now: new Date("2026-11-10T10:00:00.000Z") }
  );
  const manualResult = await verifySecureGatePass(
    database,
    { id: administrator.id, role: USER_ROLES.ADMIN },
    firstGatePassToken,
    { now: new Date("2026-11-10T10:00:00.000Z") }
  );

  assert.equal(qrResult.valid, true);
  assert.equal(qrResult.verificationMethod, "qr");
  assert.equal(qrResult.permittedAction, "exit");
  assert.equal(manualResult.permittedAction, "exit");
  assert.deepEqual(Object.keys(qrResult.details.student).sort(), [
    "name",
    "rollNo",
    "room",
  ]);
  assert.equal(JSON.stringify(qrResult).includes(firstGatePassToken), false);
  assert.equal(JSON.stringify(qrResult).includes("tokenHash"), false);

  const tooEarly = await verifySecureGatePass(
    database,
    { id: firstGuard.id, role: USER_ROLES.GUARD },
    firstGatePassToken,
    { now: new Date("2026-11-10T07:59:59.000Z") }
  );
  const expired = await verifySecureGatePass(
    database,
    { id: firstGuard.id, role: USER_ROLES.GUARD },
    firstGatePassToken,
    { now: new Date("2026-11-11T18:00:00.000Z") }
  );
  const outOfScope = await verifySecureGatePass(
    database,
    { id: secondGuard.id, role: USER_ROLES.GUARD },
    firstGatePassToken,
    { now: new Date("2026-11-10T10:00:00.000Z") }
  );

  assert.equal(tooEarly.code, "PASS_NOT_YET_VALID");
  assert.equal(expired.code, "PASS_EXPIRED");
  assert.equal(outOfScope.code, "PASS_NOT_FOUND");
  assert.equal(outOfScope.details, null);

  await assert.rejects(
    verifySecureGatePass(
      database,
      { id: firstWarden.id, role: USER_ROLES.WARDEN },
      firstGatePassToken
    ),
    (error) =>
      error.statusCode === 403 && error.code === "GATE_VERIFICATION_DENIED"
  );

  await pool.query(
    "UPDATE leave_requests SET status = 'exited' WHERE id = $1",
    [pendingLeaves[0].id]
  );
  const exited = await verifySecureGatePass(
    database,
    { id: firstGuard.id, role: USER_ROLES.GUARD },
    firstGatePassToken,
    { now: new Date("2026-11-10T10:00:00.000Z") }
  );
  assert.equal(exited.permittedAction, "return");

  await pool.query(
    "UPDATE leave_requests SET status = 'returned' WHERE id = $1",
    [pendingLeaves[0].id]
  );
  const returned = await verifySecureGatePass(
    database,
    { id: firstGuard.id, role: USER_ROLES.GUARD },
    firstGatePassToken,
    { now: new Date("2026-11-10T10:00:00.000Z") }
  );
  assert.equal(returned.code, "LEAVE_COMPLETED");
  assert.equal(returned.permittedAction, null);
});

test("administrator can reject a request with an auditable note", async () => {
  const result = await decideLeaveRequest(
    database,
    { id: administrator.id, role: USER_ROLES.ADMIN },
    pendingLeaves[1].id,
    { outcome: "rejected", note: "Travel dates conflict with hostel records" },
    decisionOptions(new Date("2026-10-02T09:00:00.000Z"))
  );

  assert.equal(result.leaveRequest.status, LEAVE_STATUSES.REJECTED);
  assert.equal(result.decision.actor.userId, administrator.id);
  assert.equal(result.gatePass, null);

  const audit = await pool.query(
    "SELECT action FROM audit_events WHERE resource_type = 'leave_request' AND resource_id = $1 ORDER BY id",
    [String(pendingLeaves[1].id)]
  );
  assert.equal(audit.rows.at(-1).action, AUDIT_ACTIONS.LEAVE_REQUEST_REJECTED);
});

test("hostel scope and current staff state are enforced", async () => {
  const input = { outcome: "approved", note: "All submitted details verified" };
  const options = decisionOptions(new Date("2026-10-02T10:00:00.000Z"));

  await assert.rejects(
    decideLeaveRequest(
      database,
      { id: secondWarden.id, role: USER_ROLES.WARDEN },
      pendingLeaves[2].id,
      input,
      options
    ),
    (error) => error.statusCode === 404 && error.code === "LEAVE_REQUEST_NOT_FOUND"
  );
  await assert.rejects(
    decideLeaveRequest(
      database,
      { id: suspendedWarden.id, role: USER_ROLES.WARDEN },
      pendingLeaves[2].id,
      input,
      options
    ),
    (error) => error.statusCode === 403 && error.code === "STAFF_ACCOUNT_INACTIVE"
  );
  await assert.rejects(
    decideLeaveRequest(
      database,
      { id: students[2].id, role: USER_ROLES.STUDENT },
      pendingLeaves[2].id,
      input,
      options
    ),
    (error) => error.statusCode === 403 && error.code === "LEAVE_DECISION_DENIED"
  );
});

test("simultaneous decisions produce exactly one immutable outcome", async () => {
  const decidedAt = new Date("2026-10-02T11:00:00.000Z");
  const results = await Promise.allSettled([
    decideLeaveRequest(
      database,
      { id: firstWarden.id, role: USER_ROLES.WARDEN },
      pendingLeaves[2].id,
      { outcome: "approved", note: "Warden verified this leave request" },
      decisionOptions(decidedAt)
    ),
    decideLeaveRequest(
      database,
      { id: administrator.id, role: USER_ROLES.ADMIN },
      pendingLeaves[2].id,
      { outcome: "rejected", note: "Administrator rejected this leave request" },
      decisionOptions(decidedAt)
    ),
  ]);
  const fulfilled = results.filter((result) => result.status === "fulfilled");
  const rejected = results.filter((result) => result.status === "rejected");

  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].reason.code, "LEAVE_ALREADY_DECIDED");

  const records = await pool.query(
    `SELECT lr.status, count(ld.id)::integer AS decision_count
     FROM leave_requests lr
     LEFT JOIN leave_decisions ld ON ld.leave_request_id = lr.id
     WHERE lr.id = $1
     GROUP BY lr.status`,
    [pendingLeaves[2].id]
  );
  assert.equal(records.rows[0].decision_count, 1);
  assert.equal(records.rows[0].status, fulfilled[0].value.decision.outcome);
});

test("database decision guard rejects forged staff and applies valid status", async () => {
  await assert.rejects(
    pool.query(
      `INSERT INTO leave_decisions (
         leave_request_id, outcome, decided_by_user_id,
         actor_name, actor_role, note, decided_at
       ) VALUES ($1, 'approved', $2, $3, 'warden', $4, $5)`,
      [
        pendingLeaves[3].id,
        secondWarden.id,
        secondWarden.name,
        "Attempt from a different hostel",
        "2026-10-02T12:00:00Z",
      ]
    ),
    (error) => error.code === "42501"
  );
  await assert.rejects(
    pool.query(
      `INSERT INTO leave_decisions (
         leave_request_id, outcome, decided_by_user_id,
         actor_name, actor_role, note, decided_at
       ) VALUES ($1, 'approved', $2, 'Forged Name', 'warden', $3, $4)`,
      [
        pendingLeaves[3].id,
        firstWarden.id,
        "Actor snapshot must be authentic",
        "2026-10-02T12:00:00Z",
      ]
    ),
    (error) =>
      error.code === "23514" &&
      error.constraint === "leave_decisions_actor_identity_check"
  );

  await pool.query(
    `INSERT INTO leave_decisions (
       leave_request_id, outcome, decided_by_user_id,
       actor_name, actor_role, note, decided_at
     ) VALUES ($1, 'approved', $2, $3, 'warden', $4, $5)`,
    [
      pendingLeaves[3].id,
      firstWarden.id,
      firstWarden.name,
      "Valid direct decision for constraint verification",
      "2026-10-02T12:00:00Z",
    ]
  );

  const request = await pool.query(
    "SELECT status, updated_at FROM leave_requests WHERE id = $1",
    [pendingLeaves[3].id]
  );
  assert.equal(request.rows[0].status, LEAVE_STATUSES.APPROVED);
  assert.equal(
    request.rows[0].updated_at.toISOString(),
    "2026-10-02T12:00:00.000Z"
  );
});

test("an already decided request cannot be decided again", async () => {
  await assert.rejects(
    decideLeaveRequest(
      database,
      { id: administrator.id, role: USER_ROLES.ADMIN },
      pendingLeaves[0].id,
      { outcome: "rejected", note: "Attempt to replace the original decision" },
      decisionOptions(new Date("2026-10-03T08:00:00.000Z"))
    ),
    (error) => error.code === "LEAVE_ALREADY_DECIDED"
  );

  const records = await pool.query(
    "SELECT count(*)::integer AS count FROM leave_decisions WHERE leave_request_id = $1",
    [pendingLeaves[0].id]
  );
  assert.equal(records.rows[0].count, 1);
});

test("file failure rolls approval back and token collisions are retried", async () => {
  const partialFiles = new Map();
  let writeCount = 0;
  const failingStorage = {
    async write(key, contents) {
      writeCount += 1;
      if (writeCount === 2) throw new Error("PDF storage unavailable");
      partialFiles.set(key, contents);
    },
    async remove(key) {
      partialFiles.delete(key);
    },
  };

  await assert.rejects(
    decideLeaveRequest(
      database,
      { id: firstWarden.id, role: USER_ROLES.WARDEN },
      pendingLeaves[4].id,
      { outcome: "approved", note: "Details verified before pass creation" },
      decisionOptions(new Date("2026-10-03T09:00:00.000Z"), {
        storage: failingStorage,
      })
    ),
    (error) =>
      error.statusCode === 503 && error.code === "GATE_PASS_STORAGE_UNAVAILABLE"
  );
  assert.equal(partialFiles.size, 0);

  const afterFailure = await pool.query(
    `SELECT lr.status, count(ld.id)::integer AS decisions, count(gp.id)::integer AS passes
     FROM leave_requests lr
     LEFT JOIN leave_decisions ld ON ld.leave_request_id = lr.id
     LEFT JOIN gate_passes gp ON gp.leave_request_id = lr.id
     WHERE lr.id = $1 GROUP BY lr.status`,
    [pendingLeaves[4].id]
  );
  assert.deepEqual(afterFailure.rows[0], {
    status: "pending",
    decisions: 0,
    passes: 0,
  });

  const tokens = [firstGatePassToken, secondGatePassToken];
  let tokenCalls = 0;
  const result = await decideLeaveRequest(
    database,
    { id: firstWarden.id, role: USER_ROLES.WARDEN },
    pendingLeaves[4].id,
    { outcome: "approved", note: "Retry after private storage recovered" },
    decisionOptions(new Date("2026-10-03T09:05:00.000Z"), {
      createToken: () => tokens[tokenCalls++],
    })
  );

  assert.equal(result.leaveRequest.status, "approved");
  assert.equal(tokenCalls, 2);
});

test("exit and return are atomic and idempotent under concurrent scans", async () => {
  const actor = { id: firstGuard.id, role: USER_ROLES.GUARD };
  const now = new Date("2026-11-14T10:00:00.000Z");
  const exitInput = {
    credential: secondGatePassToken,
    action: "exit",
    idempotencyKey: "gate-exit-idempotency-0001",
    note: "Student identity verified at the main gate",
  };

  const exit = await recordGateMovement(database, actor, exitInput, { now });
  const exitReplay = await recordGateMovement(database, actor, exitInput, {
    now: new Date("2026-11-14T10:00:05.000Z"),
  });

  assert.equal(exit.movement, "exit");
  assert.equal(exit.status, "exited");
  assert.equal(exit.replayed, false);
  assert.equal(exitReplay.id, exit.id);
  assert.equal(exitReplay.replayed, true);

  await assert.rejects(
    recordGateMovement(
      database,
      actor,
      {
        ...exitInput,
        idempotencyKey: "gate-exit-idempotency-0002",
      },
      { now: new Date("2026-11-14T10:01:00.000Z") }
    ),
    (error) => error.code === "GATE_ACTION_MISMATCH"
  );

  const returnInput = {
    credential: `hostelmate://gate-pass/${secondGatePassToken}`,
    action: "return",
    idempotencyKey: "gate-return-idempotency-001",
  };
  const returnResults = await Promise.all([
    recordGateMovement(database, actor, returnInput, {
      now: new Date("2026-11-14T12:00:00.000Z"),
    }),
    recordGateMovement(database, actor, returnInput, {
      now: new Date("2026-11-14T12:00:00.000Z"),
    }),
  ]);

  assert.equal(new Set(returnResults.map((result) => result.id)).size, 1);
  assert.deepEqual(
    returnResults.map((result) => result.replayed).sort(),
    [false, true]
  );

  const [databaseState, timeline, audits, movementNotifications] = await Promise.all([
    pool.query(
      `SELECT lr.status, count(ge.id)::integer AS event_count
       FROM leave_requests lr
       LEFT JOIN gate_events ge ON ge.leave_request_id = lr.id
       WHERE lr.id = $1 GROUP BY lr.status`,
      [pendingLeaves[4].id]
    ),
    pool.query(
      "SELECT event_type FROM leave_events WHERE leave_request_id = $1 ORDER BY id",
      [pendingLeaves[4].id]
    ),
    pool.query(
      `SELECT action FROM audit_events
       WHERE resource_type = 'gate_event'
         AND metadata->>'leaveRequestId' = $1
       ORDER BY id`,
      [String(pendingLeaves[4].id)]
    ),
    pool.query(
      `SELECT resource_id, recipient_user_id, link_path
       FROM notifications
       WHERE event_type = 'gate_movement'
         AND metadata->>'leaveRequestId' = $1
       ORDER BY resource_id`,
      [String(pendingLeaves[4].id)]
    ),
  ]);

  assert.deepEqual(databaseState.rows[0], {
    status: "returned",
    event_count: 2,
  });
  assert.deepEqual(
    timeline.rows.map((event) => event.event_type),
    ["submitted", "approved", "pass_issued", "exited", "returned"]
  );
  assert.deepEqual(
    audits.rows.map((event) => event.action),
    [AUDIT_ACTIONS.GATE_EXIT_RECORDED, AUDIT_ACTIONS.GATE_RETURN_RECORDED]
  );
  assert.equal(movementNotifications.rows.length, 2);
  assert.ok(movementNotifications.rows.every((notification) =>
    notification.recipient_user_id === students[4].id &&
    notification.link_path === "/student/leaves"
  ));
});
