import { randomUUID } from "node:crypto";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { and, eq, exists } from "drizzle-orm";
import {
  gatePasses,
  hostelMemberships,
  hostels,
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
import { LEAVE_EVENT_TYPES, LEAVE_STATUSES } from "../domain/leaveWorkflow.js";
import { USER_ROLES } from "../domain/roles.js";
import { ApiError } from "../utils/apiErrors.js";
import { appendAuditEvent } from "./auditEventService.js";
import { privateFileStorage } from "./privateFileStorage.js";
import { createSecureToken, hashSecureToken } from "./secureTokenService.js";

const passReaderRoles = new Set([
  USER_ROLES.STUDENT,
  USER_ROLES.WARDEN,
  USER_ROLES.GUARD,
  USER_ROLES.ADMIN,
]);
const TOKEN_ATTEMPTS = 3;

const fail = (status, code, message) => {
  throw new ApiError(status, code, message);
};

const removeArtifacts = async (storage, storageKeys) => {
  await Promise.allSettled(storageKeys.map((key) => storage.remove(key)));
};

const writeArtifacts = async (storage, artifacts) => {
  const writtenKeys = [];

  try {
    for (const artifact of artifacts) {
      await storage.write(artifact.key, artifact.contents);
      writtenKeys.push(artifact.key);
    }
  } catch {
    await removeArtifacts(storage, writtenKeys);
    fail(
      503,
      "GATE_PASS_STORAGE_UNAVAILABLE",
      "The gate pass files could not be stored. Please try approval again."
    );
  }
};

const collectPdf = (document) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    document.on("data", (chunk) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });

export const renderGatePassQr = (payload) =>
  QRCode.toBuffer(payload, {
    type: "png",
    width: 320,
    margin: 2,
    errorCorrectionLevel: "M",
  });

export const renderGatePassPdf = async ({
  leaveRequest,
  token,
  qrBuffer,
  validFrom,
  expiresAt,
}) => {
  const document = new PDFDocument({ size: "A4", margin: 48 });
  const output = collectPdf(document);

  document.font("Helvetica-Bold").fontSize(19).text("HOSTELMATE", {
    align: "center",
  });
  document.fontSize(13).text("Approved Student Gate Pass", { align: "center" });
  document.moveDown(1.5);
  document
    .strokeColor("#d6dbe5")
    .moveTo(48, document.y)
    .lineTo(547, document.y)
    .stroke();
  document.moveDown();

  document.font("Helvetica-Bold").fontSize(11).text("Student");
  document.font("Helvetica").text(leaveRequest.studentName);
  document.text(`Roll number: ${leaveRequest.studentRollNo}`);
  document.text(`Hostel: ${leaveRequest.hostelName} (${leaveRequest.hostelCode})`);
  document.moveDown();
  document.font("Helvetica-Bold").text("Approved leave window");
  document.font("Helvetica").text(`Valid from: ${validFrom.toISOString()}`);
  document.text(`Valid until: ${expiresAt.toISOString()}`);
  document.text(`Reason: ${leaveRequest.reason}`);
  document.moveDown();

  document.image(qrBuffer, { fit: [180, 180], align: "center" });
  document.moveDown(0.5);
  document
    .font("Helvetica-Bold")
    .fontSize(9)
    .text("Manual verification token", { align: "center" });
  document.font("Courier").fontSize(7).text(token, { align: "center" });
  document.moveDown();
  document
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#4b5563")
    .text(
      "This pass is valid only when the live HostelMate record is active. Gate staff must verify it before recording movement.",
      { align: "center" }
    );
  document.end();

  return output;
};

const toPublicPass = (pass, leaveRequestId) => ({
  id: pass.id,
  leaveRequestId: pass.leaveRequestId,
  issuedAt: pass.issuedAt,
  validFrom: pass.validFrom,
  expiresAt: pass.expiresAt,
  revokedAt: pass.revokedAt,
  revocationReason: pass.revocationReason,
  qrUrl: `/api/leave/${leaveRequestId}/pass/qr`,
  pdfUrl: `/api/leave/${leaveRequestId}/pass/pdf`,
});

