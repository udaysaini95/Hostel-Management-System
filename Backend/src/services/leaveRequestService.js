import {
  and,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lt,
  sql,
} from "drizzle-orm";
import {
  hostelBlocks,
  gatePasses,
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
  LEAVE_EVENT_TYPES,
  LEAVE_STATUSES,
} from "../domain/leaveWorkflow.js";
import { USER_ROLES } from "../domain/roles.js";
import { ApiError } from "../utils/apiErrors.js";
import { appendAuditEvent } from "./auditEventService.js";

const activeLeaveStatuses = Object.freeze([
  LEAVE_STATUSES.PENDING,
  LEAVE_STATUSES.APPROVED,
  LEAVE_STATUSES.EXITED,
]);
const knownLeaveStatuses = new Set(Object.values(LEAVE_STATUSES));

const fail = (status, code, message) => {
  throw new ApiError(status, code, message);
};

const requireActorId = (value) => {
  const actorId = Number(value);

  if (!Number.isSafeInteger(actorId) || actorId < 1) {
    fail(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  }

  return actorId;
};

const requireOperationTime = (value) => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    fail(400, "INVALID_REQUEST", "Operation timestamp is invalid");
  }

  return value;
};

export const normalizeStudentLeaveFilters = (input = {}) => {
  const page = Number(input.page ?? 1);
  const pageSize = Number(input.pageSize ?? 10);
  const status = typeof input.status === "string" ? input.status.trim() : "";

  if (!Number.isSafeInteger(page) || page < 1) {
    fail(400, "INVALID_PAGE", "Page must be a positive integer");
  }
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 50) {
    fail(400, "INVALID_PAGE_SIZE", "Page size must be between 1 and 50");
  }
  if (status && !knownLeaveStatuses.has(status)) {
    fail(400, "INVALID_LEAVE_STATUS", "Leave status is invalid");
  }

  return Object.freeze({ page, pageSize, status: status || null });
};

const parseTimestamp = (value, label) => {
  const timestamp = value instanceof Date ? new Date(value) : new Date(value);

  if (Number.isNaN(timestamp.getTime())) {
    fail(400, "INVALID_LEAVE_DATES", `${label} is invalid`);
  }

  return timestamp;
};

export const normalizeLeaveRequestInput = (input = {}, { now = new Date() } = {}) => {
  const createdAt = requireOperationTime(now);
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  const departureAt = parseTimestamp(input.departureAt, "Departure time");
  const expectedReturnAt = parseTimestamp(
    input.expectedReturnAt,
    "Expected return time"
  );

  if (reason.length < 5 || reason.length > 1000) {
    fail(
      400,
      "INVALID_LEAVE_REASON",
      "Reason must contain between 5 and 1000 characters"
    );
  }
  if (input.isEmergency !== undefined && typeof input.isEmergency !== "boolean") {
    fail(
      400,
      "INVALID_EMERGENCY_FLAG",
      "Emergency flag must be true or false"
    );
  }
  if (departureAt <= createdAt) {
    fail(
      422,
      "PAST_DEPARTURE_TIME",
      "Departure time must be in the future"
    );
  }
  if (expectedReturnAt <= departureAt) {
    fail(
      422,
      "INVALID_LEAVE_DATE_RANGE",
      "Expected return time must be after departure time"
    );
  }

  return Object.freeze({
    reason,
    departureAt,
    expectedReturnAt,
    isEmergency: input.isEmergency ?? false,
    createdAt,
  });
};

const loadStudentActor = async (transaction, requestActor) => {
  const actorId = requireActorId(requestActor?.id);
  const [actor] = await transaction
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      accountStatus: users.accountStatus,
    })
    .from(users)
    .where(eq(users.id, actorId))
    .for("update")
    .limit(1);

  if (!actor || actor.role !== USER_ROLES.STUDENT) {
    fail(
      403,
      "LEAVE_CREATE_DENIED",
      "Only a student account can submit a leave request"
    );
  }
  if (actor.accountStatus !== ACCOUNT_STATUSES.ACTIVE) {
    fail(
      403,
      "STUDENT_ACCOUNT_INACTIVE",
      "Only an active student account can submit a leave request"
    );
  }

  return Object.freeze(actor);
};

