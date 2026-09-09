import {
  and,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
} from "drizzle-orm";
import {
  hostelBlocks,
  hostelMemberships,
  hostels,
  noticeRecipients,
  notices,
  roomAllocations,
  rooms,
  studentProfiles,
  users,
} from "../db/schema.js";
import { ACCOUNT_STATUSES } from "../domain/accountStatuses.js";
import {
  AUDIT_ACTIONS,
  AUDIT_CATEGORIES,
  AUDIT_RESOURCE_TYPES,
} from "../domain/auditEvents.js";
import {
  NOTICE_AUDIENCE_TYPES,
  NOTICE_LIST_STATES,
  NOTICE_PRIORITIES,
  NOTICE_READ_STATES,
  isNoticeActive,
} from "../domain/notices.js";
import { NOTIFICATION_EVENT_TYPES } from "../domain/notifications.js";
import { USER_ROLES } from "../domain/roles.js";
import { ApiError } from "../utils/apiErrors.js";
import { appendAuditEvent } from "./auditEventService.js";
import { appendNotifications } from "./notificationService.js";

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
    fail(400, "INVALID_NOTICE", `${label} must contain 1 to ${maxLength} characters`);
  }
  return text;
};

const loadActor = async (database, requestActor) => {
  const actorId = positiveInteger(requestActor?.id, "Actor ID");
  const [actor] = await database
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      accountStatus: users.accountStatus,
    })
    .from(users)
    .where(eq(users.id, actorId))
    .limit(1);

  if (!actor || actor.accountStatus !== ACCOUNT_STATUSES.ACTIVE) {
    fail(403, "ACCOUNT_INACTIVE", "An active account is required");
  }
  return actor;
};

const loadHostelIds = async (database, userId) => {
  const memberships = await database
    .select({ hostelId: hostelMemberships.hostelId })
    .from(hostelMemberships)
    .where(eq(hostelMemberships.userId, userId));
  return memberships.map((membership) => membership.hostelId);
};

const normalizePublishInput = (input, publishedAt) => {
  const priority = input.priority ?? NOTICE_PRIORITIES.NORMAL;
  if (!Object.values(NOTICE_PRIORITIES).includes(priority)) {
    fail(400, "INVALID_NOTICE_PRIORITY", "Select a valid notice priority");
  }

  const audience = input.audience ?? {};
  if (!Object.values(NOTICE_AUDIENCE_TYPES).includes(audience.type)) {
    fail(400, "INVALID_NOTICE_AUDIENCE", "Select a valid notice audience");
  }

  let expiresAt = null;
  if (input.expiresAt) {
    expiresAt = new Date(input.expiresAt);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= publishedAt) {
      fail(400, "INVALID_NOTICE_EXPIRY", "Notice expiry must be after publication");
    }
  }

  return {
    title: cleanText(input.title, "Title", 200),
    body: cleanText(input.body, "Body", 5000),
    priority,
    audience,
    expiresAt,
  };
};