export const issueGatePass = async (
  transaction,
  { actor, leaveRequest, issuedAt },
  {
    storage = privateFileStorage,
    createToken = createSecureToken,
    createId = randomUUID,
    renderQr = renderGatePassQr,
    renderPdf = renderGatePassPdf,
  } = {}
) => {
  const departureAt = new Date(leaveRequest.departureAt);
  const expiresAt = new Date(leaveRequest.expectedReturnAt);

  if (expiresAt.getTime() <= issuedAt.getTime()) {
    fail(
      409,
      "LEAVE_WINDOW_EXPIRED",
      "A leave request cannot be approved after its expected return time"
    );
  }

  const validFrom = new Date(
    Math.max(departureAt.getTime(), issuedAt.getTime())
  );

  for (let attempt = 0; attempt < TOKEN_ATTEMPTS; attempt += 1) {
    const token = createToken();
    const tokenHash = hashSecureToken(token);
    const artifactId = createId();
    const qrStorageKey = `gate-passes/${leaveRequest.id}/${artifactId}.png`;
    const pdfStorageKey = `gate-passes/${leaveRequest.id}/${artifactId}.pdf`;
    let qrBuffer;
    let pdfBuffer;

    try {
      const payload = `hostelmate://gate-pass/${token}`;
      qrBuffer = await renderQr(payload);
      pdfBuffer = await renderPdf({
        leaveRequest,
        token,
        qrBuffer,
        validFrom,
        expiresAt,
      });
    } catch {
      fail(
        503,
        "GATE_PASS_RENDER_FAILED",
        "The gate pass could not be generated. Please try approval again."
      );
    }

    const storageKeys = [qrStorageKey, pdfStorageKey];
    await writeArtifacts(storage, [
      { key: qrStorageKey, contents: qrBuffer },
      { key: pdfStorageKey, contents: pdfBuffer },
    ]);

    try {
      const [pass] = await transaction
        .insert(gatePasses)
        .values({
          leaveRequestId: leaveRequest.id,
          tokenHash,
          issuedByUserId: actor.id,
          issuedAt,
          validFrom,
          expiresAt,
          qrStorageKey,
          pdfStorageKey,
        })
        .onConflictDoNothing({ target: gatePasses.tokenHash })
        .returning();

      if (!pass) {
        await removeArtifacts(storage, storageKeys);
        continue;
      }

      await transaction.insert(leaveEvents).values({
        leaveRequestId: leaveRequest.id,
        eventType: LEAVE_EVENT_TYPES.PASS_ISSUED,
        fromStatus: LEAVE_STATUSES.APPROVED,
        toStatus: LEAVE_STATUSES.APPROVED,
        actorUserId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        note: "Secure gate pass issued",
        metadata: {
          gatePassId: pass.id,
          validFrom: validFrom.toISOString(),
          expiresAt: expiresAt.toISOString(),
        },
        occurredAt: issuedAt,
      });

      await appendAuditEvent(transaction, {
        actor,
        category: AUDIT_CATEGORIES.GATE,
        action: AUDIT_ACTIONS.GATE_PASS_ISSUED,
        resourceType: AUDIT_RESOURCE_TYPES.GATE_PASS,
        resourceId: pass.id,
        description: "Issued a secure gate pass for approved leave",
        metadata: {
          leaveRequestId: leaveRequest.id,
          studentUserId: leaveRequest.studentUserId,
          expiresAt: expiresAt.toISOString(),
        },
        assignedHostels: [
          { id: leaveRequest.hostelId, code: leaveRequest.hostelCode },
        ],
        createdAt: issuedAt,
      });

      return {
        pass: toPublicPass(pass, leaveRequest.id),
        cleanup: () => removeArtifacts(storage, storageKeys),
      };
    } catch (error) {
      await removeArtifacts(storage, storageKeys);
      throw error;
    }
  }

  fail(
    503,
    "GATE_PASS_TOKEN_UNAVAILABLE",
    "A unique gate pass could not be created. Please try approval again."
  );
};

