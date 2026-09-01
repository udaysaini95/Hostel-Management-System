import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, inArray, isNull } from "drizzle-orm";
import {
  hostelMemberships,
  hostels,
  staffInvitationHostels,
  staffInvitations,
  users,
} from "../db/schema.js";
import { ACCOUNT_STATUSES } from "../domain/accountStatuses.js";
import { normalizeEmail, USER_ROLES } from "../domain/roles.js";

export const STAFF_INVITATION_TTL_MS = 24 * 60 * 60 * 1000;
export const STAFF_INVITATION_TOKEN_BYTES = 32;
export const STAFF_PASSWORD_MIN_LENGTH = 12;
export const STAFF_PASSWORD_MAX_BYTES = 72;
export const INVITABLE_STAFF_ROLES = Object.freeze([
  USER_ROLES.WARDEN,
  USER_ROLES.MAINTENANCE,
  USER_ROLES.GUARD,
]);
export const MANAGED_ACCOUNT_STATUSES = Object.freeze([
  ACCOUNT_STATUSES.ACTIVE,
  ACCOUNT_STATUSES.SUSPENDED,
]);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HOSTEL_CODE_PATTERN = /^[A-Z][A-Z0-9-]{0,19}$/;
const invitableRoles = new Set(INVITABLE_STAFF_ROLES);
const managedStatuses = new Set(MANAGED_ACCOUNT_STATUSES);

export class StaffAccountError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = "StaffAccountError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

const fail = (statusCode, code, message) => {
  throw new StaffAccountError(statusCode, code, message);
};

const requirePositiveInteger = (value, fieldName) => {
  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    fail(400, "INVALID_REQUEST", `${fieldName} must be a positive integer`);
  }

  return parsed;
};

export const createInvitationToken = () =>
  randomBytes(STAFF_INVITATION_TOKEN_BYTES).toString("base64url");

export const hashInvitationToken = (token) => {
  if (typeof token !== "string" || token.length === 0) {
    fail(400, "INVALID_INVITATION", "Invitation token is required");
  }

  return createHash("sha256").update(token).digest("hex");
};

export const validateStaffPassword = (password) => {
  if (
    typeof password !== "string" ||
    password.length < STAFF_PASSWORD_MIN_LENGTH ||
    Buffer.byteLength(password, "utf8") > STAFF_PASSWORD_MAX_BYTES
  ) {
    fail(
      400,
      "WEAK_PASSWORD",
      `Password must contain at least ${STAFF_PASSWORD_MIN_LENGTH} characters and at most ${STAFF_PASSWORD_MAX_BYTES} UTF-8 bytes`
    );
  }

  return password;
};

export const normalizeStaffInvitationInput = (input = {}) => {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email =
    typeof input.email === "string" ? normalizeEmail(input.email) : "";
  const role = input.role;
  const hostelCodes = Array.isArray(input.hostelCodes)
    ? [
        ...new Set(
          input.hostelCodes.map((code) =>
            String(code).trim().toUpperCase()
          )
        ),
      ]
    : [];
  const primaryHostelCode = input.primaryHostelCode
    ? String(input.primaryHostelCode).trim().toUpperCase()
    : hostelCodes[0];

  if (name.length < 2 || name.length > 255) {
    fail(400, "INVALID_NAME", "Name must contain between 2 and 255 characters");
  }

  if (!EMAIL_PATTERN.test(email) || email.length > 255) {
    fail(400, "INVALID_EMAIL", "A valid email address is required");
  }

  if (!invitableRoles.has(role)) {
    fail(
      400,
      "INVALID_STAFF_ROLE",
      "Role must be warden, maintenance, or guard"
    );
  }

  if (
    hostelCodes.length === 0 ||
    hostelCodes.some((code) => !HOSTEL_CODE_PATTERN.test(code))
  ) {
    fail(400, "INVALID_HOSTELS", "At least one valid hostel code is required");
  }

  if (!hostelCodes.includes(primaryHostelCode)) {
    fail(
      400,
      "INVALID_PRIMARY_HOSTEL",
      "Primary hostel must be one of the assigned hostels"
    );
  }

  return Object.freeze({
    name,
    email,
    role,
    hostelCodes: Object.freeze(hostelCodes),
    primaryHostelCode,
  });
};

export const validateManagedAccountStatus = (status) => {
  if (!managedStatuses.has(status)) {
    fail(
      400,
      "INVALID_ACCOUNT_STATUS",
      "Account status must be active or suspended"
    );
  }

  return status;
};

