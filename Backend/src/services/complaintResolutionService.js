import { createHash, randomUUID } from "node:crypto";
import { and, count, eq, isNull, sql } from "drizzle-orm";
import {
  complaintAssignments,
  complaintAttachments,
  complaintEvents,
  complaints,
  hostels,
} from "../db/schema.js";
import {
  COMPLAINT_ATTACHMENT_PURPOSES,
  MAX_COMPLAINT_ATTACHMENTS,
  inspectComplaintImage,
} from "../domain/complaintAttachments.js";
import {
  AUDIT_ACTIONS,
  AUDIT_CATEGORIES,
  AUDIT_RESOURCE_TYPES,
} from "../domain/auditEvents.js";
import {
  assertComplaintTransition,
  COMPLAINT_EVENT_TYPES,
  COMPLAINT_STATUSES,
} from "../domain/complaintWorkflow.js";
import { USER_ROLES } from "../domain/roles.js";
import { ApiError } from "../utils/apiErrors.js";
import { appendAuditEvent } from "./auditEventService.js";
import { getComplaintById, loadComplaintActor } from "./complaintService.js";
import { privateFileStorage } from "./privateFileStorage.js";

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

const normalizeText = (value) =>
  typeof value === "string" ? value.trim() : "";

export const normalizeResolutionInput = (input = {}) => {
  const resolutionNote = normalizeText(input.resolutionNote);

  if (resolutionNote.length < 10 || resolutionNote.length > 1000) {
    fail(
      400,
      "INVALID_RESOLUTION_NOTE",
      "Resolution note must contain between 10 and 1000 characters"
    );
  }

  return Object.freeze({ resolutionNote });
};

export const normalizeVerificationInput = (input = {}) => {
  const action = normalizeText(input.action).toLowerCase();
  const reason = normalizeText(input.reason);

  if (!["close", "reopen"].includes(action)) {
    fail(
      400,
      "INVALID_VERIFICATION_ACTION",
      "Verification action must be close or reopen"
    );
  }

  if (reason && (reason.length < 10 || reason.length > 1000)) {
    fail(
      400,
      "INVALID_VERIFICATION_REASON",
      "Verification reason must contain between 10 and 1000 characters"
    );
  }

  if (action === "reopen" && !reason) {
    fail(
      422,
      "REOPEN_REASON_REQUIRED",
      "Explain why the complaint needs to be reopened"
    );
  }

  return Object.freeze({ action, reason: reason || null });
};

const lockComplaint = (database, complaintId) =>
  database.execute(
    sql`select pg_advisory_xact_lock(71001, ${complaintId})`
  );

const loadWorkflowComplaint = async (database, complaintId) => {
  const [complaint] = await database
    .select({
      id: complaints.id,
      hostelId: complaints.hostelId,
      hostelCode: hostels.code,
      reportedByUserId: complaints.reportedByUserId,
      status: complaints.status,
      createdAt: complaints.createdAt,
      updatedAt: complaints.updatedAt,
      resolvedAt: complaints.resolvedAt,
      assignmentId: complaintAssignments.id,
      assigneeUserId: complaintAssignments.assigneeUserId,
      assignedAt: complaintAssignments.assignedAt,
    })
    .from(complaints)
    .innerJoin(hostels, eq(complaints.hostelId, hostels.id))
    .leftJoin(
      complaintAssignments,
      and(
        eq(complaintAssignments.complaintId, complaints.id),
        isNull(complaintAssignments.endedAt)
      )
    )
    .where(eq(complaints.id, complaintId))
    .limit(1);

  if (!complaint) {
    fail(404, "COMPLAINT_NOT_FOUND", "Complaint not found");
  }

  return complaint;
};

const assertActiveAssignee = (actor, complaint) => {
  if (
    actor.role !== USER_ROLES.MAINTENANCE ||
    complaint.assigneeUserId !== actor.id
  ) {
    // Keep other technicians from learning whether the complaint exists.
    fail(404, "COMPLAINT_NOT_FOUND", "Complaint not found");
  }
};

