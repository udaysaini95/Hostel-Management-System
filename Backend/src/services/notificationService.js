import {
  and,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
} from "drizzle-orm";
import {
  hostelMemberships,
  notifications,
  users,
} from "../db/schema.js";
import { ACCOUNT_STATUSES } from "../domain/accountStatuses.js";
import {
  NOTIFICATION_DESTINATIONS,
  NOTIFICATION_EVENT_TYPES,
  NOTIFICATION_READ_STATES,
  buildNotificationLink,
} from "../domain/notifications.js";
import { USER_ROLES } from "../domain/roles.js";
import { ApiError } from "../utils/apiErrors.js";

const eventRules = Object.freeze({
  [NOTIFICATION_EVENT_TYPES.COMPLAINT_REPORTED]: Object.freeze({
    roles: [USER_ROLES.WARDEN, USER_ROLES.ADMIN],
    resourceType: "complaint",
    destination: NOTIFICATION_DESTINATIONS.MANAGED_COMPLAINTS,
  }),
  [NOTIFICATION_EVENT_TYPES.COMPLAINT_ASSIGNED]: Object.freeze({
    roles: [USER_ROLES.MAINTENANCE],
    resourceType: "complaint",
    destination: NOTIFICATION_DESTINATIONS.MAINTENANCE_WORK,
  }),
  [NOTIFICATION_EVENT_TYPES.COMPLAINT_RESOLVED]: Object.freeze({
    roles: [USER_ROLES.STUDENT],
    resourceType: "complaint",
    destination: NOTIFICATION_DESTINATIONS.STUDENT_COMPLAINT,
  }),
  [NOTIFICATION_EVENT_TYPES.LEAVE_SUBMITTED]: Object.freeze({
    roles: [USER_ROLES.WARDEN, USER_ROLES.ADMIN],
    resourceType: "leave_request",
    destination: NOTIFICATION_DESTINATIONS.MANAGED_LEAVES,
  }),
  [NOTIFICATION_EVENT_TYPES.LEAVE_DECIDED]: Object.freeze({
    roles: [USER_ROLES.STUDENT],
    resourceType: "leave_request",
    destination: NOTIFICATION_DESTINATIONS.STUDENT_LEAVES,
  }),
  [NOTIFICATION_EVENT_TYPES.GATE_MOVEMENT]: Object.freeze({
    roles: [USER_ROLES.STUDENT],
    resourceType: "gate_event",
    destination: NOTIFICATION_DESTINATIONS.STUDENT_LEAVES,
  }),
  [NOTIFICATION_EVENT_TYPES.IMPORTANT_NOTICE]: Object.freeze({
    roles: Object.values(USER_ROLES),
    resourceType: "notice",
    destination: NOTIFICATION_DESTINATIONS.NOTICE_CENTER,
  }),
});

const fail = (status, code, message) => {
  throw new ApiError(status, code, message);
};

const positiveInteger = (value, label) => {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) {
    fail(400, "INVALID_REQUEST", `${label} must be a positive integer`);
  }
  return number;
};

const cleanText = (value, label, maxLength) => {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > maxLength) {
    fail(500, "INVALID_NOTIFICATION", `${label} is invalid`);
  }
  return text;
};

const validTime = (value) => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    fail(500, "INVALID_NOTIFICATION", "Notification timestamp is invalid");
  }
  return value;
};

const loadActiveActor = async (database, requestActor) => {
  const actorId = positiveInteger(requestActor?.id, "Actor ID");
  const [actor] = await database
    .select({ id: users.id, role: users.role, accountStatus: users.accountStatus })
    .from(users)
    .where(eq(users.id, actorId))
    .limit(1);
  if (!actor || actor.accountStatus !== ACCOUNT_STATUSES.ACTIVE) {
    fail(403, "ACCOUNT_INACTIVE", "An active account is required");
  }
  return actor;
};

export const getActiveHostelUserIds = async (
  database,
  hostelId,
  roles = [USER_ROLES.WARDEN]
) => {
  const id = positiveInteger(hostelId, "Hostel ID");
  const allowedRoles = roles.filter((role) => Object.values(USER_ROLES).includes(role));
  if (allowedRoles.length === 0) return [];

  const rows = await database
    .selectDistinct({ userId: users.id })
    .from(users)
    .innerJoin(hostelMemberships, eq(hostelMemberships.userId, users.id))
    .where(
      and(
        eq(hostelMemberships.hostelId, id),
        eq(users.accountStatus, ACCOUNT_STATUSES.ACTIVE),
        inArray(users.role, allowedRoles)
      )
    );
  return rows.map((row) => row.userId);
};

