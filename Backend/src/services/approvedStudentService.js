import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  ilike,
  isNotNull,
  isNull,
  lte,
  or,
} from "drizzle-orm";
import {
  approvedStudents,
  hostels,
  studentActivationTokens,
  users,
} from "../db/schema.js";
import {
  AUDIT_ACTIONS,
  AUDIT_CATEGORIES,
  AUDIT_RESOURCE_TYPES,
} from "../domain/auditEvents.js";
import {
  APPROVED_STUDENT_STATUSES,
  isApprovedStudentStatus,
} from "../domain/approvedStudentStatuses.js";
import { ApiError } from "../utils/apiErrors.js";
import {
  appendAuditEvent,
  loadAuditActor,
} from "./auditEventService.js";
import {
  createSecureToken,
  hashSecureToken,
} from "./secureTokenService.js";
import { STUDENT_ACTIVATION_TTL_MS } from "./studentActivationService.js";

const HOSTEL_CODE_PATTERN = /^[A-Z][A-Z0-9-]{0,19}$/;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

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

const requireNow = (value) => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    fail(400, "INVALID_REQUEST", "The operation timestamp is invalid");
  }

  return value;
};

export const normalizeApprovedStudentFilters = (filters = {}) => {
  const page = Number(filters.page ?? 1);
  const pageSize = Number(filters.pageSize ?? 20);
  const search =
    typeof filters.search === "string" ? filters.search.trim() : "";
  const hostelCode =
    typeof filters.hostelCode === "string"
      ? filters.hostelCode.trim().toUpperCase()
      : "";
  const status =
    typeof filters.status === "string" ? filters.status.trim() : "";

  if (!Number.isSafeInteger(page) || page < 1) {
    fail(400, "INVALID_PAGE", "Page must be a positive integer");
  }

  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    fail(400, "INVALID_PAGE_SIZE", "Page size must be between 1 and 100");
  }

  if (search.length > 100) {
    fail(400, "INVALID_SEARCH", "Search must contain at most 100 characters");
  }

  if (hostelCode && !HOSTEL_CODE_PATTERN.test(hostelCode)) {
    fail(400, "INVALID_HOSTEL", "A valid hostel code is required");
  }

  if (status && !isApprovedStudentStatus(status)) {
    fail(400, "INVALID_APPROVAL_STATUS", "Approval status is invalid");
  }

  return Object.freeze({
    page,
    pageSize,
    search: search || null,
    hostelCode: hostelCode || null,
    status: status || null,
  });
};

const normalizeApprovalLifecycleReason = (
  input,
  { code, label }
) => {
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";

  if (reason.length < 5 || reason.length > 500) {
    fail(
      400,
      code,
      `${label} reason must contain between 5 and 500 characters`
    );
  }

  return Object.freeze({ reason });
};

export const normalizeApprovalRevocationInput = (input = {}) =>
  normalizeApprovalLifecycleReason(input, {
    code: "INVALID_REVOCATION_REASON",
    label: "Revocation",
  });

export const normalizeApprovalReinstatementInput = (input = {}) =>
  normalizeApprovalLifecycleReason(input, {
    code: "INVALID_REINSTATEMENT_REASON",
    label: "Reinstatement",
  });

export const getApprovedStudentLifecycleStatus = (
  record,
  now = new Date()
) => {
  requireNow(now);

  if (record.revokedAt) {
    return APPROVED_STUDENT_STATUSES.REVOKED;
  }

  if (record.activatedAt || record.activatedUserId) {
    return APPROVED_STUDENT_STATUSES.ACTIVATED;
  }

  if (!record.activationExpiresAt) {
    return APPROVED_STUDENT_STATUSES.APPROVED;
  }

  const expiresAt = new Date(record.activationExpiresAt);
  return expiresAt <= now
    ? APPROVED_STUDENT_STATUSES.ACTIVATION_EXPIRED
    : APPROVED_STUDENT_STATUSES.ACTIVATION_PENDING;
};