const resolveAudience = async (database, actor, audience) => {
  if (actor.role === USER_ROLES.WARDEN && ![
    NOTICE_AUDIENCE_TYPES.HOSTEL,
    NOTICE_AUDIENCE_TYPES.BLOCK,
  ].includes(audience.type)) {
    fail(403, "NOTICE_AUDIENCE_DENIED", "Wardens can publish only to an assigned hostel or block");
  }
  if (![USER_ROLES.WARDEN, USER_ROLES.ADMIN].includes(actor.role)) {
    fail(403, "NOTICE_PUBLISH_DENIED", "Only wardens and administrators can publish notices");
  }

  const values = {
    audienceType: audience.type,
    audienceRole: null,
    hostelId: null,
    blockId: null,
  };
  let hostel = null;
  let block = null;

  if (audience.type === NOTICE_AUDIENCE_TYPES.ROLE) {
    if (!Object.values(USER_ROLES).includes(audience.role)) {
      fail(400, "INVALID_NOTICE_ROLE", "Select a valid audience role");
    }
    values.audienceRole = audience.role;
  }

  if ([NOTICE_AUDIENCE_TYPES.HOSTEL, NOTICE_AUDIENCE_TYPES.BLOCK].includes(audience.type)) {
    values.hostelId = positiveInteger(audience.hostelId, "Hostel ID");
    [hostel] = await database
      .select({ id: hostels.id, code: hostels.code, name: hostels.name })
      .from(hostels)
      .where(and(eq(hostels.id, values.hostelId), eq(hostels.isActive, true)))
      .limit(1);
    if (!hostel) fail(404, "HOSTEL_NOT_FOUND", "Active hostel not found");

    if (actor.role === USER_ROLES.WARDEN) {
      const assignedHostelIds = await loadHostelIds(database, actor.id);
      if (!assignedHostelIds.includes(values.hostelId)) {
        fail(403, "HOSTEL_ACCESS_DENIED", "This hostel is outside your assignment");
      }
    }
  }

  if (audience.type === NOTICE_AUDIENCE_TYPES.BLOCK) {
    values.blockId = positiveInteger(audience.blockId, "Block ID");
    [block] = await database
      .select({ id: hostelBlocks.id, code: hostelBlocks.code, name: hostelBlocks.name })
      .from(hostelBlocks)
      .where(
        and(
          eq(hostelBlocks.id, values.blockId),
          eq(hostelBlocks.hostelId, values.hostelId),
          eq(hostelBlocks.isActive, true)
        )
      )
      .limit(1);
    if (!block) fail(404, "HOSTEL_BLOCK_NOT_FOUND", "Active block not found in this hostel");
  }

  return { values, hostel, block };
};

const recipientIdsFor = async (database, audience) => {
  const activeAccount = eq(users.accountStatus, ACCOUNT_STATUSES.ACTIVE);

  if (audience.audienceType === NOTICE_AUDIENCE_TYPES.ALL_RESIDENTS) {
    return database
      .selectDistinct({ userId: users.id })
      .from(users)
      .innerJoin(studentProfiles, eq(studentProfiles.userId, users.id))
      .where(and(activeAccount, eq(users.role, USER_ROLES.STUDENT)));
  }
  if (audience.audienceType === NOTICE_AUDIENCE_TYPES.ROLE) {
    return database
      .selectDistinct({ userId: users.id })
      .from(users)
      .where(and(activeAccount, eq(users.role, audience.audienceRole)));
  }
  if (audience.audienceType === NOTICE_AUDIENCE_TYPES.HOSTEL) {
    return database
      .selectDistinct({ userId: users.id })
      .from(users)
      .innerJoin(hostelMemberships, eq(hostelMemberships.userId, users.id))
      .where(and(activeAccount, eq(hostelMemberships.hostelId, audience.hostelId)));
  }

  return database
    .selectDistinct({ userId: users.id })
    .from(users)
    .innerJoin(studentProfiles, eq(studentProfiles.userId, users.id))
    .innerJoin(
      roomAllocations,
      and(
        eq(roomAllocations.studentProfileId, studentProfiles.id),
        isNull(roomAllocations.vacatedAt)
      )
    )
    .innerJoin(rooms, eq(rooms.id, roomAllocations.roomId))
    .where(
      and(
        activeAccount,
        eq(users.role, USER_ROLES.STUDENT),
        eq(studentProfiles.hostelId, audience.hostelId),
        eq(rooms.blockId, audience.blockId)
      )
    );
};

const noticeSelection = {
  id: notices.id,
  publishedByUserId: notices.publishedByUserId,
  publisherName: users.name,
  title: notices.title,
  body: notices.body,
  priority: notices.priority,
  audienceType: notices.audienceType,
  audienceRole: notices.audienceRole,
  hostelId: notices.hostelId,
  hostelCode: hostels.code,
  hostelName: hostels.name,
  blockId: notices.blockId,
  blockCode: hostelBlocks.code,
  blockName: hostelBlocks.name,
  publishedAt: notices.publishedAt,
  expiresAt: notices.expiresAt,
};

