import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
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
import { USER_ROLES } from "../../src/domain/roles.js";
import {
  deleteComplaintAttachment,
  downloadComplaintAttachment,
  listComplaintAttachments,
  uploadComplaintAttachment,
} from "../../src/services/complaintAttachmentService.js";
import { createComplaint } from "../../src/services/complaintService.js";

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
const storedFiles = new Map();
const storage = {
  async write(key, contents) {
    if (storedFiles.has(key)) {
      throw new Error("File already exists");
    }
    storedFiles.set(key, Buffer.from(contents));
  },
  async read(key) {
    const contents = storedFiles.get(key);
    if (!contents) {
      const error = new Error("File not found");
      error.code = "ENOENT";
      throw error;
    }
    return Buffer.from(contents);
  },
  async remove(key) {
    if (!storedFiles.delete(key)) {
      throw new Error("File not found");
    }
  },
};
const pngContents = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01,
]);
const upload = {
  buffer: pngContents,
  mimetype: "image/png",
  originalname: "leaking-pipe.png",
};

let student;
let outsider;
let warden;
let maintenance;
let admin;

const actorFor = (user) => ({ id: user.id, role: user.role });

const createTestComplaint = (reporter, location) =>
  createComplaint(
    database,
    actorFor(reporter),
    {
      categoryCode: "plumbing",
      location,
      description: "Water is leaking continuously and requires inspection.",
    }
  );

before(async () => {
  const [firstHostel, secondHostel] = await database
    .insert(hostels)
    .values([
      { code: "FILE1", name: "Private Files Hostel One" },
      { code: "FILE2", name: "Private Files Hostel Two" },
    ])
    .returning();

  [student, outsider, warden, maintenance, admin] = await database
    .insert(users)
    .values([
      {
        name: "Attachment Student",
        email: "student@attachment.integration.test",
        password: "test-hash",
        role: USER_ROLES.STUDENT,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
        rollNo: "FILE-STUDENT-01",
      },
      {
        name: "Outside Student",
        email: "outsider@attachment.integration.test",
        password: "test-hash",
        role: USER_ROLES.STUDENT,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
        rollNo: "FILE-STUDENT-02",
      },
      {
        name: "Attachment Warden",
        email: "warden@attachment.integration.test",
        password: "test-hash",
        role: USER_ROLES.WARDEN,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
      },
      {
        name: "Attachment Technician",
        email: "maintenance@attachment.integration.test",
        password: "test-hash",
        role: USER_ROLES.MAINTENANCE,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
      },
      {
        name: "Attachment Administrator",
        email: "admin@attachment.integration.test",
        password: "test-hash",
        role: USER_ROLES.ADMIN,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
      },
    ])
    .returning();

  await database.insert(hostelMemberships).values([
    { userId: student.id, hostelId: firstHostel.id, isPrimary: true },
    { userId: warden.id, hostelId: firstHostel.id, isPrimary: true },
    { userId: maintenance.id, hostelId: firstHostel.id, isPrimary: true },
    { userId: outsider.id, hostelId: secondHostel.id, isPrimary: true },
  ]);
  await database.insert(studentProfiles).values([
    {
      userId: student.id,
      hostelId: firstHostel.id,
      rollNo: "FILE-STUDENT-01",
    },
    {
      userId: outsider.id,
      hostelId: secondHostel.id,
      rollNo: "FILE-STUDENT-02",
    },
  ]);
});

after(async () => {
  await pool.end();
});

test("reporter can upload, view, list, and delete private evidence", async () => {
  const complaint = await createTestComplaint(student, "Bathroom 201");
  const attachment = await uploadComplaintAttachment(
    database,
    actorFor(student),
    complaint.id,
    upload,
    { storage, createId: () => "reporter-lifecycle" }
  );

  assert.equal(attachment.originalName, upload.originalname);
  assert.equal(attachment.downloadUrl.includes("private-storage"), false);
  assert.equal(storedFiles.size, 1);

  const listed = await listComplaintAttachments(
    database,
    actorFor(student),
    complaint.id
  );
  const downloaded = await downloadComplaintAttachment(
    database,
    actorFor(student),
    complaint.id,
    attachment.id,
    { storage }
  );

  assert.equal(listed.length, 1);
  assert.deepEqual(downloaded.contents, pngContents);

  await assert.rejects(
    downloadComplaintAttachment(
      database,
      actorFor(outsider),
      complaint.id,
      attachment.id,
      { storage }
    ),
    (error) => error.statusCode === 404 && error.code === "COMPLAINT_NOT_FOUND"
  );
  await assert.rejects(
    deleteComplaintAttachment(
      database,
      actorFor(warden),
      complaint.id,
      attachment.id,
      { storage }
    ),
    (error) =>
      error.statusCode === 403 && error.code === "ATTACHMENT_DELETE_DENIED"
  );

  await deleteComplaintAttachment(
    database,
    actorFor(student),
    complaint.id,
    attachment.id,
    { storage }
  );

  assert.equal(storedFiles.size, 0);
  assert.deepEqual(
    await listComplaintAttachments(database, actorFor(student), complaint.id),
    []
  );
});

test("assigned maintenance can read evidence and an admin can remove it", async () => {
  const complaint = await createTestComplaint(student, "Laundry room");
  const attachment = await uploadComplaintAttachment(
    database,
    actorFor(student),
    complaint.id,
    upload,
    { storage, createId: () => "assigned-maintenance" }
  );

  await database.insert(complaintAssignments).values({
    complaintId: complaint.id,
    assigneeUserId: maintenance.id,
    assignedByUserId: warden.id,
  });

  const downloaded = await downloadComplaintAttachment(
    database,
    actorFor(maintenance),
    complaint.id,
    attachment.id,
    { storage }
  );
  assert.deepEqual(downloaded.contents, pngContents);

  await deleteComplaintAttachment(
    database,
    actorFor(admin),
    complaint.id,
    attachment.id,
    { storage }
  );
  assert.equal(storedFiles.size, 0);

  const auditResult = await pool.query(
    `SELECT action
     FROM audit_events
     WHERE resource_type = 'complaint_attachment' AND resource_id = $1
     ORDER BY created_at, id`,
    [String(attachment.id)]
  );
  assert.deepEqual(
    auditResult.rows.map((row) => row.action),
    ["complaint.attachment.added", "complaint.attachment.deleted"]
  );
});
