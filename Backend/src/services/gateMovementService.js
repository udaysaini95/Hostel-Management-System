import { eq } from "drizzle-orm";
import { gateEvents, leaveEvents } from "../db/schema.js";
import {
  AUDIT_ACTIONS,
  AUDIT_CATEGORIES,
  AUDIT_RESOURCE_TYPES,
} from "../domain/auditEvents.js";
import {
  GATE_MOVEMENTS,
  LEAVE_EVENT_TYPES,
  LEAVE_STATUSES,
} from "../domain/leaveWorkflow.js";
import { ApiError } from "../utils/apiErrors.js";
import { appendAuditEvent } from "./auditEventService.js";
import {
  evaluateGatePass,
  loadGateVerifier,
  loadScopedPassByHash,
  normalizeGatePassCredential,
  toPublicGatePassDetails,
} from "./gatePassVerificationService.js";

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,99}$/;
const knownActions = new Set(Object.values(GATE_MOVEMENTS));

const fail = (status, code, message) => {
  throw new ApiError(status, code, message);
};

const normalizeMovementInput = (input = {}) => {
  const credential =
    typeof input.credential === "string" ? input.credential.trim() : "";
  const action = typeof input.action === "string" ? input.action.trim() : "";
  const idempotencyKey =
    typeof input.idempotencyKey === "string"
      ? input.idempotencyKey.trim()
      : "";
  const note = typeof input.note === "string" ? input.note.trim() : "";

  if (!credential) {
    fail(400, "INVALID_GATE_CREDENTIAL", "Gate-pass credential is required");
  }
  if (!knownActions.has(action)) {
    fail(400, "INVALID_GATE_ACTION", "Gate action must be exit or return");
  }
  if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
    fail(
      400,
      "INVALID_IDEMPOTENCY_KEY",
      "Idempotency key must contain between 16 and 100 safe characters"
    );
  }
  if (note.length > 500) {
    fail(400, "INVALID_GATE_NOTE", "Gate note cannot exceed 500 characters");
  }

  return { credential, action, idempotencyKey, note: note || null };
};

const movementStates = Object.freeze({
  [GATE_MOVEMENTS.EXIT]: Object.freeze({
    from: LEAVE_STATUSES.APPROVED,
    to: LEAVE_STATUSES.EXITED,
    eventType: LEAVE_EVENT_TYPES.EXITED,
    auditAction: AUDIT_ACTIONS.GATE_EXIT_RECORDED,
    description: "Recorded a student's hostel exit",
  }),
  [GATE_MOVEMENTS.RETURN]: Object.freeze({
    from: LEAVE_STATUSES.EXITED,
    to: LEAVE_STATUSES.RETURNED,
    eventType: LEAVE_EVENT_TYPES.RETURNED,
    auditAction: AUDIT_ACTIONS.GATE_RETURN_RECORDED,
    description: "Recorded a student's hostel return",
  }),
});

const toMovementResult = (event, record, replayed) => {
  const states = movementStates[event.movement];

  return {
    id: event.id,
    movement: event.movement,
    previousStatus: states.from,
    status: states.to,
    verificationMethod: event.verificationMethod,
    occurredAt: event.occurredAt,
    replayed,
    details: toPublicGatePassDetails(record),
  };
};

const loadExistingMovement = async (transaction, idempotencyKey) => {
  const [event] = await transaction
    .select()
    .from(gateEvents)
    .where(eq(gateEvents.idempotencyKey, idempotencyKey))
    .limit(1);

  return event ?? null;
};

export const recordGateMovement = async (
  database,
  requestActor,
  input,
  { now = new Date() } = {}
) => {
  const values = normalizeMovementInput(input);
  const credential = normalizeGatePassCredential(values.credential);

  if (!credential) {
    fail(404, "GATE_PASS_NOT_FOUND", "No gate pass matches this credential");
  }
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    fail(400, "INVALID_REQUEST", "Movement time is invalid");
  }

  return database.transaction(async (transaction) => {
    const actor = await loadGateVerifier(transaction, requestActor);
    const record = await loadScopedPassByHash(
      transaction,
      actor,
      credential.tokenHash,
      { lock: true }
    );

    if (!record) {
      fail(404, "GATE_PASS_NOT_FOUND", "No gate pass matches this credential");
    }

    // This check happens after the leave row lock. Concurrent scans therefore
    // see the first committed event and return it instead of writing again.
    const existingEvent = await loadExistingMovement(
      transaction,
      values.idempotencyKey
    );

    if (existingEvent) {
      if (
        existingEvent.gatePassId !== record.gatePassId ||
        existingEvent.performedByUserId !== actor.id ||
        existingEvent.movement !== values.action
      ) {
        fail(
          409,
          "IDEMPOTENCY_KEY_REUSED",
          "This idempotency key was already used for another gate movement"
        );
      }

      return toMovementResult(existingEvent, record, true);
    }

    const verification = evaluateGatePass(record, now);
    if (!verification.valid) {
      fail(409, verification.code, verification.message);
    }
    if (verification.permittedAction !== values.action) {
      fail(
        409,
        "GATE_ACTION_MISMATCH",
        `The only permitted action is ${verification.permittedAction}`
      );
    }

    const states = movementStates[values.action];
    const [event] = await transaction
      .insert(gateEvents)
      .values({
        leaveRequestId: record.leaveRequestId,
        gatePassId: record.gatePassId,
        movement: values.action,
        verificationMethod: credential.verificationMethod,
        performedByUserId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        idempotencyKey: values.idempotencyKey,
        note: values.note,
        metadata: {},
        occurredAt: now,
      })
      .returning();

    // The database gate-event trigger changes the leave status in the same
    // statement. These records explain that transition to people and auditors.
    await transaction.insert(leaveEvents).values({
      leaveRequestId: record.leaveRequestId,
      eventType: states.eventType,
      fromStatus: states.from,
      toStatus: states.to,
      actorUserId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      note: values.note ?? `Gate ${values.action} recorded`,
      metadata: {
        gateEventId: event.id,
        verificationMethod: credential.verificationMethod,
      },
      occurredAt: now,
    });

    await appendAuditEvent(transaction, {
      actor,
      category: AUDIT_CATEGORIES.GATE,
      action: states.auditAction,
      resourceType: AUDIT_RESOURCE_TYPES.GATE_EVENT,
      resourceId: event.id,
      description: states.description,
      metadata: {
        gatePassId: record.gatePassId,
        leaveRequestId: record.leaveRequestId,
        movement: values.action,
        studentRollNo: record.rollNo,
      },
      assignedHostels: [{ id: record.hostelId, code: record.hostelCode }],
      requestId: values.idempotencyKey,
      createdAt: now,
    });

    return toMovementResult(event, record, false);
  });
};

export { normalizeMovementInput };