export const issueStaffInvitation = async (
  database,
  input,
  actorId,
  { now = new Date(), token = createInvitationToken() } = {}
) => {
  const invitedByUserId = requirePositiveInteger(actorId, "Actor ID");
  const values = normalizeStaffInvitationInput(input);
  const tokenHash = hashInvitationToken(token);
  const expiresAt = new Date(now.getTime() + STAFF_INVITATION_TTL_MS);

  return database.transaction(async (transaction) => {
    const [existingUser] = await transaction
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, values.email))
      .limit(1);

    if (existingUser) {
      fail(409, "ACCOUNT_ALREADY_EXISTS", "An account already uses this email");
    }

    const assignedHostels = await transaction
      .select({ id: hostels.id, code: hostels.code, name: hostels.name })
      .from(hostels)
      .where(
        and(
          eq(hostels.isActive, true),
          inArray(hostels.code, values.hostelCodes)
        )
      );
    const hostelsByCode = new Map(
      assignedHostels.map((hostel) => [hostel.code, hostel])
    );
    const missingCodes = values.hostelCodes.filter(
      (code) => !hostelsByCode.has(code)
    );

    if (missingCodes.length > 0) {
      fail(
        400,
        "HOSTELS_NOT_FOUND",
        `Active hostels not found: ${missingCodes.join(", ")}`
      );
    }

    await transaction
      .update(staffInvitations)
      .set({ revokedAt: now, updatedAt: now })
      .where(
        and(
          eq(staffInvitations.email, values.email),
          isNull(staffInvitations.acceptedAt),
          isNull(staffInvitations.revokedAt)
        )
      );

    const [invitation] = await transaction
      .insert(staffInvitations)
      .values({
        name: values.name,
        email: values.email,
        role: values.role,
        tokenHash,
        invitedByUserId,
        expiresAt,
        createdAt: now,
        updatedAt: now,
      })
      .returning({
        id: staffInvitations.id,
        name: staffInvitations.name,
        email: staffInvitations.email,
        role: staffInvitations.role,
        expiresAt: staffInvitations.expiresAt,
        createdAt: staffInvitations.createdAt,
      });

    await transaction.insert(staffInvitationHostels).values(
      values.hostelCodes.map((code) => ({
        invitationId: invitation.id,
        hostelId: hostelsByCode.get(code).id,
        isPrimary: code === values.primaryHostelCode,
        createdAt: now,
      }))
    );

    return Object.freeze({
      invitation: Object.freeze({
        ...invitation,
        hostels: Object.freeze(
          values.hostelCodes.map((code) => ({
            ...hostelsByCode.get(code),
            isPrimary: code === values.primaryHostelCode,
          }))
        ),
      }),
      acceptanceToken: token,
    });
  });
};

export const acceptStaffInvitation = async (
  database,
  input = {},
  { now = new Date() } = {}
) => {
  const tokenHash = hashInvitationToken(input.token);
  const password = validateStaffPassword(input.password);
  const passwordHash = await bcrypt.hash(password, 12);

  return database.transaction(async (transaction) => {
    const [invitation] = await transaction
      .select()
      .from(staffInvitations)
      .where(eq(staffInvitations.tokenHash, tokenHash))
      .for("update")
      .limit(1);

    if (
      !invitation ||
      invitation.acceptedAt ||
      invitation.revokedAt ||
      invitation.expiresAt <= now ||
      !invitableRoles.has(invitation.role)
    ) {
      fail(
        400,
        "INVITATION_UNAVAILABLE",
        "Invitation is invalid, expired, revoked, or already used"
      );
    }

    const [existingUser] = await transaction
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, invitation.email))
      .limit(1);

    if (existingUser) {
      fail(409, "ACCOUNT_ALREADY_EXISTS", "An account already uses this email");
    }

    const assignedHostels = await transaction
      .select({
        id: hostels.id,
        code: hostels.code,
        name: hostels.name,
        isPrimary: staffInvitationHostels.isPrimary,
        isActive: hostels.isActive,
      })
      .from(staffInvitationHostels)
      .innerJoin(hostels, eq(staffInvitationHostels.hostelId, hostels.id))
      .where(eq(staffInvitationHostels.invitationId, invitation.id));

    if (
      assignedHostels.length === 0 ||
      assignedHostels.some((hostel) => !hostel.isActive) ||
      assignedHostels.filter((hostel) => hostel.isPrimary).length !== 1
    ) {
      fail(
        409,
        "INVALID_INVITATION_ASSIGNMENTS",
        "Invitation hostel assignments are incomplete"
      );
    }

    const [user] = await transaction
      .insert(users)
      .values({
        name: invitation.name,
        email: invitation.email,
        password: passwordHash,
        role: invitation.role,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
        emailVerifiedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        accountStatus: users.accountStatus,
        emailVerifiedAt: users.emailVerifiedAt,
      });

    await transaction.insert(hostelMemberships).values(
      assignedHostels.map((hostel) => ({
        userId: user.id,
        hostelId: hostel.id,
        isPrimary: hostel.isPrimary,
        createdAt: now,
      }))
    );

    await transaction
      .update(staffInvitations)
      .set({ acceptedAt: now, updatedAt: now })
      .where(eq(staffInvitations.id, invitation.id));

    return Object.freeze({
      user: Object.freeze({
        ...user,
        hostels: Object.freeze(assignedHostels),
      }),
    });
  });
};

export const setManagedAccountStatus = async (
  database,
  { actorId, targetUserId, status },
  { now = new Date() } = {}
) => {
  const parsedActorId = requirePositiveInteger(actorId, "Actor ID");
  const parsedTargetUserId = requirePositiveInteger(targetUserId, "User ID");
  const validatedStatus = validateManagedAccountStatus(status);

  if (parsedActorId === parsedTargetUserId) {
    fail(400, "SELF_STATUS_CHANGE_FORBIDDEN", "Administrators cannot change their own status");
  }

  return database.transaction(async (transaction) => {
    const [targetUser] = await transaction
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, parsedTargetUserId))
      .for("update")
      .limit(1);

    if (!targetUser) {
      fail(404, "ACCOUNT_NOT_FOUND", "Account not found");
    }

    if (targetUser.role === USER_ROLES.ADMIN) {
      fail(
        403,
        "ADMIN_STATUS_CHANGE_FORBIDDEN",
        "Administrator accounts cannot be managed here"
      );
    }

    const [updatedUser] = await transaction
      .update(users)
      .set({ accountStatus: validatedStatus, updatedAt: now })
      .where(eq(users.id, parsedTargetUserId))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        accountStatus: users.accountStatus,
        updatedAt: users.updatedAt,
      });

    return Object.freeze({ user: Object.freeze(updatedUser) });
  });
};