const baseNoticeQuery = (database) => database
  .select(noticeSelection)
  .from(notices)
  .innerJoin(users, eq(notices.publishedByUserId, users.id))
  .leftJoin(hostels, eq(notices.hostelId, hostels.id))
  .leftJoin(hostelBlocks, eq(notices.blockId, hostelBlocks.id));

const formatNotice = (notice, now, extra = {}) => ({
  id: notice.id,
  title: notice.title,
  body: notice.body,
  priority: notice.priority,
  audience: {
    type: notice.audienceType,
    role: notice.audienceRole,
    hostel: notice.hostelId
      ? { id: notice.hostelId, code: notice.hostelCode, name: notice.hostelName }
      : null,
    block: notice.blockId
      ? { id: notice.blockId, code: notice.blockCode, name: notice.blockName }
      : null,
  },
  publisher: { id: notice.publishedByUserId, name: notice.publisherName },
  publishedAt: notice.publishedAt,
  expiresAt: notice.expiresAt,
  isActive: isNoticeActive(notice, now),
  ...extra,
});

const pagination = (data, total, page, pageSize) => ({
  data,
  pagination: {
    page,
    pageSize,
    total: Number(total),
    totalPages: Number(total) === 0 ? 0 : Math.ceil(Number(total) / pageSize),
  },
});

const activeConditions = (now) => [
  lte(notices.publishedAt, now),
  or(isNull(notices.expiresAt), gt(notices.expiresAt, now)),
];

const addNoticeState = (conditions, state, now) => {
  if (state === NOTICE_LIST_STATES.ACTIVE) conditions.push(...activeConditions(now));
  if (state === NOTICE_LIST_STATES.EXPIRED) {
    conditions.push(isNotNull(notices.expiresAt), lte(notices.expiresAt, now));
  }
};

export const publishNotice = async (
  database,
  requestActor,
  input,
  { now = new Date() } = {}
) => {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    fail(400, "INVALID_REQUEST", "Publication timestamp is invalid");
  }
  const actor = await loadActor(database, requestActor);
  const values = normalizePublishInput(input, now);
  const target = await resolveAudience(database, actor, values.audience);

  return database.transaction(async (transaction) => {
    const [created] = await transaction
      .insert(notices)
      .values({
        publishedByUserId: actor.id,
        title: values.title.length > 160
          ? `${values.title.slice(0, 157)}...`
          : values.title,
        body: values.body,
        priority: values.priority,
        ...target.values,
        publishedAt: now,
        expiresAt: values.expiresAt,
      })
      .returning({ id: notices.id });

    const recipients = await recipientIdsFor(transaction, target.values);
    if (recipients.length > 0) {
      await transaction.insert(noticeRecipients).values(
        recipients.map(({ userId }) => ({
          noticeId: created.id,
          userId,
          createdAt: now,
        }))
      );
    }

    await appendAuditEvent(transaction, {
      actor,
      category: AUDIT_CATEGORIES.NOTICE,
      action: AUDIT_ACTIONS.NOTICE_PUBLISHED,
      resourceType: AUDIT_RESOURCE_TYPES.NOTICE,
      resourceId: created.id,
      description: `Published notice: ${values.title}`,
      metadata: {
        audienceType: target.values.audienceType,
        audienceRole: target.values.audienceRole,
        recipientCount: recipients.length,
        priority: values.priority,
      },
      assignedHostels: target.hostel ? [target.hostel] : [],
      createdAt: now,
    });

    if ([NOTICE_PRIORITIES.IMPORTANT, NOTICE_PRIORITIES.URGENT].includes(values.priority)) {
      await appendNotifications(transaction, {
        recipientUserIds: recipients.map((recipient) => recipient.userId),
        eventType: NOTIFICATION_EVENT_TYPES.IMPORTANT_NOTICE,
        title: values.title,
        message: values.body.length > 180
          ? `${values.body.slice(0, 177)}...`
          : values.body,
        resourceId: created.id,
        dedupeKey: `notice:${created.id}:important`,
        metadata: { priority: values.priority },
        createdAt: now,
      });
    }

    const [notice] = await baseNoticeQuery(transaction)
      .where(eq(notices.id, created.id))
      .limit(1);
    return formatNotice(notice, now, { recipientCount: recipients.length });
  });
};