const loadStudentContext = async (transaction, actorId) => {
  const [profile] = await transaction
    .select({
      id: studentProfiles.id,
      rollNo: studentProfiles.rollNo,
      hostelId: hostels.id,
      hostelCode: hostels.code,
      hostelName: hostels.name,
      hostelIsActive: hostels.isActive,
    })
    .from(studentProfiles)
    .innerJoin(hostels, eq(studentProfiles.hostelId, hostels.id))
    .where(eq(studentProfiles.userId, actorId))
    .limit(1);

  if (!profile) {
    fail(
      409,
      "STUDENT_PROFILE_REQUIRED",
      "Complete your approved student profile before applying for leave"
    );
  }
  if (!profile.hostelIsActive) {
    fail(
      409,
      "HOSTEL_INACTIVE",
      "Leave requests are unavailable while the assigned hostel is inactive"
    );
  }

  const [allocation] = await transaction
    .select({
      id: roomAllocations.id,
      allocatedAt: roomAllocations.allocatedAt,
      roomId: rooms.id,
      roomNumber: rooms.roomNumber,
      floor: rooms.floor,
      blockId: hostelBlocks.id,
      blockCode: hostelBlocks.code,
      blockName: hostelBlocks.name,
    })
    .from(roomAllocations)
    .innerJoin(rooms, eq(roomAllocations.roomId, rooms.id))
    .innerJoin(hostelBlocks, eq(rooms.blockId, hostelBlocks.id))
    .where(
      and(
        eq(roomAllocations.studentProfileId, profile.id),
        isNull(roomAllocations.vacatedAt),
        eq(hostelBlocks.hostelId, profile.hostelId)
      )
    )
    .for("update", { of: roomAllocations })
    .limit(1);

  if (!allocation) {
    fail(
      409,
      "ACTIVE_ROOM_ALLOCATION_REQUIRED",
      "An active room allocation is required before applying for leave"
    );
  }

  return Object.freeze({ profile, allocation });
};

const findOverlappingLeave = async (transaction, studentUserId, input) => {
  const [conflict] = await transaction
    .select({
      id: leaveRequests.id,
      status: leaveRequests.status,
      departureAt: leaveRequests.departureAt,
      expectedReturnAt: leaveRequests.expectedReturnAt,
    })
    .from(leaveRequests)
    .where(
      and(
        eq(leaveRequests.studentUserId, studentUserId),
        inArray(leaveRequests.status, activeLeaveStatuses),
        lt(leaveRequests.departureAt, input.expectedReturnAt),
        gt(leaveRequests.expectedReturnAt, input.departureAt)
      )
    )
    .limit(1);

  return conflict ?? null;
};

const findDatabaseError = (error) => {
  let current = error;

  while (current) {
    if (current.code || current.constraint) {
      return current;
    }
    current = current.cause;
  }

  return null;
};

const throwMappedDatabaseError = (error) => {
  const databaseError = findDatabaseError(error);

  if (
    ["23505", "23P01"].includes(databaseError?.code) &&
    databaseError.constraint === "leave_requests_no_active_overlap"
  ) {
    fail(
      409,
      "LEAVE_REQUEST_OVERLAP",
      "This leave period overlaps an active leave request"
    );
  }

  throw error;
};

const toLeaveRequestView = ({ leaveRequest, actor, profile, allocation }) => ({
  id: leaveRequest.id,
  reason: leaveRequest.reason,
  departureAt: leaveRequest.departureAt,
  expectedReturnAt: leaveRequest.expectedReturnAt,
  isEmergency: leaveRequest.isEmergency,
  status: leaveRequest.status,
  student: {
    userId: actor.id,
    name: actor.name,
    email: actor.email,
    rollNo: profile.rollNo,
  },
  hostel: {
    id: profile.hostelId,
    code: profile.hostelCode,
    name: profile.hostelName,
  },
  roomAllocation: {
    id: allocation.id,
    allocatedAt: allocation.allocatedAt,
    room: {
      id: allocation.roomId,
      number: allocation.roomNumber,
      label: `${allocation.blockCode}-${allocation.roomNumber}`,
      floor: allocation.floor,
    },
    block: {
      id: allocation.blockId,
      code: allocation.blockCode,
      name: allocation.blockName,
    },
  },
  createdAt: leaveRequest.createdAt,
  updatedAt: leaveRequest.updatedAt,
});

