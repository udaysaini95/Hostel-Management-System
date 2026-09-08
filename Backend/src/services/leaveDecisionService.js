import { and, eq, exists } from "drizzle-orm";
import {
  hostelMemberships,
  hostels,
  leaveDecisions,
  leaveEvents,
  leaveRequests,
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
  assertLeaveTransition,
  LEAVE_DECISION_OUTCOMES,
  LEAVE_EVENT_TYPES,
  LEAVE_STATUSES,
} from "../domain/leaveWorkflow.js";
import { USER_ROLES } from "../domain/roles.js";
import { ApiError } from "../utils/apiErrors.js";
import { appendAuditEvent } from "./auditEventService.js";

const decisionRoles = new Set([USER_ROLES.WARDEN, USER_ROLES.ADMIN]);
const decisionOutcomes = new Set(Object.values(LEAVE_DECISION_OUTCOMES));

const fail = (status, code, message) => {
  throw new ApiError(status, code, message);
};

const requirePositiveInteger = (value, label) => {
  const number = Number(value);

  if (!Number.isSafeInteger(number) || number < 1) {
    fail(400, "INVALID_REQUEST", `${label} must be a positive integer`);
  }

  return number;
};

const requireOperationTime = (value) => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    fail(400, "INVALID_REQUEST", "Operation timestamp is invalid");
  }

  return value;
};

export const normalizeLeaveDecisionInput = (input = {}) => {
  const outcome =
    typeof input.outcome === "string" ? input.outcome.trim().toLowerCase() : "";
  const note = typeof input.note === "string" ? input.note.trim() : "";

  if (!decisionOutcomes.has(outcome)) {
    fail(
      400,
      "INVALID_LEAVE_DECISION",
      "Leave decision must be approved or rejected"
    );
  }
  if (note.length < 5 || note.length > 1000) {
    fail(
      400,
      "INVALID_LEAVE_DECISION_NOTE",
      "Decision note must contain between 5 and 1000 characters"
    );
  }

  return Object.freeze({ outcome, note });
};

const loadDecisionActor = async (transaction, requestActor) => {
  const actorId = requirePositiveInteger(requestActor?.id, "Actor ID");
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
    .limit(1);

  if (!actor || !decisionRoles.has(actor.role)) {
    fail(
      403,
      "LEAVE_DECISION_DENIED",
      "Only wardens and administrators can decide leave requests"
    );
  }
  if (actor.accountStatus !== ACCOUNT_STATUSES.ACTIVE) {
    fail(
      403,
      "STAFF_ACCOUNT_INACTIVE",
      "Only an active staff account can decide leave requests"
    );
  }

  return Object.freeze(actor);
};

