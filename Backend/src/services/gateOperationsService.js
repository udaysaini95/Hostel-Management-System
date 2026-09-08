import {
  and,
  count,
  desc,
  eq,
  exists,
  gte,
  ilike,
  lte,
  lt,
  or,
  sql,
} from "drizzle-orm";
import {
  gateEvents,
  gatePasses,
  hostelBlocks,
  hostelMemberships,
  hostels,
  leaveEvents,
  leaveRequests,
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
  GATE_VERIFICATION_METHODS,
  LEAVE_EVENT_TYPES,
  LEAVE_STATUSES,
} from "../domain/leaveWorkflow.js";
import { USER_ROLES } from "../domain/roles.js";
import { ApiError } from "../utils/apiErrors.js";
import { appendAuditEvent } from "./auditEventService.js";

const activityRoles = new Set([
  USER_ROLES.WARDEN,
  USER_ROLES.GUARD,
  USER_ROLES.ADMIN,
]);
const exceptionRoles = new Set([USER_ROLES.WARDEN, USER_ROLES.ADMIN]);

const fail = (status, code, message) => {
  throw new ApiError(status, code, message);
};

const normalizePage = (input = {}) => {
  const page = Number(input.page ?? 1);
  const pageSize = Number(input.pageSize ?? 20);

  if (!Number.isSafeInteger(page) || page < 1) {
    fail(400, "INVALID_PAGE", "Page must be a positive integer");
  }
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    fail(400, "INVALID_PAGE_SIZE", "Page size must be between 1 and 100");
  }

  return { page, pageSize };
};

const normalizeCode = (value) =>
  typeof value === "string" ? value.trim().toUpperCase() : "";

export const loadGateOperationsActor = async (
  database,
  requestActor,
  { manageExceptions = false } = {}
) => {
  const actorId = Number(requestActor?.id);

  if (!Number.isSafeInteger(actorId) || actorId < 1) {
    fail(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  }

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
  const allowedRoles = manageExceptions ? exceptionRoles : activityRoles;

  if (
    !actor ||
    actor.accountStatus !== ACCOUNT_STATUSES.ACTIVE ||
    actor.role !== requestActor.role ||
    !allowedRoles.has(actor.role)
  ) {
    fail(
      403,
      manageExceptions ? "GATE_EXCEPTION_ACCESS_DENIED" : "GATE_ACTIVITY_ACCESS_DENIED",
      manageExceptions
        ? "Only active wardens and administrators can manage gate exceptions"
        : "You do not have access to gate activity"
    );
  }

  return actor;
};

const addHostelScope = (database, actor, conditions) => {
  if (actor.role === USER_ROLES.ADMIN) return;

  const assignedHostel = database
    .select({ id: hostelMemberships.id })
    .from(hostelMemberships)
    .where(
      and(
        eq(hostelMemberships.userId, actor.id),
        eq(hostelMemberships.hostelId, leaveRequests.hostelId)
      )
    );
  conditions.push(exists(assignedHostel));
};

const addCommonFilters = (conditions, filters) => {
  if (filters.hostelCode) {
    conditions.push(eq(hostels.code, filters.hostelCode));
  }
  if (filters.search) {
    const pattern = `%${filters.search}%`;
    conditions.push(
      or(
        ilike(users.name, pattern),
        ilike(studentProfiles.rollNo, pattern),
        ilike(rooms.roomNumber, pattern)
      )
    );
  }
};

const addGateActivityJoins = (query) =>
  query
    .innerJoin(leaveRequests, eq(gateEvents.leaveRequestId, leaveRequests.id))
    .innerJoin(users, eq(leaveRequests.studentUserId, users.id))
    .innerJoin(
      studentProfiles,
      eq(leaveRequests.studentProfileId, studentProfiles.id)
    )
    .innerJoin(hostels, eq(leaveRequests.hostelId, hostels.id))
    .leftJoin(
      roomAllocations,
      eq(leaveRequests.roomAllocationId, roomAllocations.id)
    )
    .leftJoin(rooms, eq(roomAllocations.roomId, rooms.id))
    .leftJoin(hostelBlocks, eq(rooms.blockId, hostelBlocks.id));

const paginationFor = (filters, total) => ({
  page: filters.page,
  pageSize: filters.pageSize,
  total,
  totalPages: total === 0 ? 0 : Math.ceil(total / filters.pageSize),
});

export const normalizeOutsideRosterFilters = (input = {}) => {
  const paging = normalizePage(input);
  const search = typeof input.search === "string" ? input.search.trim() : "";
  const hostelCode = normalizeCode(input.hostelCode);

  return Object.freeze({
    ...paging,
    search: search || null,
    hostelCode: hostelCode || null,
    overdue: typeof input.overdue === "boolean" ? input.overdue : null,
  });
};

export const getOutsideRoster = async (
  database,
  requestActor,
  input = {},
  { now = new Date() } = {}
) => {
  const filters = normalizeOutsideRosterFilters(input);
  const actor = await loadGateOperationsActor(database, requestActor);
  const conditions = [
    eq(leaveRequests.status, LEAVE_STATUSES.EXITED),
    eq(gateEvents.movement, "exit"),
  ];
  addHostelScope(database, actor, conditions);
  addCommonFilters(conditions, filters);

  if (filters.overdue === true) {
    conditions.push(lt(leaveRequests.expectedReturnAt, now));
  } else if (filters.overdue === false) {
    conditions.push(gte(leaveRequests.expectedReturnAt, now));
  }

  const whereClause = and(...conditions);
  const [countResult] = await addGateActivityJoins(
    database.select({ total: count() }).from(gateEvents)
  ).where(whereClause);
  const records = await addGateActivityJoins(
    database
      .select({
        leaveRequestId: leaveRequests.id,
        reason: leaveRequests.reason,
        departedAt: gateEvents.occurredAt,
        expectedReturnAt: leaveRequests.expectedReturnAt,
        studentId: users.id,
        studentName: users.name,
        rollNo: studentProfiles.rollNo,
        hostelId: hostels.id,
        hostelCode: hostels.code,
        hostelName: hostels.name,
        blockCode: hostelBlocks.code,
        roomNumber: rooms.roomNumber,
      })
      .from(gateEvents)
  )
    .where(whereClause)
    .orderBy(desc(gateEvents.occurredAt), desc(gateEvents.id))
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize);
  const total = Number(countResult?.total ?? 0);

  return {
    data: records.map((record) => ({
      leaveRequestId: record.leaveRequestId,
      reason: record.reason,
      departedAt: record.departedAt,
      expectedReturnAt: record.expectedReturnAt,
      overdue: record.expectedReturnAt.getTime() < now.getTime(),
      student: {
        id: record.studentId,
        name: record.studentName,
        rollNo: record.rollNo,
        room: record.roomNumber
          ? { blockCode: record.blockCode, roomNumber: record.roomNumber }
          : null,
      },
      hostel: {
        id: record.hostelId,
        code: record.hostelCode,
        name: record.hostelName,
      },
    })),
    pagination: paginationFor(filters, total),
    generatedAt: now,
  };
};