const getStatusCondition = (status, now) => {
  if (!status) {
    return null;
  }

  const notRevoked = isNull(approvedStudents.revokedAt);
  const notActivated = and(
    isNull(approvedStudents.activatedAt),
    isNull(approvedStudents.activatedUserId)
  );

  switch (status) {
    case APPROVED_STUDENT_STATUSES.APPROVED:
      return and(notRevoked, notActivated, isNull(studentActivationTokens.id));
    case APPROVED_STUDENT_STATUSES.ACTIVATION_PENDING:
      return and(
        notRevoked,
        notActivated,
        isNotNull(studentActivationTokens.id),
        gt(studentActivationTokens.expiresAt, now)
      );
    case APPROVED_STUDENT_STATUSES.ACTIVATION_EXPIRED:
      return and(
        notRevoked,
        notActivated,
        isNotNull(studentActivationTokens.id),
        lte(studentActivationTokens.expiresAt, now)
      );
    case APPROVED_STUDENT_STATUSES.ACTIVATED:
      return and(
        notRevoked,
        or(
          isNotNull(approvedStudents.activatedAt),
          isNotNull(approvedStudents.activatedUserId)
        )
      );
    case APPROVED_STUDENT_STATUSES.REVOKED:
      return isNotNull(approvedStudents.revokedAt);
    default:
      return null;
  }
};

const getWhereClause = (filters, now) => {
  const conditions = [];

  if (filters.search) {
    const pattern = `%${filters.search}%`;
    conditions.push(
      or(
        ilike(approvedStudents.name, pattern),
        ilike(approvedStudents.email, pattern),
        ilike(approvedStudents.rollNo, pattern)
      )
    );
  }

  if (filters.hostelCode) {
    conditions.push(eq(hostels.code, filters.hostelCode));
  }

  const statusCondition = getStatusCondition(filters.status, now);
  if (statusCondition) {
    conditions.push(statusCondition);
  }

  return conditions.length ? and(...conditions) : undefined;
};

const activeTokenJoin = and(
  eq(studentActivationTokens.approvedStudentId, approvedStudents.id),
  isNull(studentActivationTokens.usedAt),
  isNull(studentActivationTokens.revokedAt)
);

const approvedStudentSelection = {
  id: approvedStudents.id,
  name: approvedStudents.name,
  email: approvedStudents.email,
  rollNo: approvedStudents.rollNo,
  approvedByUserId: approvedStudents.approvedByUserId,
  activatedUserId: approvedStudents.activatedUserId,
  approvedAt: approvedStudents.approvedAt,
  activatedAt: approvedStudents.activatedAt,
  revokedAt: approvedStudents.revokedAt,
  createdAt: approvedStudents.createdAt,
  updatedAt: approvedStudents.updatedAt,
  hostelId: hostels.id,
  hostelCode: hostels.code,
  hostelName: hostels.name,
  hostelIsActive: hostels.isActive,
};

const toApprovedStudentView = (record, now) => ({
  id: record.id,
  name: record.name,
  email: record.email,
  rollNo: record.rollNo,
  status: getApprovedStudentLifecycleStatus(record, now),
  hostel: {
    id: record.hostelId,
    code: record.hostelCode,
    name: record.hostelName,
    isActive: record.hostelIsActive,
  },
  approvedByUserId: record.approvedByUserId,
  activatedUserId: record.activatedUserId,
  approvedAt: record.approvedAt,
  activatedAt: record.activatedAt,
  revokedAt: record.revokedAt,
  activationExpiresAt: record.activationExpiresAt ?? null,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

export const listStudentApprovalHostels = async (database) => {
  const data = await database
    .select({
      id: hostels.id,
      code: hostels.code,
      name: hostels.name,
    })
    .from(hostels)
    .where(eq(hostels.isActive, true))
    .orderBy(asc(hostels.code));

  return { data };
};

export const searchApprovedStudents = async (
  database,
  input,
  { now = new Date() } = {}
) => {
  const filters = normalizeApprovedStudentFilters(input);
  requireNow(now);
  const whereClause = getWhereClause(filters, now);

  const countQuery = database
    .select({ total: count() })
    .from(approvedStudents)
    .innerJoin(hostels, eq(approvedStudents.hostelId, hostels.id))
    .leftJoin(studentActivationTokens, activeTokenJoin);
  const [countResult] = whereClause
    ? await countQuery.where(whereClause)
    : await countQuery;

  const listQuery = database
    .select({
      ...approvedStudentSelection,
      activationExpiresAt: studentActivationTokens.expiresAt,
    })
    .from(approvedStudents)
    .innerJoin(hostels, eq(approvedStudents.hostelId, hostels.id))
    .leftJoin(studentActivationTokens, activeTokenJoin);
  const filteredListQuery = whereClause
    ? listQuery.where(whereClause)
    : listQuery;
  const records = await filteredListQuery
    .orderBy(desc(approvedStudents.approvedAt), desc(approvedStudents.id))
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize);
  const total = Number(countResult?.total ?? 0);

  return {
    data: records.map((record) => toApprovedStudentView(record, now)),
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / filters.pageSize),
    },
  };
};