const normalizeList = (input, defaultState) => ({
  page: positiveInteger(input.page ?? 1, "Page"),
  pageSize: Math.min(50, positiveInteger(input.pageSize ?? 10, "Page size")),
  state: input.state ?? defaultState,
  readState: input.readState ?? NOTICE_READ_STATES.ALL,
  priority: input.priority,
  audienceType: input.audienceType,
  hostelId: input.hostelId ? positiveInteger(input.hostelId, "Hostel ID") : null,
});

const validateList = (filters) => {
  if (!Object.values(NOTICE_LIST_STATES).includes(filters.state)) {
    fail(400, "INVALID_NOTICE_STATE", "Select a valid notice state");
  }
  if (!Object.values(NOTICE_READ_STATES).includes(filters.readState)) {
    fail(400, "INVALID_NOTICE_READ_STATE", "Select a valid read state");
  }
  if (filters.priority && !Object.values(NOTICE_PRIORITIES).includes(filters.priority)) {
    fail(400, "INVALID_NOTICE_PRIORITY", "Select a valid notice priority");
  }
  if (
    filters.audienceType &&
    !Object.values(NOTICE_AUDIENCE_TYPES).includes(filters.audienceType)
  ) {
    fail(400, "INVALID_NOTICE_AUDIENCE", "Select a valid notice audience");
  }
  return filters;
};

export const listMyNotices = async (
  database,
  requestActor,
  input = {},
  { now = new Date() } = {}
) => {
  const actor = await loadActor(database, requestActor);
  const filters = validateList(normalizeList(input, NOTICE_LIST_STATES.ACTIVE));
  const conditions = [eq(noticeRecipients.userId, actor.id)];
  addNoticeState(conditions, filters.state, now);
  if (filters.priority) conditions.push(eq(notices.priority, filters.priority));
  if (filters.readState === NOTICE_READ_STATES.READ) conditions.push(isNotNull(noticeRecipients.readAt));
  if (filters.readState === NOTICE_READ_STATES.UNREAD) conditions.push(isNull(noticeRecipients.readAt));
  const where = and(...conditions);

  const [totalRow] = await database
    .select({ total: count() })
    .from(noticeRecipients)
    .innerJoin(notices, eq(noticeRecipients.noticeId, notices.id))
    .where(where);
  const rows = await database
    .select({ ...noticeSelection, readAt: noticeRecipients.readAt })
    .from(noticeRecipients)
    .innerJoin(notices, eq(noticeRecipients.noticeId, notices.id))
    .innerJoin(users, eq(notices.publishedByUserId, users.id))
    .leftJoin(hostels, eq(notices.hostelId, hostels.id))
    .leftJoin(hostelBlocks, eq(notices.blockId, hostelBlocks.id))
    .where(where)
    .orderBy(desc(notices.publishedAt), desc(notices.id))
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize);

  return pagination(
    rows.map((notice) => formatNotice(notice, now, {
      isRead: Boolean(notice.readAt),
      readAt: notice.readAt,
    })),
    totalRow.total,
    filters.page,
    filters.pageSize
  );
};