const assertOwningStudent = (actor, complaint) => {
  if (
    actor.role !== USER_ROLES.STUDENT ||
    complaint.reportedByUserId !== actor.id
  ) {
    fail(
      403,
      "COMPLAINT_VERIFICATION_DENIED",
      "Only the student who reported this complaint can verify it"
    );
  }
};

const assertChronological = (time, previousTime, message) => {
  if (previousTime && time < new Date(previousTime)) {
    fail(409, "INVALID_COMPLAINT_TIME", message);
  }
};

const appendWorkflowEvent = async (
  database,
  { complaint, actor, type, fromStatus, toStatus, note, metadata, occurredAt }
) => {
  const [event] = await database
    .insert(complaintEvents)
    .values({
      complaintId: complaint.id,
      eventType: type,
      fromStatus,
      toStatus,
      actorUserId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      note,
      metadata,
      occurredAt,
    })
    .returning({ id: complaintEvents.id });

  return event;
};

const appendWorkflowAudit = (
  database,
  { complaint, actor, action, description, metadata, createdAt }
) =>
  appendAuditEvent(database, {
    actor,
    category: AUDIT_CATEGORIES.COMPLAINT,
    action,
    resourceType: AUDIT_RESOURCE_TYPES.COMPLAINT,
    resourceId: complaint.id,
    description,
    metadata,
    assignedHostels: [
      { id: complaint.hostelId, code: complaint.hostelCode },
    ],
    createdAt,
  });

export const startComplaintWork = async (
  database,
  requestActor,
  complaintId,
  { now = new Date() } = {}
) => {
  const id = requirePositiveInteger(complaintId, "Complaint ID");
  const startedAt = requireOperationTime(now);
  const actor = await loadComplaintActor(database, requestActor);

  await database.transaction(async (transaction) => {
    await lockComplaint(transaction, id);
    const complaint = await loadWorkflowComplaint(transaction, id);
    assertActiveAssignee(actor, complaint);
    assertComplaintTransition(
      complaint.status,
      COMPLAINT_STATUSES.IN_PROGRESS
    );
    assertChronological(
      startedAt,
      complaint.updatedAt,
      "Work cannot start before the latest complaint update"
    );

    await transaction
      .update(complaints)
      .set({ status: COMPLAINT_STATUSES.IN_PROGRESS, updatedAt: startedAt })
      .where(eq(complaints.id, complaint.id));

    await appendWorkflowEvent(transaction, {
      complaint,
      actor,
      type: COMPLAINT_EVENT_TYPES.WORK_STARTED,
      fromStatus: complaint.status,
      toStatus: COMPLAINT_STATUSES.IN_PROGRESS,
      note: "Maintenance work started",
      metadata: { assignmentId: complaint.assignmentId },
      occurredAt: startedAt,
    });

    await appendWorkflowAudit(transaction, {
      complaint,
      actor,
      action: AUDIT_ACTIONS.COMPLAINT_WORK_STARTED,
      description: "Started work on an assigned complaint",
      metadata: { assignmentId: complaint.assignmentId },
      createdAt: startedAt,
    });
  });

  return getComplaintById(database, requestActor, id, { now: startedAt });
};

const getChecksum = (buffer) =>
  createHash("sha256").update(buffer).digest("hex");

const createStorageKey = (complaintId, extension, createId) =>
  `complaints/${complaintId}/resolutions/${createId()}.${extension}`;

const removeStoredFile = async (storage, storageKey) => {
  if (!storageKey) return;

  try {
    await storage.remove(storageKey);
  } catch (cleanupError) {
    console.error("Complaint resolution evidence cleanup failed:", cleanupError);
  }
};

const toEvidenceView = (attachment) =>
  attachment
    ? {
        id: attachment.id,
        complaintId: attachment.complaintId,
        eventId: attachment.eventId,
        purpose: attachment.purpose,
        originalName: attachment.originalName,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        uploadedByUserId: attachment.uploadedByUserId,
        createdAt: attachment.createdAt,
        downloadUrl: `/api/complaints/${attachment.complaintId}/attachments/${attachment.id}`,
      }
    : null;

