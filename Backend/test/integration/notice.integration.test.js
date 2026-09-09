import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq } from "drizzle-orm";
import * as schema from "../../src/db/schema.js";
import {
  auditEvents,
  hostelBlocks,
  hostelMemberships,
  hostels,
  noticeRecipients,
  notices,
  notifications,
  roomAllocations,
  rooms,
  studentProfiles,
  users,
} from "../../src/db/schema.js";
import { ACCOUNT_STATUSES } from "../../src/domain/accountStatuses.js";
import { USER_ROLES } from "../../src/domain/roles.js";
import {
  getUnreadNoticeCount,
  listManagedNotices,
  listMyNotices,
  markNoticeRead,
  publishNotice,
} from "../../src/services/noticeService.js";
import {
  getUnreadNotificationCount,
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../../src/services/notificationService.js";

const { Pool } = pg;
if (!process.env.TEST_DATABASE_URL) {
  throw new Error("Integration tests must be started through the repository test runner.");
}

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const database = drizzle(pool, { schema });
const actorFor = (user) => ({ id: user.id, role: user.role });
const errorCode = (error) => error?.cause?.code ?? error?.code;

let firstHostel;
let secondHostel;
let firstBlock;
let secondBlock;
let firstStudent;
let sameHostelStudent;
let otherStudent;
let warden;
let otherWarden;
let administrator;
let guard;
let hostelNotice;
let importantNotification;

before(async () => {
  [firstHostel, secondHostel] = await database.insert(hostels).values([
    { code: "NT1", name: "Notice Hostel One" },
    { code: "NT2", name: "Notice Hostel Two" },
  ]).returning();
  [firstBlock, secondBlock] = await database.insert(hostelBlocks).values([
    { hostelId: firstHostel.id, code: "A", name: "Block A" },
    { hostelId: firstHostel.id, code: "B", name: "Block B" },
  ]).returning();
  const [firstRoom, secondRoom] = await database.insert(rooms).values([
    { blockId: firstBlock.id, roomNumber: "101", floor: 1, capacity: 2 },
    { blockId: secondBlock.id, roomNumber: "201", floor: 2, capacity: 2 },
  ]).returning();

  [firstStudent, sameHostelStudent, otherStudent, warden, otherWarden, administrator, guard] =
    await database.insert(users).values([
      { name: "Notice Student A", email: "student-a@notice.integration.test", password: "hash", role: USER_ROLES.STUDENT, accountStatus: ACCOUNT_STATUSES.ACTIVE },
      { name: "Notice Student B", email: "student-b@notice.integration.test", password: "hash", role: USER_ROLES.STUDENT, accountStatus: ACCOUNT_STATUSES.ACTIVE },
      { name: "Notice Student C", email: "student-c@notice.integration.test", password: "hash", role: USER_ROLES.STUDENT, accountStatus: ACCOUNT_STATUSES.ACTIVE },
      { name: "Notice Warden A", email: "warden-a@notice.integration.test", password: "hash", role: USER_ROLES.WARDEN, accountStatus: ACCOUNT_STATUSES.ACTIVE },
      { name: "Notice Warden B", email: "warden-b@notice.integration.test", password: "hash", role: USER_ROLES.WARDEN, accountStatus: ACCOUNT_STATUSES.ACTIVE },
      { name: "Notice Admin", email: "admin@notice.integration.test", password: "hash", role: USER_ROLES.ADMIN, accountStatus: ACCOUNT_STATUSES.ACTIVE },
      { name: "Notice Guard", email: "guard@notice.integration.test", password: "hash", role: USER_ROLES.GUARD, accountStatus: ACCOUNT_STATUSES.ACTIVE },
    ]).returning();

  await database.insert(hostelMemberships).values([
    { userId: firstStudent.id, hostelId: firstHostel.id, isPrimary: true },
    { userId: sameHostelStudent.id, hostelId: firstHostel.id, isPrimary: true },
    { userId: otherStudent.id, hostelId: secondHostel.id, isPrimary: true },
    { userId: warden.id, hostelId: firstHostel.id, isPrimary: true },
    { userId: otherWarden.id, hostelId: secondHostel.id, isPrimary: true },
    { userId: guard.id, hostelId: firstHostel.id, isPrimary: true },
  ]);
  const profiles = await database.insert(studentProfiles).values([
    { userId: firstStudent.id, hostelId: firstHostel.id, rollNo: "NOTICE-001" },
    { userId: sameHostelStudent.id, hostelId: firstHostel.id, rollNo: "NOTICE-002" },
    { userId: otherStudent.id, hostelId: secondHostel.id, rollNo: "NOTICE-003" },
  ]).returning();
  await database.insert(roomAllocations).values([
    { studentProfileId: profiles[0].id, roomId: firstRoom.id, allocatedByUserId: administrator.id },
    { studentProfileId: profiles[1].id, roomId: secondRoom.id, allocatedByUserId: administrator.id },
  ]);
});

after(async () => {
  await pool.end();
});

test("warden publication materializes only the assigned hostel audience", async () => {
  const now = new Date("2026-09-10T09:00:00Z");
  hostelNotice = await publishNotice(database, actorFor(warden), {
    title: "Water supply maintenance",
    body: "Water supply will pause from 11:00 to 12:00 for maintenance.",
    priority: "important",
    audience: { type: "hostel", hostelId: firstHostel.id },
    expiresAt: "2026-09-11T09:00:00Z",
  }, { now });

  assert.equal(hostelNotice.audience.hostel.id, firstHostel.id);
  assert.equal(hostelNotice.recipientCount, 4);
  const firstInbox = await listMyNotices(database, actorFor(firstStudent), {}, { now });
  const otherInbox = await listMyNotices(database, actorFor(otherStudent), {}, { now });
  assert.equal(firstInbox.data[0].id, hostelNotice.id);
  assert.equal(firstInbox.data[0].isRead, false);
  assert.equal(otherInbox.data.length, 0);

  const audit = await database
    .select()
    .from(auditEvents)
    .where(and(eq(auditEvents.resourceType, "notice"), eq(auditEvents.resourceId, String(hostelNotice.id))));
  assert.equal(audit.length, 1);
  assert.equal(audit[0].action, "notice.published");

  [importantNotification] = await database
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientUserId, firstStudent.id),
        eq(notifications.resourceId, hostelNotice.id)
      )
    );
  assert.equal(importantNotification.eventType, "important_notice");
  assert.equal(importantNotification.linkPath, "/notices");
});