const loadPassActor = async (database, requestActor) => {
  const actorId = Number(requestActor?.id);

  if (!Number.isSafeInteger(actorId) || actorId < 1) {
    fail(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  }

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
    actor.accountStatus !== ACCOUNT_STATUSES.ACTIVE ||
    !passReaderRoles.has(actor.role)
  ) {
    fail(403, "GATE_PASS_ACCESS_DENIED", "You cannot access this gate pass");
  }

  return actor;
};

const loadScopedPass = async (database, requestActor, leaveRequestId) => {
  const actor = await loadPassActor(database, requestActor);
  const id = Number(leaveRequestId);

  if (!Number.isSafeInteger(id) || id < 1) {
    fail(400, "INVALID_REQUEST", "Leave request ID must be a positive integer");
  }

  const conditions = [eq(leaveRequests.id, id)];

  if (actor.role === USER_ROLES.STUDENT) {
    conditions.push(eq(leaveRequests.studentUserId, actor.id));
  } else if (actor.role !== USER_ROLES.ADMIN) {
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

  const [record] = await database
    .select({
      id: gatePasses.id,
      leaveRequestId: gatePasses.leaveRequestId,
      issuedAt: gatePasses.issuedAt,
      validFrom: gatePasses.validFrom,
      expiresAt: gatePasses.expiresAt,
      qrStorageKey: gatePasses.qrStorageKey,
      pdfStorageKey: gatePasses.pdfStorageKey,
      revokedAt: gatePasses.revokedAt,
      revocationReason: gatePasses.revocationReason,
      leaveStatus: leaveRequests.status,
      studentName: users.name,
      studentRollNo: studentProfiles.rollNo,
      hostelId: hostels.id,
      hostelCode: hostels.code,
      hostelName: hostels.name,
    })
    .from(gatePasses)
    .innerJoin(leaveRequests, eq(gatePasses.leaveRequestId, leaveRequests.id))
    .innerJoin(users, eq(leaveRequests.studentUserId, users.id))
    .innerJoin(
      studentProfiles,
      eq(leaveRequests.studentProfileId, studentProfiles.id)
    )
    .innerJoin(hostels, eq(leaveRequests.hostelId, hostels.id))
    .where(and(...conditions))
    .limit(1);

  if (!record) {
    // The same response hides both nonexistent and out-of-scope passes.
    fail(404, "GATE_PASS_NOT_FOUND", "Gate pass not found");
  }

  return record;
};

export const getGatePass = async (
  database,
  requestActor,
  leaveRequestId,
  { now = new Date() } = {}
) => {
  const record = await loadScopedPass(database, requestActor, leaveRequestId);
  const expired = record.expiresAt.getTime() <= now.getTime();
  const activeWindow =
    record.validFrom.getTime() <= now.getTime() && !expired;
  const revoked = Boolean(record.revokedAt);

  return {
    ...toPublicPass(record, record.leaveRequestId),
    status: record.leaveStatus,
    expired,
    revoked,
    usable:
      record.leaveStatus === LEAVE_STATUSES.APPROVED &&
      activeWindow &&
      !revoked,
    student: {
      name: record.studentName,
      rollNo: record.studentRollNo,
    },
    hostel: {
      id: record.hostelId,
      code: record.hostelCode,
      name: record.hostelName,
    },
  };
};

export const readGatePassArtifact = async (
  database,
  requestActor,
  leaveRequestId,
  kind,
  { storage = privateFileStorage } = {}
) => {
  const record = await loadScopedPass(database, requestActor, leaveRequestId);
  const isQr = kind === "qr";
  const storageKey = isQr ? record.qrStorageKey : record.pdfStorageKey;

  if (!storageKey) {
    fail(404, "GATE_PASS_ARTIFACT_NOT_FOUND", "Gate pass file not found");
  }

  try {
    return {
      contents: await storage.read(storageKey),
      mimeType: isQr ? "image/png" : "application/pdf",
      filename: `hostelmate-gate-pass-${record.leaveRequestId}.${
        isQr ? "png" : "pdf"
      }`,
    };
  } catch {
    fail(
      503,
      "GATE_PASS_STORAGE_UNAVAILABLE",
      "The gate pass file is temporarily unavailable"
    );
  }
};