export const resolveComplaint = async (
  database,
  requestActor,
  complaintId,
  input,
  file,
  {
    now = new Date(),
    storage = privateFileStorage,
    createId = randomUUID,
  } = {}
) => {
  const id = requirePositiveInteger(complaintId, "Complaint ID");
  const values = normalizeResolutionInput(input);
  const resolvedAt = requireOperationTime(now);
  const actor = await loadComplaintActor(database, requestActor);
  const preflightComplaint = await loadWorkflowComplaint(database, id);
  assertActiveAssignee(actor, preflightComplaint);
  assertComplaintTransition(
    preflightComplaint.status,
    COMPLAINT_STATUSES.RESOLVED
  );

  const image = file ? inspectComplaintImage(file) : null;
  const storageKey = image
    ? createStorageKey(id, image.extension, createId)
    : null;

  if (image) {
    try {
      await storage.write(storageKey, image.buffer);
    } catch {
      fail(
        503,
        "ATTACHMENT_STORAGE_UNAVAILABLE",
        "The resolution evidence could not be stored. Please try again"
      );
    }
  }

  let evidence = null;
  try {
    evidence = await database.transaction(async (transaction) => {
      await lockComplaint(transaction, id);
      const complaint = await loadWorkflowComplaint(transaction, id);
      assertActiveAssignee(actor, complaint);
      assertComplaintTransition(
        complaint.status,
        COMPLAINT_STATUSES.RESOLVED
      );
      assertChronological(
        resolvedAt,
        complaint.updatedAt,
        "Resolution time cannot be before the latest complaint update"
      );

      if (image) {
        const [totalResult] = await transaction
          .select({ total: count() })
          .from(complaintAttachments)
          .where(
            and(
              eq(complaintAttachments.complaintId, complaint.id),
              eq(
                complaintAttachments.purpose,
                COMPLAINT_ATTACHMENT_PURPOSES.RESOLUTION
              )
            )
          );

        if (Number(totalResult?.total ?? 0) >= MAX_COMPLAINT_ATTACHMENTS) {
          fail(
            409,
            "ATTACHMENT_LIMIT_REACHED",
            `A complaint can have at most ${MAX_COMPLAINT_ATTACHMENTS} resolution images`
          );
        }
      }

      await transaction
        .update(complaints)
        .set({
          status: COMPLAINT_STATUSES.RESOLVED,
          resolutionNote: values.resolutionNote,
          resolvedAt,
          closedAt: null,
          updatedAt: resolvedAt,
        })
        .where(eq(complaints.id, complaint.id));

      const event = await appendWorkflowEvent(transaction, {
        complaint,
        actor,
        type: COMPLAINT_EVENT_TYPES.RESOLVED,
        fromStatus: complaint.status,
        toStatus: COMPLAINT_STATUSES.RESOLVED,
        note: values.resolutionNote,
        metadata: {
          assignmentId: complaint.assignmentId,
          evidenceProvided: Boolean(image),
        },
        occurredAt: resolvedAt,
      });

      let attachment = null;
      if (image) {
        [attachment] = await transaction
          .insert(complaintAttachments)
          .values({
            complaintId: complaint.id,
            eventId: event.id,
            uploadedByUserId: actor.id,
            purpose: COMPLAINT_ATTACHMENT_PURPOSES.RESOLUTION,
            storageKey,
            originalName: image.originalName,
            mimeType: image.mimeType,
            sizeBytes: image.sizeBytes,
            sha256: getChecksum(image.buffer),
            createdAt: resolvedAt,
          })
          .returning();

        await appendAuditEvent(transaction, {
          actor,
          category: AUDIT_CATEGORIES.COMPLAINT,
          action: AUDIT_ACTIONS.COMPLAINT_ATTACHMENT_ADDED,
          resourceType: AUDIT_RESOURCE_TYPES.COMPLAINT_ATTACHMENT,
          resourceId: attachment.id,
          description: "Added private resolution evidence to a complaint",
          metadata: {
            complaintId: complaint.id,
            eventId: event.id,
            purpose: attachment.purpose,
            mimeType: attachment.mimeType,
            sizeBytes: attachment.sizeBytes,
          },
          assignedHostels: [
            { id: complaint.hostelId, code: complaint.hostelCode },
          ],
          createdAt: resolvedAt,
        });
      }

      await appendWorkflowAudit(transaction, {
        complaint,
        actor,
        action: AUDIT_ACTIONS.COMPLAINT_RESOLVED,
        description: "Resolved an assigned complaint",
        metadata: {
          assignmentId: complaint.assignmentId,
          resolutionEventId: event.id,
          evidenceAttachmentId: attachment?.id ?? null,
        },
        createdAt: resolvedAt,
      });

      return toEvidenceView(attachment);
    });
  } catch (error) {
    await removeStoredFile(storage, storageKey);
    throw error;
  }

  const complaint = await getComplaintById(database, requestActor, id, {
    now: resolvedAt,
  });
  return { complaint, resolutionEvidence: evidence };
};

