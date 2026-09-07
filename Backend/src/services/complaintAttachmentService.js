import { createHash, randomUUID } from "node:crypto";
import { and, asc, count, eq, sql } from "drizzle-orm";
import {
  complaintAttachments,
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
import { COMPLAINT_STATUSES } from "../domain/complaintWorkflow.js";
import { USER_ROLES } from "../domain/roles.js";
import { ApiError } from "../utils/apiErrors.js";
import { appendAuditEvent } from "./auditEventService.js";
import {
  assertComplaintVisibility,
  loadComplaintActor,
} from "./complaintService.js";
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

const attachmentSelection = {
  id: complaintAttachments.id,
  complaintId: complaintAttachments.complaintId,
  uploadedByUserId: complaintAttachments.uploadedByUserId,
  purpose: complaintAttachments.purpose,
  storageKey: complaintAttachments.storageKey,
  originalName: complaintAttachments.originalName,
  mimeType: complaintAttachments.mimeType,
  sizeBytes: complaintAttachments.sizeBytes,
  sha256: complaintAttachments.sha256,
  createdAt: complaintAttachments.createdAt,
};

const toAttachmentView = (attachment) => ({
  id: attachment.id,
  complaintId: attachment.complaintId,
  purpose: attachment.purpose,
  originalName: attachment.originalName,
  mimeType: attachment.mimeType,
  sizeBytes: attachment.sizeBytes,
  uploadedByUserId: attachment.uploadedByUserId,
  createdAt: attachment.createdAt,
  downloadUrl: `/api/complaints/${attachment.complaintId}/attachments/${attachment.id}`,
});

const loadComplaint = async (database, complaintId) => {
  const [complaint] = await database
    .select({
      id: complaints.id,
      hostelId: complaints.hostelId,
      hostelCode: hostels.code,
      reportedByUserId: complaints.reportedByUserId,
      status: complaints.status,
    })
    .from(complaints)
    .innerJoin(hostels, eq(complaints.hostelId, hostels.id))
    .where(eq(complaints.id, complaintId))
    .limit(1);

  if (!complaint) {
    fail(404, "COMPLAINT_NOT_FOUND", "Complaint not found");
  }

  return complaint;
};

const loadAccessContext = async (database, requestActor, complaintId) => {
  const id = requirePositiveInteger(complaintId, "Complaint ID");
  const actor = await loadComplaintActor(database, requestActor);
  const complaint = await loadComplaint(database, id);
  await assertComplaintVisibility(database, actor, complaint);

  return { actor, complaint };
};

const loadAttachment = async (database, complaintId, attachmentId) => {
  const id = requirePositiveInteger(attachmentId, "Attachment ID");
  const [attachment] = await database
    .select(attachmentSelection)
    .from(complaintAttachments)
    .where(
      and(
        eq(complaintAttachments.id, id),
        eq(complaintAttachments.complaintId, complaintId)
      )
    )
    .limit(1);

  if (!attachment) {
    fail(404, "ATTACHMENT_NOT_FOUND", "Complaint attachment not found");
  }

  return attachment;
};

const assertSubmissionUploadAllowed = (actor, complaint) => {
  if (complaint.reportedByUserId !== actor.id) {
    fail(
      403,
      "ATTACHMENT_UPLOAD_DENIED",
      "Only the complaint reporter can add submission evidence"
    );
  }

  if (complaint.status !== COMPLAINT_STATUSES.CREATED) {
    fail(
      409,
      "ATTACHMENT_UPLOAD_CLOSED",
      "Submission evidence cannot be changed after work has been assigned"
    );
  }
};

const assertDeleteAllowed = (actor, complaint, attachment) => {
  if (actor.role === USER_ROLES.ADMIN) {
    return;
  }

  if (
    complaint.status !== COMPLAINT_STATUSES.CREATED ||
    complaint.reportedByUserId !== actor.id ||
    attachment.uploadedByUserId !== actor.id
  ) {
    fail(
      403,
      "ATTACHMENT_DELETE_DENIED",
      "This complaint attachment cannot be deleted"
    );
  }
};

const createStorageKey = (complaintId, extension, createId) =>
  `complaints/${complaintId}/${createId()}.${extension}`;

const getChecksum = (buffer) =>
  createHash("sha256").update(buffer).digest("hex");

const lockComplaint = (database, complaintId) =>
  database.execute(
    sql`select pg_advisory_xact_lock(71001, ${complaintId})`
  );

const removeStoredFile = async (storage, storageKey) => {
  try {
    await storage.remove(storageKey);
  } catch (cleanupError) {
    console.error("Complaint attachment cleanup failed:", cleanupError);
  }
};

export const uploadComplaintAttachment = async (
  database,
  requestActor,
  complaintId,
  file,
  {
    storage = privateFileStorage,
    now = new Date(),
    createId = randomUUID,
  } = {}
) => {
  const createdAt = requireOperationTime(now);
  const { actor, complaint } = await loadAccessContext(
    database,
    requestActor,
    complaintId
  );
  assertSubmissionUploadAllowed(actor, complaint);

  const image = inspectComplaintImage(file);
  const storageKey = createStorageKey(
    complaint.id,
    image.extension,
    createId
  );

  try {
    await storage.write(storageKey, image.buffer);
  } catch {
    fail(
      503,
      "ATTACHMENT_STORAGE_UNAVAILABLE",
      "The attachment could not be stored. Please try again"
    );
  }

  try {
    return await database.transaction(async (transaction) => {
      await lockComplaint(transaction, complaint.id);
      const currentComplaint = await loadComplaint(transaction, complaint.id);
      assertSubmissionUploadAllowed(actor, currentComplaint);

      const [totalResult] = await transaction
        .select({ total: count() })
        .from(complaintAttachments)
        .where(
          and(
            eq(complaintAttachments.complaintId, complaint.id),
            eq(
              complaintAttachments.purpose,
              COMPLAINT_ATTACHMENT_PURPOSES.SUBMISSION
            )
          )
        );

      if (Number(totalResult?.total ?? 0) >= MAX_COMPLAINT_ATTACHMENTS) {
        fail(
          409,
          "ATTACHMENT_LIMIT_REACHED",
          `A complaint can have at most ${MAX_COMPLAINT_ATTACHMENTS} submission images`
        );
      }

      const [attachment] = await transaction
        .insert(complaintAttachments)
        .values({
          complaintId: complaint.id,
          uploadedByUserId: actor.id,
          purpose: COMPLAINT_ATTACHMENT_PURPOSES.SUBMISSION,
          storageKey,
          originalName: image.originalName,
          mimeType: image.mimeType,
          sizeBytes: image.sizeBytes,
          sha256: getChecksum(image.buffer),
          createdAt,
        })
        .returning(attachmentSelection);

      await appendAuditEvent(transaction, {
        actor,
        category: AUDIT_CATEGORIES.COMPLAINT,
        action: AUDIT_ACTIONS.COMPLAINT_ATTACHMENT_ADDED,
        resourceType: AUDIT_RESOURCE_TYPES.COMPLAINT_ATTACHMENT,
        resourceId: attachment.id,
        description: "Added private evidence to a maintenance complaint",
        metadata: {
          complaintId: complaint.id,
          purpose: attachment.purpose,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
        },
        assignedHostels: [
          { id: complaint.hostelId, code: complaint.hostelCode },
        ],
        createdAt,
      });

      return toAttachmentView(attachment);
    });
  } catch (error) {
    await removeStoredFile(storage, storageKey);
    throw error;
  }
};

export const listComplaintAttachments = async (
  database,
  requestActor,
  complaintId
) => {
  const { complaint } = await loadAccessContext(
    database,
    requestActor,
    complaintId
  );
  const records = await database
    .select(attachmentSelection)
    .from(complaintAttachments)
    .where(eq(complaintAttachments.complaintId, complaint.id))
    .orderBy(asc(complaintAttachments.createdAt), asc(complaintAttachments.id));

  return records.map(toAttachmentView);
};

export const downloadComplaintAttachment = async (
  database,
  requestActor,
  complaintId,
  attachmentId,
  { storage = privateFileStorage } = {}
) => {
  const { complaint } = await loadAccessContext(
    database,
    requestActor,
    complaintId
  );
  const attachment = await loadAttachment(
    database,
    complaint.id,
    attachmentId
  );

  let contents;
  try {
    contents = await storage.read(attachment.storageKey);
  } catch {
    fail(
      503,
      "ATTACHMENT_UNAVAILABLE",
      "The attachment is temporarily unavailable"
    );
  }

  if (getChecksum(contents) !== attachment.sha256) {
    fail(
      503,
      "ATTACHMENT_UNAVAILABLE",
      "The attachment is temporarily unavailable"
    );
  }

  return {
    ...toAttachmentView(attachment),
    contents,
  };
};

export const deleteComplaintAttachment = async (
  database,
  requestActor,
  complaintId,
  attachmentId,
  { storage = privateFileStorage, now = new Date() } = {}
) => {
  const deletedAt = requireOperationTime(now);
  const access = await loadAccessContext(database, requestActor, complaintId);
  const originalAttachment = await loadAttachment(
    database,
    access.complaint.id,
    attachmentId
  );
  assertDeleteAllowed(access.actor, access.complaint, originalAttachment);

  let backup = null;
  let removed = false;

  try {
    await database.transaction(async (transaction) => {
      await lockComplaint(transaction, access.complaint.id);
      const { actor, complaint } = await loadAccessContext(
        transaction,
        requestActor,
        access.complaint.id
      );
      const attachment = await loadAttachment(
        transaction,
        complaint.id,
        originalAttachment.id
      );
      assertDeleteAllowed(actor, complaint, attachment);

      try {
        backup = await storage.read(attachment.storageKey);
        await storage.remove(attachment.storageKey);
        removed = true;
      } catch {
        fail(
          503,
          "ATTACHMENT_STORAGE_UNAVAILABLE",
          "The attachment could not be deleted. Please try again"
        );
      }

      await transaction
        .delete(complaintAttachments)
        .where(eq(complaintAttachments.id, attachment.id));

      await appendAuditEvent(transaction, {
        actor,
        category: AUDIT_CATEGORIES.COMPLAINT,
        action: AUDIT_ACTIONS.COMPLAINT_ATTACHMENT_DELETED,
        resourceType: AUDIT_RESOURCE_TYPES.COMPLAINT_ATTACHMENT,
        resourceId: attachment.id,
        description: "Deleted private evidence from a maintenance complaint",
        metadata: {
          complaintId: complaint.id,
          purpose: attachment.purpose,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
        },
        assignedHostels: [
          { id: complaint.hostelId, code: complaint.hostelCode },
        ],
        createdAt: deletedAt,
      });
    });
  } catch (error) {
    if (removed && backup) {
      try {
        await storage.write(originalAttachment.storageKey, backup);
      } catch {
        fail(
          503,
          "ATTACHMENT_STORAGE_UNAVAILABLE",
          "The attachment deletion could not be completed safely"
        );
      }
    }
    throw error;
  }

  return { id: originalAttachment.id };
};