const loadManagedLeave = async (transaction, actor, leaveRequestId) => {
  const conditions = [eq(leaveRequests.id, leaveRequestId)];

  if (actor.role === USER_ROLES.WARDEN) {
    const assignedHostel = transaction
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

  const [leaveRequest] = await transaction
    .select({
      id: leaveRequests.id,
      hostelId: leaveRequests.hostelId,
      hostelCode: hostels.code,
      hostelName: hostels.name,
      studentUserId: leaveRequests.studentUserId,
      studentName: users.name,
      studentEmail: users.email,
      studentProfileId: leaveRequests.studentProfileId,
      studentRollNo: studentProfiles.rollNo,
      roomAllocationId: leaveRequests.roomAllocationId,
      reason: leaveRequests.reason,
      departureAt: leaveRequests.departureAt,
      expectedReturnAt: leaveRequests.expectedReturnAt,
      isEmergency: leaveRequests.isEmergency,
      status: leaveRequests.status,
      createdAt: leaveRequests.createdAt,
      updatedAt: leaveRequests.updatedAt,
    })
    .from(leaveRequests)
    .innerJoin(hostels, eq(leaveRequests.hostelId, hostels.id))
    .innerJoin(users, eq(leaveRequests.studentUserId, users.id))
    .innerJoin(
      studentProfiles,
      eq(leaveRequests.studentProfileId, studentProfiles.id)
    )
    .where(and(...conditions))
    .for("update", { of: leaveRequests })
    .limit(1);

  if (!leaveRequest) {
    // Do not reveal request IDs belonging to a different hostel.
    fail(404, "LEAVE_REQUEST_NOT_FOUND", "Leave request not found");
  }

  return leaveRequest;
};

const getDecisionAuditDetails = (outcome) =>
  outcome === LEAVE_DECISION_OUTCOMES.APPROVED
    ? {
        action: AUDIT_ACTIONS.LEAVE_REQUEST_APPROVED,
        description: "Approved a student leave request",
      }
    : {
        action: AUDIT_ACTIONS.LEAVE_REQUEST_REJECTED,
        description: "Rejected a student leave request",
      };

const toDecisionResult = ({ leaveRequest, decision, actor }) => ({
  leaveRequest: {
    id: leaveRequest.id,
    reason: leaveRequest.reason,
    departureAt: leaveRequest.departureAt,
    expectedReturnAt: leaveRequest.expectedReturnAt,
    isEmergency: leaveRequest.isEmergency,
    status: decision.outcome,
    student: {
      userId: leaveRequest.studentUserId,
      name: leaveRequest.studentName,
      email: leaveRequest.studentEmail,
      rollNo: leaveRequest.studentRollNo,
    },
    hostel: {
      id: leaveRequest.hostelId,
      code: leaveRequest.hostelCode,
      name: leaveRequest.hostelName,
    },
    roomAllocationId: leaveRequest.roomAllocationId,
    createdAt: leaveRequest.createdAt,
    updatedAt: decision.decidedAt,
  },
  decision: {
    id: decision.id,
    outcome: decision.outcome,
    note: decision.note,
    decidedAt: decision.decidedAt,
    actor: {
      userId: actor.id,
      name: actor.name,
      role: actor.role,
    },
  },
});

export const decideLeaveRequest = async (
  database,
  requestActor,
  leaveRequestId,
  input,
  { now = new Date() } = {}
) => {
  const id = requirePositiveInteger(leaveRequestId, "Leave request ID");
  const decidedAt = requireOperationTime(now);
  const values = normalizeLeaveDecisionInput(input);

  return database.transaction(async (transaction) => {
    const actor = await loadDecisionActor(transaction, requestActor);
    const leaveRequest = await loadManagedLeave(transaction, actor, id);

    if (leaveRequest.status !== LEAVE_STATUSES.PENDING) {
      fail(
        409,
        "LEAVE_ALREADY_DECIDED",
        "Only a pending leave request can be approved or rejected"
      );
    }
    if (decidedAt < new Date(leaveRequest.createdAt)) {
      fail(
        409,
        "INVALID_LEAVE_DECISION_TIME",
        "Decision time cannot be earlier than the leave submission"
      );
    }

    assertLeaveTransition(leaveRequest.status, values.outcome);

    // The decision trigger applies the matching request status atomically.
    const [decision] = await transaction
      .insert(leaveDecisions)
      .values({
        leaveRequestId: leaveRequest.id,
        outcome: values.outcome,
        decidedByUserId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        note: values.note,
        decidedAt,
      })
      .returning();

    await transaction.insert(leaveEvents).values({
      leaveRequestId: leaveRequest.id,
      eventType:
        values.outcome === LEAVE_DECISION_OUTCOMES.APPROVED
          ? LEAVE_EVENT_TYPES.APPROVED
          : LEAVE_EVENT_TYPES.REJECTED,
      fromStatus: leaveRequest.status,
      toStatus: values.outcome,
      actorUserId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      note: values.note,
      metadata: { decisionId: decision.id },
      occurredAt: decidedAt,
    });

    const auditDetails = getDecisionAuditDetails(values.outcome);
    await appendAuditEvent(transaction, {
      actor,
      category: AUDIT_CATEGORIES.LEAVE,
      action: auditDetails.action,
      resourceType: AUDIT_RESOURCE_TYPES.LEAVE_REQUEST,
      resourceId: leaveRequest.id,
      description: auditDetails.description,
      metadata: {
        decisionId: decision.id,
        outcome: decision.outcome,
        studentUserId: leaveRequest.studentUserId,
      },
      assignedHostels: [
        { id: leaveRequest.hostelId, code: leaveRequest.hostelCode },
      ],
      createdAt: decidedAt,
    });

    return toDecisionResult({ leaveRequest, decision, actor });
  });
};
