import bcrypt from "bcryptjs";
import { and, eq, isNull, or } from "drizzle-orm";
import {
  approvedStudents,
  hostelMemberships,
  hostels,
  studentActivationTokens,
  users,
} from "../db/schema.js";
import { ACCOUNT_STATUSES } from "../domain/accountStatuses.js";
import {
  isPasswordAllowed,
  PASSWORD_POLICY_MESSAGE,
} from "../domain/passwordPolicy.js";
import { normalizeEmail, USER_ROLES } from "../domain/roles.js";
import { ApiError } from "../utils/apiErrors.js";
import {
  createSecureToken,
  hashSecureToken,
} from "./secureTokenService.js";

export const STUDENT_ACTIVATION_TTL_MS = 30 * 60 * 1000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HOSTEL_CODE_PATTERN = /^[A-Z][A-Z0-9-]{0,19}$/;
const ROLL_NO_PATTERN = /^[A-Z0-9][A-Z0-9 /-]{1,49}$/;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export class StudentActivationError extends ApiError {
  constructor(statusCode, code, message) {
    super(statusCode, code, message);
    this.name = "StudentActivationError";
  }
}

const fail = (statusCode, code, message) => {
  throw new StudentActivationError(statusCode, code, message);
};

const requirePositiveInteger = (value, fieldName) => {
  const number = Number(value);

  if (!Number.isSafeInteger(number) || number < 1) {
    fail(400, "INVALID_REQUEST", `${fieldName} must be a positive integer`);
  }

  return number;
};

const normalizeRollNo = (rollNo) =>
  typeof rollNo === "string"
    ? rollNo.trim().replace(/\s+/g, " ").toUpperCase()
    : "";

const validateIdentity = ({ email, rollNo }) => {
  if (!EMAIL_PATTERN.test(email) || email.length > 255) {
    fail(400, "INVALID_EMAIL", "A valid student email address is required");
  }

  if (!ROLL_NO_PATTERN.test(rollNo)) {
    fail(400, "INVALID_ROLL_NO", "A valid student roll number is required");
  }
};

export const normalizeStudentApprovalInput = (input = {}) => {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email =
    typeof input.email === "string" ? normalizeEmail(input.email) : "";
  const rollNo = normalizeRollNo(input.rollNo);
  const hostelCode =
    typeof input.hostelCode === "string"
      ? input.hostelCode.trim().toUpperCase()
      : "";

  if (name.length < 2 || name.length > 255) {
    fail(400, "INVALID_NAME", "Name must contain between 2 and 255 characters");
  }

  validateIdentity({ email, rollNo });

  if (!HOSTEL_CODE_PATTERN.test(hostelCode)) {
    fail(400, "INVALID_HOSTEL", "A valid hostel code is required");
  }

  return { name, email, rollNo, hostelCode };
};

export const normalizeStudentActivationRequest = (input = {}) => {
  const email =
    typeof input.email === "string" ? normalizeEmail(input.email) : "";
  const rollNo = normalizeRollNo(input.rollNo);

  validateIdentity({ email, rollNo });
  return { email, rollNo };
};

const validateActivationToken = (token) => {
  if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) {
    fail(
      400,
      "ACTIVATION_UNAVAILABLE",
      "The activation link is invalid, expired, or already used"
    );
  }

  return token;
};

const isActivationTokenUnavailable = (tokenRecord, now) =>
  !tokenRecord ||
  Boolean(tokenRecord.usedAt) ||
  Boolean(tokenRecord.revokedAt) ||
  tokenRecord.expiresAt <= now;

const failUnavailableActivation = () => {
  fail(
    400,
    "ACTIVATION_UNAVAILABLE",
    "The activation link is invalid, expired, or already used"
  );
};

const validatePassword = (password) => {
  if (!isPasswordAllowed(password)) {
    fail(400, "WEAK_PASSWORD", PASSWORD_POLICY_MESSAGE);
  }

  return password;
};