const loadApprovalForUpdate = async (transaction, approvalId) => {
  const [approval] = await transaction
    .select(approvedStudentSelection)
    .from(approvedStudents)
    .innerJoin(hostels, eq(approvedStudents.hostelId, hostels.id))
    .where(eq(approvedStudents.id, approvalId))
    .for("update")
    .limit(1);

  if (!approval) {
    fail(
      404,
      "APPROVED_STUDENT_NOT_FOUND",
      "The approved student record was not found"
    );
  }

  return approval;
};

const ensureApprovalCanBeActivated = (approval) => {
  if (approval.revokedAt) {
    fail(
      409,
      "STUDENT_APPROVAL_REVOKED",
      "A revoked student approval cannot receive an activation email"
    );
  }

  if (approval.activatedAt || approval.activatedUserId) {
    fail(
      409,
      "STUDENT_ALREADY_ACTIVATED",
      "This student has already activated an account"
    );
  }

  if (!approval.hostelIsActive) {
    fail(409, "HOSTEL_UNAVAILABLE", "The approved hostel is not active");
  }
};

export const revokeApprovedStudent = async (
  database,
  approvalId,
  input,
  actorId,
  { now = new Date() } = {}
) => {
  const id = requirePositiveInteger(approvalId, "Approved student ID");
  const approvedByUserId = requirePositiveInteger(actorId, "Actor ID");
  const { reason } = normalizeApprovalRevocationInput(input);
  requireNow(now);

  return database.transaction(async (transaction) => {
    const approval = await loadApprovalForUpdate(transaction, id);

    if (approval.revokedAt) {
      fail(
        409,
        "STUDENT_APPROVAL_ALREADY_REVOKED",
        "This student approval is already revoked"
      );
    }

    if (approval.activatedAt || approval.activatedUserId) {
      fail(
        409,
        "STUDENT_ALREADY_ACTIVATED",
        "Deactivate the student account instead of revoking its approval"
      );
    }

    const revokedTokens = await transaction
      .update(studentActivationTokens)
      .set({ revokedAt: now })
      .where(
        and(
          eq(studentActivationTokens.approvedStudentId, id),
          isNull(studentActivationTokens.usedAt),
          isNull(studentActivationTokens.revokedAt)
        )
      )
      .returning({
        id: studentActivationTokens.id,
        expiresAt: studentActivationTokens.expiresAt,
      });

    await transaction
      .update(approvedStudents)
      .set({ revokedAt: now, updatedAt: now })
      .where(eq(approvedStudents.id, id));

    const previousStatus = revokedTokens.length
      ? getApprovedStudentLifecycleStatus(
          { activationExpiresAt: revokedTokens[0].expiresAt },
          now
        )
      : APPROVED_STUDENT_STATUSES.APPROVED;
    const auditActor = await loadAuditActor(transaction, approvedByUserId);
    const hostel = {
      id: approval.hostelId,
      code: approval.hostelCode,
    };

    await appendAuditEvent(transaction, {
      actor: auditActor,
      category: AUDIT_CATEGORIES.STUDENT,
      action: AUDIT_ACTIONS.STUDENT_APPROVAL_REVOKED,
      resourceType: AUDIT_RESOURCE_TYPES.APPROVED_STUDENT,
      resourceId: approval.id,
      description: `Revoked ${approval.rollNo} from ${approval.hostelCode}`,
      metadata: {
        studentName: approval.name,
        studentEmail: approval.email,
        rollNo: approval.rollNo,
        hostelCode: approval.hostelCode,
        previousStatus,
        reason,
      },
      assignedHostels: [hostel],
      createdAt: now,
    });

    return {
      approval: toApprovedStudentView(
        { ...approval, revokedAt: now, updatedAt: now },
        now
      ),
    };
  });
};

