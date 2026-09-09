import {
  and,
  count,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  or,
} from "drizzle-orm";
import {
  hostelBlocks,
  hostelMemberships,
  hostels,
  leaveDecisions,
  leaveRequests,
  roomAllocations,
  rooms,
  studentProfiles,
  users,
} from "../db/schema.js";
import { ACCOUNT_STATUSES } from "../domain/accountStatuses.js";
import { LEAVE_STATUSES } from "../domain/leaveWorkflow.js";
import { USER_ROLES } from "../domain/roles.js";
import { ApiError } from "../utils/apiErrors.js";

const reviewRoles = new Set([USER_ROLES.WARDEN, USER_ROLES.ADMIN]);
const knownStatuses = new Set(Object.values(LEAVE_STATUSES));
const activeStatuses = Object.freeze([
  LEAVE_STATUSES.PENDING,
  LEAVE_STATUSES.APPROVED,
  LEAVE_STATUSES.EXITED,
]);

const fail = (status, code, message) => {
  throw new ApiError(status, code, message);
};

const requireActorId = (value) => {
  const id = Number(value);

  if (!Number.isSafeInteger(id) || id < 1) {
    fail(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  }

  return id;
};

export const normalizeLeaveReviewFilters = (input = {}) => {
  const page = Number(input.page ?? 1);
  const pageSize = Number(input.pageSize ?? 15);
  const status =
    typeof input.status === "string" ? input.status.trim().toLowerCase() : "pending";
  const search = typeof input.search === "string" ? input.search.trim() : "";

  if (!Number.isSafeInteger(page) || page < 1) {
    fail(400, "INVALID_PAGE", "Page must be a positive integer");
  }
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 50) {
    fail(400, "INVALID_PAGE_SIZE", "Page size must be between 1 and 50");
  }
  if (status !== "all" && !knownStatuses.has(status)) {
    fail(400, "INVALID_LEAVE_STATUS", "Leave status is invalid");
  }
  if (search.length > 100) {
    fail(400, "INVALID_SEARCH", "Search must not exceed 100 characters");
  }

  return Object.freeze({
    page,
    pageSize,
    status: status === "all" ? null : status,
    search,
  });
};

const loadReviewActor = async (database, requestActor) => {
  const actorId = requireActorId(requestActor?.id);
  const [actor] = await database
    .select({
      id: users.id,
      role: users.role,
      accountStatus: users.accountStatus,
    })
    .from(users)
    .where(eq(users.id, actorId))
    .limit(1);

  if (
    !actor ||
    !reviewRoles.has(actor.role) ||
    actor.role !== requestActor.role
  ) {
    fail(403, "LEAVE_REVIEW_DENIED", "You cannot review leave requests");
  }
  if (actor.accountStatus !== ACCOUNT_STATUSES.ACTIVE) {
    fail(
      403,
      "STAFF_ACCOUNT_INACTIVE",
      "Only active staff can review leave requests"
    );
  }

  return actor;
};