export const verifyComplaintResolution = async (
  database,
  requestActor,
  complaintId,
  input,
  { now = new Date() } = {}
) => {
  const id = requirePositiveInteger(complaintId, "Complaint ID");
  const values = normalizeVerificationInput(input);
  const verifiedAt = requireOperationTime(now);
  const actor = await loadComplaintActor(database, requestActor);

  await database.transaction(async (transaction) => {
    await lockComplaint(transaction, id);
    const complaint = await loadWorkflowComplaint(transaction, id);
    assertOwningStudent(actor, complaint);

    const nextStatus =
      values.action === "close"
        ? COMPLAINT_STATUSES.CLOSED
        : COMPLAINT_STATUSES.IN_PROGRESS;
    assertComplaintTransition(complaint.status, nextStatus);
    assertChronological(
      verifiedAt,
      complaint.resolvedAt,
      "Verification time cannot be before the complaint resolution"
    );

    if (values.action === "close") {
      if (
        complaint.assignedAt &&
        verifiedAt <= new Date(complaint.assignedAt)
      ) {
        fail(
          409,
          "INVALID_COMPLAINT_TIME",
          "Closing time must be after the active assignment"
        );
      }

      await transaction
        .update(complaints)
        .set({
          status: COMPLAINT_STATUSES.CLOSED,
          closedAt: verifiedAt,
          updatedAt: verifiedAt,
        })
        .where(eq(complaints.id, complaint.id));

      if (complaint.assignmentId) {
        await transaction
          .update(complaintAssignments)
          .set({
            endedAt: verifiedAt,
            endedByUserId: actor.id,
            endReason: "Complaint closed by the reporting student",
          })
          .where(eq(complaintAssignments.id, complaint.assignmentId));
      }
    } else {
      await transaction
        .update(complaints)
        .set({
          status: COMPLAINT_STATUSES.IN_PROGRESS,
          resolutionNote: null,
          resolvedAt: null,
          closedAt: null,
          updatedAt: verifiedAt,
        })
        .where(eq(complaints.id, complaint.id));
    }

    const eventType =
      values.action === "close"
        ? COMPLAINT_EVENT_TYPES.CLOSED
        : COMPLAINT_EVENT_TYPES.REOPENED;
    const action =
      values.action === "close"
        ? AUDIT_ACTIONS.COMPLAINT_CLOSED
        : AUDIT_ACTIONS.COMPLAINT_REOPENED;
    const note =
      values.reason ?? "The reporting student confirmed the resolution";

    await appendWorkflowEvent(transaction, {
      complaint,
      actor,
      type: eventType,
      fromStatus: complaint.status,
      toStatus: nextStatus,
      note,
      metadata: { assignmentId: complaint.assignmentId },
      occurredAt: verifiedAt,
    });

    await appendWorkflowAudit(transaction, {
      complaint,
      actor,
      action,
      description:
        values.action === "close"
          ? "Confirmed and closed a resolved complaint"
          : "Reopened a complaint after reviewing its resolution",
      metadata: {
        assignmentId: complaint.assignmentId,
        reason: values.reason,
      },
      createdAt: verifiedAt,
    });
  });

  return getComplaintById(database, requestActor, id, { now: verifiedAt });
};