export const appendNotifications = async (
  database,
  {
    recipientUserIds = [],
    eventType,
    title,
    message,
    resourceId,
    dedupeKey,
    metadata = {},
    createdAt = new Date(),
  }
) => {
  const rule = eventRules[eventType];
  if (!rule) fail(500, "INVALID_NOTIFICATION", "Notification event type is invalid");
  const id = positiveInteger(resourceId, "Resource ID");
  const time = validTime(createdAt);
  const uniqueIds = [...new Set(recipientUserIds.map(Number))]
    .filter((recipientId) => Number.isSafeInteger(recipientId) && recipientId > 0);
  if (uniqueIds.length === 0) return [];
  if (!metadata || Array.isArray(metadata) || typeof metadata !== "object") {
    fail(500, "INVALID_NOTIFICATION", "Notification metadata must be an object");
  }

  const recipients = await database
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(
      and(
        inArray(users.id, uniqueIds),
        eq(users.accountStatus, ACCOUNT_STATUSES.ACTIVE),
        inArray(users.role, rule.roles)
      )
    );
  if (recipients.length === 0) return [];

  const baseKey = cleanText(dedupeKey, "Dedupe key", 150);
  const linkPath = buildNotificationLink(rule.destination, id);
  return database
    .insert(notifications)
    .values(recipients.map((recipient) => ({
      recipientUserId: recipient.id,
      eventType,
      title: cleanText(title, "Title", 160),
      message: cleanText(message, "Message", 500),
      resourceType: rule.resourceType,
      resourceId: id,
      linkPath,
      dedupeKey: `${baseKey}:${recipient.id}`,
      metadata,
      createdAt: time,
    })))
    .onConflictDoNothing({ target: notifications.dedupeKey })
    .returning();
};

const normalizeList = (input = {}) => {
  const page = positiveInteger(input.page ?? 1, "Page");
  const pageSize = Math.min(50, positiveInteger(input.pageSize ?? 20, "Page size"));
  const readState = input.readState ?? NOTIFICATION_READ_STATES.ALL;
  if (!Object.values(NOTIFICATION_READ_STATES).includes(readState)) {
    fail(400, "INVALID_NOTIFICATION_READ_STATE", "Select a valid read state");
  }
  return { page, pageSize, readState };
};

export const listMyNotifications = async (database, requestActor, input = {}) => {
  const actor = await loadActiveActor(database, requestActor);
  const filters = normalizeList(input);
  const conditions = [eq(notifications.recipientUserId, actor.id)];
  if (filters.readState === NOTIFICATION_READ_STATES.READ) {
    conditions.push(isNotNull(notifications.readAt));
  }
  if (filters.readState === NOTIFICATION_READ_STATES.UNREAD) {
    conditions.push(isNull(notifications.readAt));
  }
  const where = and(...conditions);
  const [totalRow] = await database.select({ total: count() }).from(notifications).where(where);
  const rows = await database
    .select()
    .from(notifications)
    .where(where)
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize);
  const total = Number(totalRow.total);
  return {
    data: rows.map((notification) => ({
      ...notification,
      isRead: Boolean(notification.readAt),
    })),
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / filters.pageSize),
    },
  };
};

export const getUnreadNotificationCount = async (database, requestActor) => {
  const actor = await loadActiveActor(database, requestActor);
  const [row] = await database
    .select({ total: count() })
    .from(notifications)
    .where(and(eq(notifications.recipientUserId, actor.id), isNull(notifications.readAt)));
  return { unreadCount: Number(row.total) };
};

export const markNotificationRead = async (
  database,
  requestActor,
  notificationId,
  { now = new Date() } = {}
) => {
  const actor = await loadActiveActor(database, requestActor);
  const id = positiveInteger(notificationId, "Notification ID");
  validTime(now);
  const [record] = await database
    .select({ id: notifications.id, readAt: notifications.readAt })
    .from(notifications)
    .where(and(eq(notifications.id, id), eq(notifications.recipientUserId, actor.id)))
    .limit(1);
  if (!record) fail(404, "NOTIFICATION_NOT_FOUND", "Notification not found");
  if (record.readAt) return { notificationId: id, isRead: true, readAt: record.readAt };

  const [updated] = await database
    .update(notifications)
    .set({ readAt: now })
    .where(and(eq(notifications.id, id), isNull(notifications.readAt)))
    .returning({ readAt: notifications.readAt });
  return { notificationId: id, isRead: true, readAt: updated?.readAt ?? now };
};

export const markAllNotificationsRead = async (
  database,
  requestActor,
  { now = new Date() } = {}
) => {
  const actor = await loadActiveActor(database, requestActor);
  validTime(now);
  const updated = await database
    .update(notifications)
    .set({ readAt: now })
    .where(and(eq(notifications.recipientUserId, actor.id), isNull(notifications.readAt)))
    .returning({ id: notifications.id });
  return { updatedCount: updated.length, readAt: now };
};
