import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gte,
  inArray,
  lte,
} from "drizzle-orm";
import {
  auditEventHostels,
  auditEvents,
  hostelMemberships,
  hostels,
  users,
} from "../db/schema.js";
import { AUDIT_CATEGORIES } from "../domain/auditEvents.js";
import { USER_ROLES } from "../domain/roles.js";
import { ApiError } from "../utils/apiErrors.js";

const operationalCategories = Object.freeze([
  AUDIT_CATEGORIES.STUDENT,
  AUDIT_CATEGORIES.ROOM,
  AUDIT_CATEGORIES.COMPLAINT,
  AUDIT_CATEGORIES.LEAVE,
  AUDIT_CATEGORIES.GATE,
  AUDIT_CATEGORIES.MESS,
  AUDIT_CATEGORIES.NOTICE,
]);
const knownCategories = new Set(Object.values(AUDIT_CATEGORIES));

const auditVisibilityByRole = Object.freeze({
  [USER_ROLES.ADMIN]: Object.freeze({ kind: "all" }),
  [USER_ROLES.WARDEN]: Object.freeze({
    kind: "hostel",
    categories: operationalCategories,
  }),
  [USER_ROLES.GUARD]: Object.freeze({
    kind: "hostel",
    categories: Object.freeze([AUDIT_CATEGORIES.GATE]),
  }),
  [USER_ROLES.MAINTENANCE]: Object.freeze({ kind: "own" }),
});

const requirePositiveInteger = (value, label) => {
  const number = Number(value);

  if (!Number.isSafeInteger(number) || number < 1) {
    throw new ApiError(400, "INVALID_AUDIT_CONTEXT", `${label} is invalid`);
  }

  return number;
};

const requireText = (value, label, maxLength) => {
  const text = typeof value === "string" ? value.trim() : "";

  if (!text || text.length > maxLength) {
    throw new ApiError(400, "INVALID_AUDIT_EVENT", `${label} is invalid`);
  }

  return text;
};

export const getAuditVisibility = (actor) => {
  const actorId = Number(actor?.id);

  if (!Number.isSafeInteger(actorId) || actorId < 1) {
    return Object.freeze({ kind: "none" });
  }

  return auditVisibilityByRole[actor.role] ?? Object.freeze({ kind: "none" });
};

export const createAuditActorSnapshot = (user) =>
  Object.freeze({
    userId: requirePositiveInteger(user?.id, "Actor ID"),
    name: requireText(user?.name, "Actor name", 255),
    email: requireText(user?.email, "Actor email", 255).toLowerCase(),
    role: requireText(user?.role, "Actor role", 50),
  });

export const loadAuditActor = async (database, actorId) => {
  const userId = requirePositiveInteger(actorId, "Actor ID");
  const [actor] = await database
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!actor) {
    throw new ApiError(
      401,
      "AUDIT_ACTOR_NOT_FOUND",
      "The authenticated account is no longer available"
    );
  }

  return createAuditActorSnapshot(actor);
};

export const loadUserHostelScopes = async (database, userId) =>
  database
    .select({ id: hostels.id, code: hostels.code })
    .from(hostelMemberships)
    .innerJoin(hostels, eq(hostelMemberships.hostelId, hostels.id))
    .where(
      eq(
        hostelMemberships.userId,
        requirePositiveInteger(userId, "User ID")
      )
    );

const normalizeHostelScopes = (assignedHostels = []) => {
  const uniqueHostels = new Map();

  for (const hostel of assignedHostels) {
    const id = requirePositiveInteger(hostel?.id, "Hostel ID");
    const code = requireText(hostel?.code, "Hostel code", 20).toUpperCase();
    uniqueHostels.set(id, Object.freeze({ id, code }));
  }

  return Object.freeze([...uniqueHostels.values()]);
};

