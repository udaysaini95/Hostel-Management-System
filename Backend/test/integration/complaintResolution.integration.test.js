import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { and, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../src/db/schema.js";
import {
  complaintAssignments,
  hostelMemberships,
  hostels,
  studentProfiles,
  users,
} from "../../src/db/schema.js";
import { ACCOUNT_STATUSES } from "../../src/domain/accountStatuses.js";
import { COMPLAINT_STATUSES } from "../../src/domain/complaintWorkflow.js";
import { USER_ROLES } from "../../src/domain/roles.js";
import { assignComplaint } from "../../src/services/complaintAssignmentService.js";
import {
  createComplaint,
  searchAssignedComplaints,
} from "../../src/services/complaintService.js";
import {
  resolveComplaint,
  startComplaintWork,
  verifyComplaintResolution,
} from "../../src/services/complaintResolutionService.js";

const { Pool } = pg;

if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    "Integration tests must be started through npm test or npm run test:integration."
  );
}

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 4 });
const database = drizzle(pool, { schema });
const storedFiles = new Map();
const storage = {
  async write(key, contents) {
    storedFiles.set(key, Buffer.from(contents));
  },
  async read(key) {
    return Buffer.from(storedFiles.get(key));
  },
  async remove(key) {
    storedFiles.delete(key);
  },
};
const resolutionImage = {
  buffer: Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01,
  ]),
  mimetype: "image/png",
  originalname: "completed-repair.png",
};

let student;
let otherStudent;
let warden;
let technician;
let otherTechnician;

const actorFor = (user) => ({ id: user.id, role: user.role });

before(async () => {
  const [hostel] = await database
    .insert(hostels)
    .values({ code: "FLOW1", name: "Resolution Workflow Hostel" })
    .returning();

  [student, otherStudent, warden, technician, otherTechnician] = await database
    .insert(users)
    .values([
      {
        name: "Resolution Student",
        email: "student@resolution.integration.test",
        password: "test-hash",
        role: USER_ROLES.STUDENT,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
        rollNo: "RESOLUTION-STUDENT-01",
      },
      {
        name: "Other Resolution Student",
        email: "other.student@resolution.integration.test",
        password: "test-hash",
        role: USER_ROLES.STUDENT,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
        rollNo: "RESOLUTION-STUDENT-02",
      },
      {
        name: "Resolution Warden",
        email: "warden@resolution.integration.test",
        password: "test-hash",
        role: USER_ROLES.WARDEN,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
      },
      {
        name: "Resolution Technician",
        email: "technician@resolution.integration.test",
        password: "test-hash",
        role: USER_ROLES.MAINTENANCE,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
      },
      {
        name: "Other Resolution Technician",
        email: "other.technician@resolution.integration.test",
        password: "test-hash",
        role: USER_ROLES.MAINTENANCE,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
      },
    ])
    .returning();

  await database.insert(hostelMemberships).values(
    [student, otherStudent, warden, technician, otherTechnician].map(
      (user) => ({ userId: user.id, hostelId: hostel.id, isPrimary: true })
    )
  );
  await database.insert(studentProfiles).values([
    {
      userId: student.id,
      hostelId: hostel.id,
      rollNo: "RESOLUTION-STUDENT-01",
    },
    {
      userId: otherStudent.id,
      hostelId: hostel.id,
      rollNo: "RESOLUTION-STUDENT-02",
    },
  ]);
});

after(async () => {
  await pool.end();
});

test("assigned work can be resolved, reopened, and closed by its reporter", async () => {
  const complaint = await createComplaint(
    database,
    actorFor(student),
    {
      categoryCode: "plumbing",
      location: "Block F washroom",
      description: "The washbasin pipe is leaking onto the washroom floor.",
    },
    { now: new Date("2026-09-08T08:00:00.000Z") }
  );

  await assignComplaint(
    database,
    actorFor(warden),
    complaint.id,
    { assigneeUserId: technician.id },
    { now: new Date("2026-09-08T08:05:00.000Z") }
  );

  await assert.rejects(
    startComplaintWork(
      database,
      actorFor(otherTechnician),
      complaint.id,
      { now: new Date("2026-09-08T08:10:00.000Z") }
    ),
    (error) => error.statusCode === 404 && error.code === "COMPLAINT_NOT_FOUND"
  );

  const started = await startComplaintWork(
    database,
    actorFor(technician),
    complaint.id,
    { now: new Date("2026-09-08T08:10:00.000Z") }
  );
  assert.equal(started.status, COMPLAINT_STATUSES.IN_PROGRESS);

  const firstResolution = await resolveComplaint(
    database,
    actorFor(technician),
    complaint.id,
    { resolutionNote: "Replaced the cracked pipe joint and tested the basin." },
    resolutionImage,
    {
      now: new Date("2026-09-08T08:30:00.000Z"),
      storage,
      createId: () => "first-resolution",
    }
  );
  assert.equal(firstResolution.complaint.status, COMPLAINT_STATUSES.RESOLVED);
  assert.equal(firstResolution.resolutionEvidence.purpose, "resolution");
  assert.equal(
    firstResolution.resolutionEvidence.eventId,
    firstResolution.complaint.timeline.at(-1).id
  );
  assert.equal(storedFiles.size, 1);

  await assert.rejects(
    verifyComplaintResolution(
      database,
      actorFor(otherStudent),
      complaint.id,
      { action: "close" },
      { now: new Date("2026-09-08T08:35:00.000Z") }
    ),
    (error) => error.code === "COMPLAINT_VERIFICATION_DENIED"
  );

  const reopened = await verifyComplaintResolution(
    database,
    actorFor(student),
    complaint.id,
    { action: "reopen", reason: "The joint is still dripping near the wall." },
    { now: new Date("2026-09-08T08:40:00.000Z") }
  );
  assert.equal(reopened.status, COMPLAINT_STATUSES.IN_PROGRESS);
  assert.equal(reopened.resolutionNote, null);
  assert.equal(reopened.assignment.assignee.id, technician.id);

  await resolveComplaint(
    database,
    actorFor(technician),
    complaint.id,
    { resolutionNote: "Resealed the wall joint and completed a pressure test." },
    null,
    { now: new Date("2026-09-08T09:00:00.000Z"), storage }
  );
  const closed = await verifyComplaintResolution(
    database,
    actorFor(student),
    complaint.id,
    { action: "close", reason: "The repair is dry and working correctly now." },
    { now: new Date("2026-09-08T09:10:00.000Z") }
  );

  assert.equal(closed.status, COMPLAINT_STATUSES.CLOSED);
  assert.equal(closed.assignment, null);
  assert.deepEqual(
    closed.timeline.map((event) => event.type),
    [
      "created",
      "assigned",
      "work_started",
      "resolved",
      "reopened",
      "resolved",
      "closed",
    ]
  );

  const [activeAssignment] = await database
    .select({ id: complaintAssignments.id })
    .from(complaintAssignments)
    .where(
      and(
        eq(complaintAssignments.complaintId, complaint.id),
        isNull(complaintAssignments.endedAt)
      )
    );
  assert.equal(activeAssignment, undefined);

  const queue = await searchAssignedComplaints(
    database,
    actorFor(technician),
    {}
  );
  assert.equal(queue.data.some((item) => item.id === complaint.id), false);
});