export const approveStudent = async (
  database,
  input,
  actorId,
  { now = new Date() } = {}
) => {
  const approvedByUserId = requirePositiveInteger(actorId, "Actor ID");
  const values = normalizeStudentApprovalInput(input);

  return database.transaction(async (transaction) => {
    const [hostel] = await transaction
      .select({ id: hostels.id, code: hostels.code, name: hostels.name })
      .from(hostels)
      .where(and(eq(hostels.code, values.hostelCode), eq(hostels.isActive, true)))
      .for("share")
      .limit(1);

    if (!hostel) {
      fail(400, "HOSTEL_NOT_FOUND", "The selected hostel is not active");
    }

    const [existingUser] = await transaction
      .select({ id: users.id })
      .from(users)
      .where(or(eq(users.email, values.email), eq(users.rollNo, values.rollNo)))
      .limit(1);

    if (existingUser) {
      fail(
        409,
        "STUDENT_ACCOUNT_EXISTS",
        "An account already uses this email or roll number"
      );
    }

    const [existingApproval] = await transaction
      .select({ id: approvedStudents.id })
      .from(approvedStudents)
      .where(
        or(
          eq(approvedStudents.email, values.email),
          eq(approvedStudents.rollNo, values.rollNo)
        )
      )
      .limit(1);

    if (existingApproval) {
      fail(
        409,
        "STUDENT_ALREADY_APPROVED",
        "An approved record already uses this email or roll number"
      );
    }

    const [approval] = await transaction
      .insert(approvedStudents)
      .values({
        name: values.name,
        email: values.email,
        rollNo: values.rollNo,
        hostelId: hostel.id,
        approvedByUserId,
        approvedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .returning({
        id: approvedStudents.id,
        name: approvedStudents.name,
        email: approvedStudents.email,
        rollNo: approvedStudents.rollNo,
        approvedAt: approvedStudents.approvedAt,
      });

    return { approval: { ...approval, hostel } };
  });
};

export const requestStudentActivation = async (
  database,
  input,
  { now = new Date(), token = createSecureToken() } = {}
) => {
  const identity = normalizeStudentActivationRequest(input);
  const expiresAt = new Date(now.getTime() + STUDENT_ACTIVATION_TTL_MS);

  return database.transaction(async (transaction) => {
    const [approval] = await transaction
      .select({
        id: approvedStudents.id,
        name: approvedStudents.name,
        email: approvedStudents.email,
        rollNo: approvedStudents.rollNo,
        hostelId: approvedStudents.hostelId,
      })
      .from(approvedStudents)
      .where(
        and(
          eq(approvedStudents.email, identity.email),
          eq(approvedStudents.rollNo, identity.rollNo),
          isNull(approvedStudents.activatedAt),
          isNull(approvedStudents.revokedAt)
        )
      )
      .for("update")
      .limit(1);

    if (!approval) {
      return { issued: false };
    }

    const [activeHostel] = await transaction
      .select({ id: hostels.id })
      .from(hostels)
      .where(and(eq(hostels.id, approval.hostelId), eq(hostels.isActive, true)))
      .limit(1);

    const [existingUser] = await transaction
      .select({ id: users.id })
      .from(users)
      .where(
        or(eq(users.email, approval.email), eq(users.rollNo, approval.rollNo))
      )
      .limit(1);

    if (!activeHostel || existingUser) {
      return { issued: false };
    }

    await transaction
      .update(studentActivationTokens)
      .set({ revokedAt: now })
      .where(
        and(
          eq(studentActivationTokens.approvedStudentId, approval.id),
          isNull(studentActivationTokens.usedAt),
          isNull(studentActivationTokens.revokedAt)
        )
      );

    const [tokenRecord] = await transaction
      .insert(studentActivationTokens)
      .values({
        approvedStudentId: approval.id,
        tokenHash: hashSecureToken(token),
        expiresAt,
        createdAt: now,
      })
      .returning({ id: studentActivationTokens.id });

    return {
      issued: true,
      tokenId: tokenRecord.id,
      token,
      name: approval.name,
      email: approval.email,
      expiresAt,
    };
  });
};

export const revokeStudentActivationToken = async (
  database,
  tokenId,
  { now = new Date() } = {}
) => {
  const id = requirePositiveInteger(tokenId, "Token ID");

  await database
    .update(studentActivationTokens)
    .set({ revokedAt: now })
    .where(
      and(
        eq(studentActivationTokens.id, id),
        isNull(studentActivationTokens.usedAt),
        isNull(studentActivationTokens.revokedAt)
      )
    );
};

export const completeStudentActivation = async (
  database,
  input = {},
  { now = new Date() } = {}
) => {
  const token = validateActivationToken(input.token);
  const password = validatePassword(input.password);
  const tokenHash = hashSecureToken(token);

  const [knownToken] = await database
    .select({
      usedAt: studentActivationTokens.usedAt,
      revokedAt: studentActivationTokens.revokedAt,
      expiresAt: studentActivationTokens.expiresAt,
    })
    .from(studentActivationTokens)
    .where(eq(studentActivationTokens.tokenHash, tokenHash))
    .limit(1);

  if (isActivationTokenUnavailable(knownToken, now)) {
    failUnavailableActivation();
  }

  const passwordHash = await bcrypt.hash(password, 12);

  return database.transaction(async (transaction) => {
    const [tokenRecord] = await transaction
      .select()
      .from(studentActivationTokens)
      .where(eq(studentActivationTokens.tokenHash, tokenHash))
      .for("update")
      .limit(1);

    if (isActivationTokenUnavailable(tokenRecord, now)) {
      failUnavailableActivation();
    }

    const [approval] = await transaction
      .select()
      .from(approvedStudents)
      .where(eq(approvedStudents.id, tokenRecord.approvedStudentId))
      .for("update")
      .limit(1);

    if (
      !approval ||
      approval.activatedAt ||
      approval.activatedUserId ||
      approval.revokedAt
    ) {
      failUnavailableActivation();
    }

    const [hostel] = await transaction
      .select({ id: hostels.id, code: hostels.code, name: hostels.name })
      .from(hostels)
      .where(and(eq(hostels.id, approval.hostelId), eq(hostels.isActive, true)))
      .for("share")
      .limit(1);

    if (!hostel) {
      fail(409, "HOSTEL_UNAVAILABLE", "The approved hostel is not active");
    }

    const [existingUser] = await transaction
      .select({ id: users.id })
      .from(users)
      .where(
        or(eq(users.email, approval.email), eq(users.rollNo, approval.rollNo))
      )
      .limit(1);

    if (existingUser) {
      fail(
        409,
        "STUDENT_ACCOUNT_EXISTS",
        "An account already uses this email or roll number"
      );
    }

    const [user] = await transaction
      .insert(users)
      .values({
        name: approval.name,
        email: approval.email,
        password: passwordHash,
        role: USER_ROLES.STUDENT,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
        emailVerifiedAt: now,
        rollNo: approval.rollNo,
        createdAt: now,
        updatedAt: now,
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        rollNo: users.rollNo,
        role: users.role,
        accountStatus: users.accountStatus,
        emailVerifiedAt: users.emailVerifiedAt,
      });

    await transaction.insert(hostelMemberships).values({
      userId: user.id,
      hostelId: hostel.id,
      isPrimary: true,
      createdAt: now,
    });

    await transaction
      .update(approvedStudents)
      .set({
        activatedUserId: user.id,
        activatedAt: now,
        updatedAt: now,
      })
      .where(eq(approvedStudents.id, approval.id));

    await transaction
      .update(studentActivationTokens)
      .set({ usedAt: now })
      .where(eq(studentActivationTokens.id, tokenRecord.id));

    return { user: { ...user, hostel } };
  });
};
