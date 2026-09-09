import { and, eq, exists } from "drizzle-orm";
import {
  gatePasses,
  hostelBlocks,
  hostelMemberships,
  hostels,
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
import { hashSecureToken } from "./secureTokenService.js";

const QR_PREFIX = "hostelmate://gate-pass/";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const verifierRoles = new Set([USER_ROLES.GUARD, USER_ROLES.ADMIN]);

export const GATE_ACTIONS = Object.freeze({
  EXIT: "exit",
  RETURN: "return",
});

export const PASS_VERIFICATION_CODES = Object.freeze({
  VALID: "PASS_VALID",
  NOT_FOUND: "PASS_NOT_FOUND",
  NOT_YET_VALID: "PASS_NOT_YET_VALID",
  EXPIRED: "PASS_EXPIRED",
  REVOKED: "PASS_REVOKED",
  PENDING: "LEAVE_PENDING",
  REJECTED: "LEAVE_REJECTED",
  COMPLETED: "LEAVE_COMPLETED",
  STUDENT_INACTIVE: "STUDENT_ACCOUNT_INACTIVE",
  HOSTEL_INACTIVE: "HOSTEL_INACTIVE",
  INVALID_STATE: "INVALID_LEAVE_STATE",
});

const invalidResult = (code, message, currentState = null) => ({
  valid: false,
  code,
  message,
  currentState,
  permittedAction: null,
});

export const normalizeGatePassCredential = (credential) => {
  const value = typeof credential === "string" ? credential.trim() : "";
  const isQrPayload = value.startsWith(QR_PREFIX);
  const token = isQrPayload ? value.slice(QR_PREFIX.length) : value;

  if (!TOKEN_PATTERN.test(token)) {
    return null;
  }

  return Object.freeze({
    tokenHash: hashSecureToken(token),
    verificationMethod: isQrPayload ? "qr" : "manual",
  });
};

export const evaluateGatePass = (record, now = new Date()) => {
  if (!record) {
    return invalidResult(
      PASS_VERIFICATION_CODES.NOT_FOUND,
      "No gate pass matches this credential"
    );
  }

  const currentState = record.leaveStatus;

  if (record.revokedAt) {
    return invalidResult(
      PASS_VERIFICATION_CODES.REVOKED,
      "This gate pass has been revoked",
      currentState
    );
  }
  if (record.studentAccountStatus !== ACCOUNT_STATUSES.ACTIVE) {
    return invalidResult(
      PASS_VERIFICATION_CODES.STUDENT_INACTIVE,
      "The student's account is not active",
      currentState
    );
  }
  if (!record.hostelIsActive) {
    return invalidResult(
      PASS_VERIFICATION_CODES.HOSTEL_INACTIVE,
      "The hostel is not active",
      currentState
    );
  }
  if (currentState === LEAVE_STATUSES.PENDING) {
    return invalidResult(
      PASS_VERIFICATION_CODES.PENDING,
      "The leave request is awaiting approval",
      currentState
    );
  }
  if (currentState === LEAVE_STATUSES.REJECTED) {
    return invalidResult(
      PASS_VERIFICATION_CODES.REJECTED,
      "The leave request was rejected",
      currentState
    );
  }
  if (currentState === LEAVE_STATUSES.RETURNED) {
    return invalidResult(
      PASS_VERIFICATION_CODES.COMPLETED,
      "The student has already returned",
      currentState
    );
  }
  if (currentState === LEAVE_STATUSES.EXPIRED) {
    return invalidResult(
      PASS_VERIFICATION_CODES.EXPIRED,
      "This gate pass has expired",
      currentState
    );
  }

  if (now.getTime() < record.validFrom.getTime()) {
    return invalidResult(
      PASS_VERIFICATION_CODES.NOT_YET_VALID,
      "This gate pass is not valid yet",
      currentState
    );
  }
  if (now.getTime() >= record.expiresAt.getTime()) {
    return invalidResult(
      PASS_VERIFICATION_CODES.EXPIRED,
      "This gate pass has expired",
      currentState
    );
  }

  if (currentState === LEAVE_STATUSES.APPROVED) {
    return {
      valid: true,
      code: PASS_VERIFICATION_CODES.VALID,
      message: "Pass verified. The student may exit.",
      currentState,
      permittedAction: GATE_ACTIONS.EXIT,
    };
  }
  if (currentState === LEAVE_STATUSES.EXITED) {
    return {
      valid: true,
      code: PASS_VERIFICATION_CODES.VALID,
      message: "Pass verified. The student may return.",
      currentState,
      permittedAction: GATE_ACTIONS.RETURN,
    };
  }

  return invalidResult(
    PASS_VERIFICATION_CODES.INVALID_STATE,
    "The leave request is not in a verifiable state",
    currentState
  );
};

export const loadGateVerifier = async (database, requestActor) => {
  const actorId = Number(requestActor?.id);

  if (!Number.isSafeInteger(actorId) || actorId < 1) {
    throw new ApiError(
      401,
      "AUTHENTICATION_REQUIRED",
      "Authentication is required"
    );
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

  if (
    !actor ||
    actor.accountStatus !== ACCOUNT_STATUSES.ACTIVE ||
    !verifierRoles.has(actor.role)
  ) {
    throw new ApiError(
      403,
      "GATE_VERIFICATION_DENIED",
      "Only active guards and administrators can verify gate passes"
    );
  }

  return actor;
};

export const loadScopedPassByHash = async (
  database,
  actor,
  tokenHash,
  { lock = false } = {}
) => {
  const conditions = [eq(gatePasses.tokenHash, tokenHash)];

  if (actor.role === USER_ROLES.GUARD) {
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

  const query = database
    .select({
      gatePassId: gatePasses.id,
      leaveRequestId: leaveRequests.id,
      leaveStatus: leaveRequests.status,
      validFrom: gatePasses.validFrom,
      expiresAt: gatePasses.expiresAt,
      revokedAt: gatePasses.revokedAt,
      studentUserId: leaveRequests.studentUserId,
      studentName: users.name,
      studentAccountStatus: users.accountStatus,
      rollNo: studentProfiles.rollNo,
      hostelId: hostels.id,
      hostelCode: hostels.code,
      hostelName: hostels.name,
      hostelIsActive: hostels.isActive,
      blockCode: hostelBlocks.code,
      roomNumber: rooms.roomNumber,
    })
    .from(gatePasses)
    .innerJoin(leaveRequests, eq(gatePasses.leaveRequestId, leaveRequests.id))
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
    .where(and(...conditions));
  const [record] = lock
    ? await query.for("update", { of: leaveRequests }).limit(1)
    : await query.limit(1);

  return record ?? null;
};

export const toPublicGatePassDetails = (record) => {
  if (!record) return null;

  return {
    pass: {
      id: record.gatePassId,
      leaveRequestId: record.leaveRequestId,
      validFrom: record.validFrom,
      expiresAt: record.expiresAt,
    },
    student: {
      name: record.studentName,
      rollNo: record.rollNo,
      room:
        record.roomNumber === null
          ? null
          : { blockCode: record.blockCode, roomNumber: record.roomNumber },
    },
    hostel: {
      id: record.hostelId,
      code: record.hostelCode,
      name: record.hostelName,
    },
  };
};

export const verifySecureGatePass = async (
  database,
  requestActor,
  credential,
  { now = new Date() } = {}
) => {
  const actor = await loadGateVerifier(database, requestActor);
  const normalizedCredential = normalizeGatePassCredential(credential);

  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new ApiError(400, "INVALID_REQUEST", "Verification time is invalid");
  }

  if (!normalizedCredential) {
    return {
      ...invalidResult(
        PASS_VERIFICATION_CODES.NOT_FOUND,
        "No gate pass matches this credential"
      ),
      verificationMethod: "manual",
      details: null,
    };
  }

  const record = await loadScopedPassByHash(
    database,
    actor,
    normalizedCredential.tokenHash
  );
  const result = evaluateGatePass(record, now);

  return {
    ...result,
    verificationMethod: normalizedCredential.verificationMethod,
    details: toPublicGatePassDetails(record),
  };
};