test("block notices use the resident's current room allocation", async () => {
  const now = new Date("2026-09-10T10:00:00Z");
  const blockNotice = await publishNotice(database, actorFor(warden), {
    title: "Block A inspection",
    body: "Keep the corridor clear during the scheduled electrical inspection.",
    audience: { type: "block", hostelId: firstHostel.id, blockId: firstBlock.id },
  }, { now });

  assert.equal(blockNotice.recipientCount, 1);
  const firstInbox = await listMyNotices(database, actorFor(firstStudent), {}, { now });
  const sameHostelInbox = await listMyNotices(database, actorFor(sameHostelStudent), {}, { now });
  assert.ok(firstInbox.data.some((notice) => notice.id === blockNotice.id));
  assert.ok(!sameHostelInbox.data.some((notice) => notice.id === blockNotice.id));
});

test("admins can address all residents while expired notices leave the active inbox", async () => {
  const publishedAt = new Date("2026-09-10T11:00:00Z");
  const residentNotice = await publishNotice(database, actorFor(administrator), {
    title: "Resident survey",
    body: "All residents may complete the annual hostel experience survey.",
    audience: { type: "all_residents" },
    expiresAt: "2026-09-10T12:00:00Z",
  }, { now: publishedAt });

  const recipientRows = await database
    .select({ userId: noticeRecipients.userId })
    .from(noticeRecipients)
    .where(eq(noticeRecipients.noticeId, residentNotice.id));
  const recipientIds = new Set(recipientRows.map((recipient) => recipient.userId));
  assert.ok(recipientIds.has(firstStudent.id));
  assert.ok(recipientIds.has(sameHostelStudent.id));
  assert.ok(recipientIds.has(otherStudent.id));
  assert.ok(!recipientIds.has(guard.id));
  const activeAfterExpiry = await listMyNotices(
    database,
    actorFor(otherStudent),
    {},
    { now: new Date("2026-09-10T12:00:00Z") }
  );
  const history = await listMyNotices(
    database,
    actorFor(otherStudent),
    { state: "all" },
    { now: new Date("2026-09-10T12:00:00Z") }
  );
  assert.ok(!activeAfterExpiry.data.some((notice) => notice.id === residentNotice.id));
  assert.ok(history.data.some((notice) => notice.id === residentNotice.id && !notice.isActive));
});