export const getUnreadNoticeCount = async (
  database,
  requestActor,
  { now = new Date() } = {}
) => {
  const actor = await loadActor(database, requestActor);
  const [row] = await database
    .select({ total: count() })
    .from(noticeRecipients)
    .innerJoin(notices, eq(noticeRecipients.noticeId, notices.id))
    .where(
      and(
        eq(noticeRecipients.userId, actor.id),
        isNull(noticeRecipients.readAt),
        ...activeConditions(now)
      )
    );
  return { unreadCount: Number(row.total) };
};

export const markNoticeRead = async (
  database,
  requestActor,
  noticeId,
  { now = new Date() } = {}
) => {
  const id = positiveInteger(noticeId, "Notice ID");
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    fail(400, "INVALID_REQUEST", "Read timestamp is invalid");
  }
  const actor = await loadActor(database, requestActor);
  const [recipient] = await database
    .select({ id: noticeRecipients.id, readAt: noticeRecipients.readAt })
    .from(noticeRecipients)
    .where(and(eq(noticeRecipients.noticeId, id), eq(noticeRecipients.userId, actor.id)))
    .limit(1);
  if (!recipient) fail(404, "NOTICE_NOT_FOUND", "Notice not found");
  if (recipient.readAt) return { noticeId: id, isRead: true, readAt: recipient.readAt };

  const [updated] = await database
    .update(noticeRecipients)
    .set({ readAt: now })
    .where(and(eq(noticeRecipients.id, recipient.id), isNull(noticeRecipients.readAt)))
    .returning({ readAt: noticeRecipients.readAt });
  return { noticeId: id, isRead: true, readAt: updated?.readAt ?? now };
};

export const listManagedNotices = async (
  database,
  requestActor,
  input = {},
  { now = new Date() } = {}
) => {
  const actor = await loadActor(database, requestActor);
  if (![USER_ROLES.WARDEN, USER_ROLES.ADMIN].includes(actor.role)) {
    fail(403, "NOTICE_MANAGE_DENIED", "Only wardens and administrators can manage notices");
  }
  const filters = validateList(normalizeList(input, NOTICE_LIST_STATES.ALL));
  const conditions = [];
  const assignedHostelIds = actor.role === USER_ROLES.WARDEN
    ? await loadHostelIds(database, actor.id)
    : null;

  if (assignedHostelIds) {
    conditions.push(
      assignedHostelIds.length > 0
        ? or(eq(notices.publishedByUserId, actor.id), inArray(notices.hostelId, assignedHostelIds))
        : eq(notices.publishedByUserId, actor.id)
    );
    if (filters.hostelId && !assignedHostelIds.includes(filters.hostelId)) {
      fail(403, "HOSTEL_ACCESS_DENIED", "This hostel is outside your assignment");
    }
  }
  if (filters.hostelId) conditions.push(eq(notices.hostelId, filters.hostelId));
  if (filters.priority) conditions.push(eq(notices.priority, filters.priority));
  if (filters.audienceType) conditions.push(eq(notices.audienceType, filters.audienceType));
  addNoticeState(conditions, filters.state, now);
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const countQuery = database.select({ total: count() }).from(notices);
  const [totalRow] = where ? await countQuery.where(where) : await countQuery;
  const query = baseNoticeQuery(database);
  const rows = await (where ? query.where(where) : query)
    .orderBy(desc(notices.publishedAt), desc(notices.id))
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize);

  const ids = rows.map((notice) => notice.id);
  const countRows = ids.length > 0
    ? await database
        .select({ noticeId: noticeRecipients.noticeId, total: count() })
        .from(noticeRecipients)
        .where(inArray(noticeRecipients.noticeId, ids))
        .groupBy(noticeRecipients.noticeId)
    : [];
  const recipientCounts = new Map(countRows.map((row) => [row.noticeId, Number(row.total)]));

  return pagination(
    rows.map((notice) => formatNotice(notice, now, {
      recipientCount: recipientCounts.get(notice.id) ?? 0,
    })),
    totalRow.total,
    filters.page,
    filters.pageSize
  );
};