export const normalizeMovementHistoryFilters = (input = {}) => {
  const paging = normalizePage(input);
  const search = typeof input.search === "string" ? input.search.trim() : "";

  return Object.freeze({
    ...paging,
    search: search || null,
    hostelCode: normalizeCode(input.hostelCode) || null,
    movement: input.movement || null,
    overrideOnly:
      typeof input.overrideOnly === "boolean" ? input.overrideOnly : null,
    from: input.from ? new Date(input.from) : null,
    to: input.to ? new Date(input.to) : null,
  });
};

export const getGateMovementHistory = async (
  database,
  requestActor,
  input = {}
) => {
  const filters = normalizeMovementHistoryFilters(input);
  const actor = await loadGateOperationsActor(database, requestActor);
  const conditions = [];
  addHostelScope(database, actor, conditions);
  addCommonFilters(conditions, filters);

  if (filters.movement) {
    conditions.push(eq(gateEvents.movement, filters.movement));
  }
  if (filters.overrideOnly === true) {
    conditions.push(
      eq(gateEvents.verificationMethod, GATE_VERIFICATION_METHODS.OVERRIDE)
    );
  } else if (filters.overrideOnly === false) {
    conditions.push(
      sql`${gateEvents.verificationMethod} <> ${GATE_VERIFICATION_METHODS.OVERRIDE}`
    );
  }
  if (filters.from) conditions.push(gte(gateEvents.occurredAt, filters.from));
  if (filters.to) conditions.push(lte(gateEvents.occurredAt, filters.to));

  const whereClause = conditions.length ? and(...conditions) : undefined;
  const [countResult] = await addGateActivityJoins(
    database.select({ total: count() }).from(gateEvents)
  ).where(whereClause);
  const records = await addGateActivityJoins(
    database
      .select({
        id: gateEvents.id,
        leaveRequestId: leaveRequests.id,
        movement: gateEvents.movement,
        verificationMethod: gateEvents.verificationMethod,
        occurredAt: gateEvents.occurredAt,
        note: gateEvents.note,
        actorId: gateEvents.performedByUserId,
        actorName: gateEvents.actorName,
        actorRole: gateEvents.actorRole,
        studentId: users.id,
        studentName: users.name,
        rollNo: studentProfiles.rollNo,
        hostelId: hostels.id,
        hostelCode: hostels.code,
        hostelName: hostels.name,
        blockCode: hostelBlocks.code,
        roomNumber: rooms.roomNumber,
      })
      .from(gateEvents)
  )
    .where(whereClause)
    .orderBy(desc(gateEvents.occurredAt), desc(gateEvents.id))
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize);
  const total = Number(countResult?.total ?? 0);

  return {
    data: records.map((record) => ({
      id: record.id,
      leaveRequestId: record.leaveRequestId,
      movement: record.movement,
      verificationMethod: record.verificationMethod,
      isOverride:
        record.verificationMethod === GATE_VERIFICATION_METHODS.OVERRIDE,
      occurredAt: record.occurredAt,
      note: record.note,
      actor: {
        id: record.actorId,
        name: record.actorName,
        role: record.actorRole,
      },
      student: {
        id: record.studentId,
        name: record.studentName,
        rollNo: record.rollNo,
        room: record.roomNumber
          ? { blockCode: record.blockCode, roomNumber: record.roomNumber }
          : null,
      },
      hostel: {
        id: record.hostelId,
        code: record.hostelCode,
        name: record.hostelName,
      },
    })),
    pagination: paginationFor(filters, total),
  };
};