test("notification inbox is recipient-owned and supports one or all read updates", async () => {
  const inbox = await listMyNotifications(database, actorFor(firstStudent));
  const otherInbox = await listMyNotifications(database, actorFor(otherStudent));
  assert.ok(inbox.data.some((item) => item.id === importantNotification.id));
  assert.ok(!otherInbox.data.some((item) => item.id === importantNotification.id));

  const before = await getUnreadNotificationCount(database, actorFor(firstStudent));
  const read = await markNotificationRead(
    database,
    actorFor(firstStudent),
    importantNotification.id,
    { now: new Date("2026-09-10T11:30:00Z") }
  );
  const repeated = await markNotificationRead(
    database,
    actorFor(firstStudent),
    importantNotification.id,
    { now: new Date("2026-09-10T11:45:00Z") }
  );
  assert.equal(repeated.readAt.toISOString(), read.readAt.toISOString());
  await assert.rejects(
    () => markNotificationRead(database, actorFor(otherStudent), importantNotification.id),
    { code: "NOTIFICATION_NOT_FOUND" }
  );

  const allRead = await markAllNotificationsRead(
    database,
    actorFor(firstStudent),
    { now: new Date("2026-09-10T11:45:00Z") }
  );
  const after = await getUnreadNotificationCount(database, actorFor(firstStudent));
  assert.ok(before.unreadCount >= 1);
  assert.ok(allRead.updatedCount >= 0);
  assert.equal(after.unreadCount, 0);
});

test("reading is recipient-owned, idempotent, and updates the active unread count", async () => {
  const now = new Date("2026-09-10T10:30:00Z");
  const beforeRead = await getUnreadNoticeCount(database, actorFor(firstStudent), { now });
  const firstRead = await markNoticeRead(database, actorFor(firstStudent), hostelNotice.id, { now });
  const secondRead = await markNoticeRead(database, actorFor(firstStudent), hostelNotice.id, {
    now: new Date("2026-09-10T10:45:00Z"),
  });
  const afterRead = await getUnreadNoticeCount(database, actorFor(firstStudent), { now });

  assert.equal(afterRead.unreadCount, beforeRead.unreadCount - 1);
  assert.equal(secondRead.readAt.toISOString(), firstRead.readAt.toISOString());
  await assert.rejects(
    () => markNoticeRead(database, actorFor(otherStudent), hostelNotice.id, { now }),
    { code: "NOTICE_NOT_FOUND" }
  );
});

test("warden scope and database guards reject forged notice access", async () => {
  await assert.rejects(
    () => publishNotice(database, actorFor(warden), {
      title: "Out of scope",
      body: "This notice must not be published to another hostel.",
      audience: { type: "hostel", hostelId: secondHostel.id },
    }),
    { code: "HOSTEL_ACCESS_DENIED" }
  );
  await assert.rejects(
    () => publishNotice(database, actorFor(warden), {
      title: "Institution wide",
      body: "Wardens cannot publish an institution-wide resident notice.",
      audience: { type: "all_residents" },
    }),
    { code: "NOTICE_AUDIENCE_DENIED" }
  );

  const otherQueue = await listManagedNotices(database, actorFor(otherWarden));
  assert.ok(!otherQueue.data.some((notice) => notice.id === hostelNotice.id));
  await assert.rejects(
    database.insert(noticeRecipients).values({
      noticeId: hostelNotice.id,
      userId: otherStudent.id,
      createdAt: new Date("2026-09-10T09:00:00Z"),
    }),
    (error) => errorCode(error) === "42501"
  );
  await assert.rejects(
    database.update(notices).set({ title: "Changed" }).where(eq(notices.id, hostelNotice.id)),
    (error) => errorCode(error) === "55000"
  );
  const [recipient] = await database
    .select()
    .from(noticeRecipients)
    .where(and(eq(noticeRecipients.noticeId, hostelNotice.id), eq(noticeRecipients.userId, firstStudent.id)));
  await assert.rejects(
    database.update(noticeRecipients).set({ readAt: new Date("2026-09-10T11:00:00Z") }).where(eq(noticeRecipients.id, recipient.id)),
    (error) => errorCode(error) === "55000"
  );

  const directPublishedAt = new Date("2026-09-10T12:00:00Z");
  const [directNotice] = await database.insert(notices).values({
    publishedByUserId: administrator.id,
    title: "Direct role notice",
    body: "This direct insert exists only to verify the database recipient guard.",
    audienceType: "role",
    audienceRole: USER_ROLES.GUARD,
    publishedAt: directPublishedAt,
  }).returning({ id: notices.id });
  await assert.rejects(
    database.insert(noticeRecipients).values({
      noticeId: directNotice.id,
      userId: guard.id,
      readAt: directPublishedAt,
      createdAt: directPublishedAt,
    }),
    (error) => errorCode(error) === "23514"
  );
  await assert.rejects(
    database.insert(notifications).values({
      recipientUserId: otherStudent.id,
      eventType: "important_notice",
      title: "Forged notification",
      message: "This user was not a recipient of the referenced notice.",
      resourceType: "notice",
      resourceId: hostelNotice.id,
      linkPath: "/notices",
      dedupeKey: `forged-notice:${hostelNotice.id}:${otherStudent.id}`,
      createdAt: new Date("2026-09-10T12:00:00Z"),
    }),
    (error) => errorCode(error) === "42501"
  );
});