const buildReviewConditions = (database, actor, filters) => {
  const conditions = [];

  if (actor.role === USER_ROLES.WARDEN) {
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
  }
  if (filters.status) {
    conditions.push(eq(leaveRequests.status, filters.status));
  }
  if (filters.search) {
    const pattern = `%${filters.search}%`;
    conditions.push(
      or(
        ilike(users.name, pattern),
        ilike(users.email, pattern),
        ilike(studentProfiles.rollNo, pattern),
        ilike(leaveRequests.reason, pattern)
      )
    );
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
};

const getOtherActiveRequests = async (database, records) => {
  const studentIds = [...new Set(records.map((record) => record.studentUserId))];

  if (studentIds.length === 0) return [];

  return database
    .select({
      id: leaveRequests.id,
      studentUserId: leaveRequests.studentUserId,
      status: leaveRequests.status,
      departureAt: leaveRequests.departureAt,
      expectedReturnAt: leaveRequests.expectedReturnAt,
    })
    .from(leaveRequests)
    .where(
      and(
        inArray(leaveRequests.studentUserId, studentIds),
        inArray(leaveRequests.status, activeStatuses)
      )
    )
    .orderBy(desc(leaveRequests.createdAt));
};

const rangesOverlap = (first, second) =>
  new Date(first.departureAt) < new Date(second.expectedReturnAt) &&
  new Date(first.expectedReturnAt) > new Date(second.departureAt);

const toReviewRecord = (record, activeRequests) => {
  const relatedActiveRequests = activeRequests
    .filter(
      (request) =>
        request.studentUserId === record.studentUserId &&
        request.id !== record.id
    )
    .map((request) => ({
      id: request.id,
      status: request.status,
      departureAt: request.departureAt,
      expectedReturnAt: request.expectedReturnAt,
      overlapsSchedule: rangesOverlap(record, request),
    }));

  return {
    id: record.id,
    reason: record.reason,
    departureAt: record.departureAt,
    expectedReturnAt: record.expectedReturnAt,
    isEmergency: record.isEmergency,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    student: {
      userId: record.studentUserId,
      name: record.studentName,
      email: record.studentEmail,
      rollNo: record.studentRollNo,
    },
    hostel: {
      id: record.hostelId,
      code: record.hostelCode,
      name: record.hostelName,
    },
    room: record.roomNumber
      ? {
          blockCode: record.blockCode,
          roomNumber: record.roomNumber,
          label: `${record.blockCode}-${record.roomNumber}`,
        }
      : null,
    decision: record.decisionId
      ? {
          id: record.decisionId,
          outcome: record.decisionOutcome,
          note: record.decisionNote,
          decidedAt: record.decidedAt,
          actorName: record.decisionActorName,
          actorRole: record.decisionActorRole,
        }
      : null,
    reviewWarnings: {
      hasOverlap: relatedActiveRequests.some(
        (request) => request.overlapsSchedule
      ),
      activeRequests: relatedActiveRequests,
    },
  };
};

export const listLeaveRequestsForReview = async (
  database,
  requestActor,
  input = {}
) => {
  const filters = normalizeLeaveReviewFilters(input);
  const actor = await loadReviewActor(database, requestActor);
  const whereClause = buildReviewConditions(database, actor, filters);
  const [totalRow] = await database
    .select({ total: count() })
    .from(leaveRequests)
    .innerJoin(users, eq(leaveRequests.studentUserId, users.id))
    .innerJoin(
      studentProfiles,
      eq(leaveRequests.studentProfileId, studentProfiles.id)
    )
    .where(whereClause);
  const records = await database
    .select({
      id: leaveRequests.id,
      reason: leaveRequests.reason,
      departureAt: leaveRequests.departureAt,
      expectedReturnAt: leaveRequests.expectedReturnAt,
      isEmergency: leaveRequests.isEmergency,
      status: leaveRequests.status,
      createdAt: leaveRequests.createdAt,
      updatedAt: leaveRequests.updatedAt,
      studentUserId: users.id,
      studentName: users.name,
      studentEmail: users.email,
      studentRollNo: studentProfiles.rollNo,
      hostelId: hostels.id,
      hostelCode: hostels.code,
      hostelName: hostels.name,
      blockCode: hostelBlocks.code,
      roomNumber: rooms.roomNumber,
      decisionId: leaveDecisions.id,
      decisionOutcome: leaveDecisions.outcome,
      decisionNote: leaveDecisions.note,
      decidedAt: leaveDecisions.decidedAt,
      decisionActorName: leaveDecisions.actorName,
      decisionActorRole: leaveDecisions.actorRole,
    })
    .from(leaveRequests)
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
    .leftJoin(hostelBlocks, eq(rooms.blockId, hostelBlocks.id))
    .leftJoin(
      leaveDecisions,
      eq(leaveDecisions.leaveRequestId, leaveRequests.id)
    )
    .where(whereClause)
    .orderBy(
      desc(leaveRequests.isEmergency),
      desc(leaveRequests.createdAt),
      desc(leaveRequests.id)
    )
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize);
  const activeRequests = await getOtherActiveRequests(database, records);
  const total = Number(totalRow?.total ?? 0);

  return {
    data: records.map((record) => toReviewRecord(record, activeRequests)),
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / filters.pageSize),
    },
  };
};