export const createLeaveRequest = async (
  database,
  requestActor,
  input,
  { now = new Date() } = {}
) => {
  const leaveInput = normalizeLeaveRequestInput(input, { now });

  return database.transaction(async (transaction) => {
    const actor = await loadStudentActor(transaction, requestActor);
    const { profile, allocation } = await loadStudentContext(
      transaction,
      actor.id
    );

    // Serialize the friendly overlap check. The database exclusion constraint
    // remains the final guard for writes that do not use this service.
    await transaction.execute(
      sql`select pg_advisory_xact_lock(7102, ${actor.id})`
    );

    const conflict = await findOverlappingLeave(
      transaction,
      actor.id,
      leaveInput
    );
    if (conflict) {
      fail(
        409,
        "LEAVE_REQUEST_OVERLAP",
        "This leave period overlaps an active leave request"
      );
    }

    let leaveRequest;
    try {
      [leaveRequest] = await transaction
        .insert(leaveRequests)
        .values({
          hostelId: profile.hostelId,
          studentUserId: actor.id,
          studentProfileId: profile.id,
          roomAllocationId: allocation.id,
          reason: leaveInput.reason,
          departureAt: leaveInput.departureAt,
          expectedReturnAt: leaveInput.expectedReturnAt,
          isEmergency: leaveInput.isEmergency,
          status: LEAVE_STATUSES.PENDING,
          createdAt: leaveInput.createdAt,
          updatedAt: leaveInput.createdAt,
        })
        .returning();
    } catch (error) {
      throwMappedDatabaseError(error);
    }

    await transaction.insert(leaveEvents).values({
      leaveRequestId: leaveRequest.id,
      eventType: LEAVE_EVENT_TYPES.SUBMITTED,
      fromStatus: null,
      toStatus: LEAVE_STATUSES.PENDING,
      actorUserId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      metadata: {
        isEmergency: leaveRequest.isEmergency,
        roomAllocationId: allocation.id,
      },
      occurredAt: leaveInput.createdAt,
    });

    await appendAuditEvent(transaction, {
      actor,
      category: AUDIT_CATEGORIES.LEAVE,
      action: AUDIT_ACTIONS.LEAVE_REQUEST_SUBMITTED,
      resourceType: AUDIT_RESOURCE_TYPES.LEAVE_REQUEST,
      resourceId: leaveRequest.id,
      description: "Submitted a student leave request",
      metadata: {
        departureAt: leaveRequest.departureAt.toISOString(),
        expectedReturnAt: leaveRequest.expectedReturnAt.toISOString(),
        isEmergency: leaveRequest.isEmergency,
      },
      assignedHostels: [
        { id: profile.hostelId, code: profile.hostelCode },
      ],
      createdAt: leaveInput.createdAt,
    });

    return toLeaveRequestView({
      leaveRequest,
      actor,
      profile,
      allocation,
    });
  });
};

export const listStudentLeaveRequests = async (
  database,
  requestActor,
  input = {}
) => {
  const actorId = requireActorId(requestActor?.id);
  const { page, pageSize, status } = normalizeStudentLeaveFilters(input);
  const [actor] = await database
    .select({ role: users.role, accountStatus: users.accountStatus })
    .from(users)
    .where(eq(users.id, actorId))
    .limit(1);

  if (
    !actor ||
    actor.role !== USER_ROLES.STUDENT ||
    actor.role !== requestActor.role ||
    actor.accountStatus !== ACCOUNT_STATUSES.ACTIVE
  ) {
    fail(403, "LEAVE_READ_DENIED", "You cannot view these leave requests");
  }

  const conditions = [eq(leaveRequests.studentUserId, actorId)];
  if (status) conditions.push(eq(leaveRequests.status, status));
  const whereClause = and(...conditions);
  const [totalRow] = await database
    .select({ total: count() })
    .from(leaveRequests)
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
      hostelId: hostels.id,
      hostelCode: hostels.code,
      hostelName: hostels.name,
      blockCode: hostelBlocks.code,
      roomNumber: rooms.roomNumber,
      passId: gatePasses.id,
      passIssuedAt: gatePasses.issuedAt,
      passValidFrom: gatePasses.validFrom,
      passExpiresAt: gatePasses.expiresAt,
      passRevokedAt: gatePasses.revokedAt,
      passRevocationReason: gatePasses.revocationReason,
    })
    .from(leaveRequests)
    .innerJoin(hostels, eq(leaveRequests.hostelId, hostels.id))
    .leftJoin(
      roomAllocations,
      eq(leaveRequests.roomAllocationId, roomAllocations.id)
    )
    .leftJoin(rooms, eq(roomAllocations.roomId, rooms.id))
    .leftJoin(hostelBlocks, eq(rooms.blockId, hostelBlocks.id))
    .leftJoin(gatePasses, eq(gatePasses.leaveRequestId, leaveRequests.id))
    .where(whereClause)
    .orderBy(desc(leaveRequests.createdAt), desc(leaveRequests.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const total = Number(totalRow?.total ?? 0);

  return {
    data: records.map((record) => ({
      id: record.id,
      reason: record.reason,
      departureAt: record.departureAt,
      expectedReturnAt: record.expectedReturnAt,
      isEmergency: record.isEmergency,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      hostel: {
        id: record.hostelId,
        code: record.hostelCode,
        name: record.hostelName,
      },
      room: record.roomNumber
        ? { blockCode: record.blockCode, roomNumber: record.roomNumber }
        : null,
      pass: record.passId
        ? {
            id: record.passId,
            issuedAt: record.passIssuedAt,
            validFrom: record.passValidFrom,
            expiresAt: record.passExpiresAt,
            revokedAt: record.passRevokedAt,
            revocationReason: record.passRevocationReason,
            qrUrl: `/api/leave/${record.id}/pass/qr`,
            pdfUrl: `/api/leave/${record.id}/pass/pdf`,
          }
        : null,
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    },
  };
};