export const reinstateApprovedStudent = async (
  database,
  approvalId,
  input,
  actorId,
  { now = new Date() } = {}
) => {
  const id = requirePositiveInteger(approvalId, "Approved student ID");
  const approvedByUserId = requirePositiveInteger(actorId, "Actor ID");
  const { reason } = normalizeApprovalReinstatementInput(input);
  requireNow(now);

  return database.transaction(async (transaction) => {
    const approval = await loadApprovalForUpdate(transaction, id);

    if (!approval.revokedAt) {
      fail(
        409,
        "STUDENT_APPROVAL_NOT_REVOKED",
        "Only a revoked student approval can be reinstated"
      );
    }

    if (approval.activatedAt || approval.activatedUserId) {
      fail(
        409,
        "STUDENT_ALREADY_ACTIVATED",
        "This student has already activated an account"
      );
    }

    if (!approval.hostelIsActive) {
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

    await transaction
      .update(approvedStudents)
      .set({ revokedAt: null, updatedAt: now })
      .where(eq(approvedStudents.id, id));

    const auditActor = await loadAuditActor(transaction, approvedByUserId);
    const hostel = {
      id: approval.hostelId,
      code: approval.hostelCode,
    };

    await appendAuditEvent(transaction, {
      actor: auditActor,
      category: AUDIT_CATEGORIES.STUDENT,
      action: AUDIT_ACTIONS.STUDENT_APPROVAL_REINSTATED,
      resourceType: AUDIT_RESOURCE_TYPES.APPROVED_STUDENT,
      resourceId: approval.id,
      description: `Reinstated ${approval.rollNo} for ${approval.hostelCode}`,
      metadata: {
        studentName: approval.name,
        studentEmail: approval.email,
        rollNo: approval.rollNo,
        hostelCode: approval.hostelCode,
        previousStatus: APPROVED_STUDENT_STATUSES.REVOKED,
        reason,
      },
      assignedHostels: [hostel],
      createdAt: now,
    });

    return {
      approval: toApprovedStudentView(
        {
          ...approval,
          revokedAt: null,
          activationExpiresAt: null,
          updatedAt: now,
        },
        now
      ),
    };
  });
};

export const reissueApprovedStudentActivation = async (
  database,
  approvalId,
  actorId,
  { now = new Date(), token = createSecureToken() } = {}
) => {
  const id = requirePositiveInteger(approvalId, "Approved student ID");
  const approvedByUserId = requirePositiveInteger(actorId, "Actor ID");
  requireNow(now);

  if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) {
    fail(400, "INVALID_REQUEST", "The activation token is invalid");
  }

  const expiresAt = new Date(now.getTime() + STUDENT_ACTIVATION_TTL_MS);

  return database.transaction(async (transaction) => {
    const approval = await loadApprovalForUpdate(transaction, id);
    ensureApprovalCanBeActivated(approval);

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

    const replacedTokens = await transaction
      .update(studentActivationTokens)
      .set({ revokedAt: now })
      .where(
        and(
          eq(studentActivationTokens.approvedStudentId, id),
          isNull(studentActivationTokens.usedAt),
          isNull(studentActivationTokens.revokedAt)
        )
      )
      .returning({ id: studentActivationTokens.id });

    const [tokenRecord] = await transaction
      .insert(studentActivationTokens)
      .values({
        approvedStudentId: id,
        tokenHash: hashSecureToken(token),
        expiresAt,
        createdAt: now,
      })
      .returning({ id: studentActivationTokens.id });

    await transaction
      .update(approvedStudents)
      .set({ updatedAt: now })
      .where(eq(approvedStudents.id, id));

    const auditActor = await loadAuditActor(transaction, approvedByUserId);
    const hostel = {
      id: approval.hostelId,
      code: approval.hostelCode,
    };

    await appendAuditEvent(transaction, {
      actor: auditActor,
      category: AUDIT_CATEGORIES.STUDENT,
      action: AUDIT_ACTIONS.STUDENT_ACTIVATION_REISSUED,
      resourceType: AUDIT_RESOURCE_TYPES.APPROVED_STUDENT,
      resourceId: approval.id,
      description: `Created an activation link for ${approval.rollNo}`,
      metadata: {
        studentName: approval.name,
        studentEmail: approval.email,
        rollNo: approval.rollNo,
        hostelCode: approval.hostelCode,
        replacedPreviousLink: replacedTokens.length > 0,
        expiresAt: expiresAt.toISOString(),
      },
      assignedHostels: [hostel],
      createdAt: now,
    });

    return {
      approval: toApprovedStudentView(
        { ...approval, activationExpiresAt: expiresAt, updatedAt: now },
        now
      ),
      delivery: {
        tokenId: tokenRecord.id,
        token,
        name: approval.name,
        email: approval.email,
        expiresAt,
      },
    };
  });
};
