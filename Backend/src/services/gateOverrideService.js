import { and, eq, exists } from "drizzle-orm";
import {
  gateEvents,
  gatePasses,
  hostelMemberships,
  hostels,
  leaveEvents,
  leaveRequests,
  studentProfiles,
  users,
} from "../db/schema.js";
import {
  AUDIT_ACTIONS,
  AUDIT_CATEGORIES,
  AUDIT_RESOURCE_TYPES,
} from "../domain/auditEvents.js";
import {
  GATE_MOVEMENTS,
  GATE_VERIFICATION_METHODS,
  LEAVE_EVENT_TYPES,
  LEAVE_STATUSES,
} from "../domain/leaveWorkflow.js";
import { USER_ROLES } from "../domain/roles.js";
import { ApiError } from "../utils/apiErrors.js";
import { appendAuditEvent } from "./auditEventService.js";
import { loadGateOperationsActor } from "./gateOperationsService.js";

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,99}$/;

const statesByMovement = Object.freeze({
  [GATE_MOVEMENTS.EXIT]: Object.freeze({
    from: LEAVE_STATUSES.APPROVED,
    to: LEAVE_STATUSES.EXITED,
  }),
  [GATE_MOVEMENTS.RETURN]: Object.freeze({
    from: LEAVE_STATUSES.EXITED,
    to: LEAVE_STATUSES.RETURNED,
  }),
});

const fail = (status, code, message) => {
  throw new ApiError(status, code, message);
};

export const normalizeGateOverrideInput = (input = {}) => {
  const leaveRequestId = Number(input.leaveRequestId);
  const action = typeof input.action === "string" ? input.action.trim() : "";
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  const idempotencyKey =
    typeof input.idempotencyKey === "string"
      ? input.idempotencyKey.trim()
      : "";

  if (!Number.isSafeInteger(leaveRequestId) || leaveRequestId < 1) {
    fail(400, "INVALID_LEAVE_REQUEST", "Leave request ID is invalid");
  }
  if (!statesByMovement[action]) {
    fail(400, "INVALID_GATE_ACTION", "Gate action must be exit or return");
  }
  if (reason.length < 10 || reason.length > 1000) {
    fail(
      400,
      "INVALID_OVERRIDE_REASON",
      "Override reason must contain between 10 and 1000 characters"
    );
  }
  if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
    fail(
      400,
      "INVALID_IDEMPOTENCY_KEY",
      "Idempotency key must contain between 16 and 100 safe characters"
    );
  }

  return Object.freeze({ leaveRequestId, action, reason, idempotencyKey });
};

const toResult = (event, record, replayed) => ({
  id: event.id,
  leaveRequestId: event.leaveRequestId,
  movement: event.movement,
  previousStatus: statesByMovement[event.movement].from,
  status: statesByMovement[event.movement].to,
  verificationMethod: event.verificationMethod,
  reason: event.note,
  occurredAt: event.occurredAt,
  replayed,
  student: { name: record.studentName, rollNo: record.rollNo },
  hostel: {
    id: record.hostelId,
    code: record.hostelCode,
    name: record.hostelName,
  },
});

export const recordGateOverride = async (
  database,
  requestActor,
  input,
  { now = new Date() } = {}
) => {
  const values = normalizeGateOverrideInput(input);

  return database.transaction(async (transaction) => {
    const actor = await loadGateOperationsActor(transaction, requestActor, {
      manageExceptions: true,
    });
    const conditions = [eq(leaveRequests.id, values.leaveRequestId)];

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

    const [record] = await transaction
      .select({
        leaveRequestId: leaveRequests.id,
        leaveStatus: leaveRequests.status,
        gatePassId: gatePasses.id,
        studentName: users.name,
        rollNo: studentProfiles.rollNo,
        hostelId: hostels.id,
        hostelCode: hostels.code,
        hostelName: hostels.name,
      })
      .from(leaveRequests)
      .innerJoin(users, eq(leaveRequests.studentUserId, users.id))
      .innerJoin(
        studentProfiles,
        eq(leaveRequests.studentProfileId, studentProfiles.id)
      )
      .innerJoin(hostels, eq(leaveRequests.hostelId, hostels.id))
      .leftJoin(gatePasses, eq(gatePasses.leaveRequestId, leaveRequests.id))
      .where(and(...conditions))
      .for("update", { of: leaveRequests })
      .limit(1);

    if (!record) {
      fail(
        404,
        "LEAVE_REQUEST_NOT_FOUND",
        "Leave request was not found in an assigned hostel"
      );
    }

    const [existing] = await transaction
      .select()
      .from(gateEvents)
      .where(eq(gateEvents.idempotencyKey, values.idempotencyKey))
      .limit(1);

    if (existing) {
      if (
        existing.leaveRequestId !== values.leaveRequestId ||
        existing.performedByUserId !== actor.id ||
        existing.movement !== values.action ||
        existing.verificationMethod !== GATE_VERIFICATION_METHODS.OVERRIDE
      ) {
        fail(
          409,
          "IDEMPOTENCY_KEY_REUSED",
          "This idempotency key was already used for another gate movement"
        );
      }
      return toResult(existing, record, true);
    }

    const states = statesByMovement[values.action];
    if (record.leaveStatus !== states.from) {
      fail(
        409,
        "INVALID_GATE_OVERRIDE_STATE",
        `A ${values.action} override requires a leave request in ${states.from} status`
      );
    }

    const [event] = await transaction
      .insert(gateEvents)
      .values({
        leaveRequestId: record.leaveRequestId,
        gatePassId: record.gatePassId,
        movement: values.action,
        verificationMethod: GATE_VERIFICATION_METHODS.OVERRIDE,
        performedByUserId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        idempotencyKey: values.idempotencyKey,
        note: values.reason,
        metadata: { override: true },
        occurredAt: now,
      })
      .returning();

    await transaction.insert(leaveEvents).values({
      leaveRequestId: record.leaveRequestId,
      eventType: LEAVE_EVENT_TYPES.OVERRIDE,
      fromStatus: states.from,
      toStatus: states.to,
      actorUserId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      note: values.reason,
      metadata: {
        override: true,
        gateEventId: event.id,
        movement: values.action,
      },
      occurredAt: now,
    });

    await appendAuditEvent(transaction, {
      actor,
      category: AUDIT_CATEGORIES.GATE,
      action: AUDIT_ACTIONS.GATE_MOVEMENT_OVERRIDDEN,
      resourceType: AUDIT_RESOURCE_TYPES.GATE_EVENT,
      resourceId: event.id,
      description: `Overrode a student's gate ${values.action}`,
      metadata: {
        override: true,
        reason: values.reason,
        movement: values.action,
        leaveRequestId: record.leaveRequestId,
        gatePassId: record.gatePassId,
        studentRollNo: record.rollNo,
      },
      assignedHostels: [{ id: record.hostelId, code: record.hostelCode }],
      requestId: values.idempotencyKey,
      createdAt: now,
    });

    return toResult(event, record, false);
  });
};