export const expireUnusedGatePasses = async (
  database,
  requestActor,
  input = {},
  { now = new Date() } = {}
) => {
  const hostelCode = normalizeCode(input.hostelCode);
  const limit = Number(input.limit ?? 100);

  return database.transaction(async (transaction) => {
    const actor = await loadGateOperationsActor(transaction, requestActor, {
      manageExceptions: true,
    });
    const conditions = [
      eq(leaveRequests.status, LEAVE_STATUSES.APPROVED),
      lte(gatePasses.expiresAt, now),
    ];
    addHostelScope(transaction, actor, conditions);
    if (hostelCode) conditions.push(eq(hostels.code, hostelCode));

    const expired = await transaction
      .select({
        gatePassId: gatePasses.id,
        leaveRequestId: leaveRequests.id,
        hostelId: hostels.id,
        hostelCode: hostels.code,
        rollNo: studentProfiles.rollNo,
        expiresAt: gatePasses.expiresAt,
      })
      .from(gatePasses)
      .innerJoin(leaveRequests, eq(gatePasses.leaveRequestId, leaveRequests.id))
      .innerJoin(
        studentProfiles,
        eq(leaveRequests.studentProfileId, studentProfiles.id)
      )
      .innerJoin(hostels, eq(leaveRequests.hostelId, hostels.id))
      .where(and(...conditions))
      .orderBy(gatePasses.expiresAt, gatePasses.id)
      .limit(limit)
      .for("update", { of: leaveRequests, skipLocked: true });

    for (const pass of expired) {
      await transaction
        .update(leaveRequests)
        .set({ status: LEAVE_STATUSES.EXPIRED, updatedAt: now })
        .where(eq(leaveRequests.id, pass.leaveRequestId));

      await transaction.insert(leaveEvents).values({
        leaveRequestId: pass.leaveRequestId,
        eventType: LEAVE_EVENT_TYPES.EXPIRED,
        fromStatus: LEAVE_STATUSES.APPROVED,
        toStatus: LEAVE_STATUSES.EXPIRED,
        actorUserId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        note: "Unused gate pass expired",
        metadata: { gatePassId: pass.gatePassId, expiresAt: pass.expiresAt },
        occurredAt: now,
      });

      await appendAuditEvent(transaction, {
        actor,
        category: AUDIT_CATEGORIES.GATE,
        action: AUDIT_ACTIONS.GATE_PASS_EXPIRED,
        resourceType: AUDIT_RESOURCE_TYPES.GATE_PASS,
        resourceId: pass.gatePassId,
        description: "Expired an unused gate pass",
        metadata: {
          leaveRequestId: pass.leaveRequestId,
          studentRollNo: pass.rollNo,
          expiresAt: pass.expiresAt,
        },
        assignedHostels: [{ id: pass.hostelId, code: pass.hostelCode }],
        createdAt: now,
      });
    }

    return { expiredCount: expired.length, processedAt: now };
  });
};