export const appendAuditEvent = async (
  database,
  {
    actor,
    category,
    action,
    resourceType,
    resourceId,
    description,
    metadata = {},
    assignedHostels = [],
    requestId = null,
    createdAt = new Date(),
  }
) => {
  if (!metadata || Array.isArray(metadata) || typeof metadata !== "object") {
    throw new ApiError(
      400,
      "INVALID_AUDIT_EVENT",
      "Audit metadata must be an object"
    );
  }

  if (!knownCategories.has(category)) {
    throw new ApiError(
      400,
      "INVALID_AUDIT_EVENT",
      "Audit category is invalid"
    );
  }

  if (!(createdAt instanceof Date) || Number.isNaN(createdAt.getTime())) {
    throw new ApiError(
      400,
      "INVALID_AUDIT_EVENT",
      "Audit timestamp is invalid"
    );
  }

  const actorSnapshot = createAuditActorSnapshot(actor);
  const hostelScopes = normalizeHostelScopes(assignedHostels);
  const safeRequestId =
    requestId === null ? null : requireText(requestId, "Request ID", 100);
  const [event] = await database
    .insert(auditEvents)
    .values({
      actorUserId: actorSnapshot.userId,
      actorName: actorSnapshot.name,
      actorEmail: actorSnapshot.email,
      actorRole: actorSnapshot.role,
      category,
      action: requireText(action, "Action", 100),
      resourceType: requireText(resourceType, "Resource type", 100),
      resourceId: requireText(String(resourceId ?? ""), "Resource ID", 100),
      description: requireText(description, "Description", 500),
      metadata,
      requestId: safeRequestId,
      createdAt,
    })
    .returning();

  if (hostelScopes.length > 0) {
    await database.insert(auditEventHostels).values(
      hostelScopes.map((hostel) => ({
        auditEventId: event.id,
        hostelId: hostel.id,
        hostelCode: hostel.code,
      }))
    );
  }

  return Object.freeze({
    ...event,
    hostels: hostelScopes,
  });
};

const addVisibilityConditions = (database, actor, conditions) => {
  const visibility = getAuditVisibility(actor);

  if (visibility.kind === "all") {
    return;
  }

  if (visibility.kind === "own") {
    conditions.push(eq(auditEvents.actorUserId, Number(actor.id)));
    return;
  }

  if (visibility.kind === "hostel") {
    const visibleHostelEvent = database
      .select({ id: auditEventHostels.id })
      .from(auditEventHostels)
      .innerJoin(
        hostelMemberships,
        and(
          eq(hostelMemberships.hostelId, auditEventHostels.hostelId),
          eq(hostelMemberships.userId, Number(actor.id))
        )
      )
      .where(eq(auditEventHostels.auditEventId, auditEvents.id));

    conditions.push(exists(visibleHostelEvent));
    conditions.push(inArray(auditEvents.category, visibility.categories));
    return;
  }

  throw new ApiError(
    403,
    "AUDIT_ACCESS_DENIED",
    "You do not have access to audit events"
  );
};

const createAuditWhereClause = (database, actor, filters) => {
  const conditions = [];
  addVisibilityConditions(database, actor, conditions);

  if (filters.actorId) {
    conditions.push(eq(auditEvents.actorUserId, filters.actorId));
  }
  if (filters.category) {
    conditions.push(eq(auditEvents.category, filters.category));
  }
  if (filters.action) {
    conditions.push(eq(auditEvents.action, filters.action));
  }
  if (filters.resourceType) {
    conditions.push(eq(auditEvents.resourceType, filters.resourceType));
  }
  if (filters.resourceId) {
    conditions.push(eq(auditEvents.resourceId, filters.resourceId));
  }
  if (filters.from) {
    conditions.push(gte(auditEvents.createdAt, new Date(filters.from)));
  }
  if (filters.to) {
    conditions.push(lte(auditEvents.createdAt, new Date(filters.to)));
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
};

export const searchAuditEvents = async (database, actor, filters) => {
  const { page, pageSize } = filters;
  const whereClause = createAuditWhereClause(database, actor, filters);
  const baseCountQuery = database
    .select({ total: count() })
    .from(auditEvents);
  const [countResult] = whereClause
    ? await baseCountQuery.where(whereClause)
    : await baseCountQuery;
  const baseEventQuery = database.select().from(auditEvents);
  const filteredEventQuery = whereClause
    ? baseEventQuery.where(whereClause)
    : baseEventQuery;
  const events = await filteredEventQuery
    .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const eventIds = events.map((event) => event.id);
  const hostelRows = eventIds.length
    ? await database
        .select({
          auditEventId: auditEventHostels.auditEventId,
          id: auditEventHostels.hostelId,
          code: auditEventHostels.hostelCode,
        })
        .from(auditEventHostels)
        .where(inArray(auditEventHostels.auditEventId, eventIds))
        .orderBy(
          asc(auditEventHostels.auditEventId),
          asc(auditEventHostels.hostelCode)
        )
    : [];
  const hostelsByEvent = new Map();

  for (const hostel of hostelRows) {
    const eventHostels = hostelsByEvent.get(hostel.auditEventId) ?? [];
    eventHostels.push({ id: hostel.id, code: hostel.code });
    hostelsByEvent.set(hostel.auditEventId, eventHostels);
  }

  const total = Number(countResult?.total ?? 0);

  return {
    data: events.map((event) => ({
      ...event,
      hostels: hostelsByEvent.get(event.id) ?? [],
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    },
  };
};
