import { createHash, randomUUID } from "node:crypto";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import {
  hostelMemberships,
  hostels,
  messIssueAttachments,
  messIssueEvents,
  messIssues,
  studentProfiles,
  users,
} from "../db/schema.js";
import { ACCOUNT_STATUSES } from "../domain/accountStatuses.js";
import {
  AUDIT_ACTIONS,
  AUDIT_CATEGORIES,
  AUDIT_RESOURCE_TYPES,
} from "../domain/auditEvents.js";
import { MEAL_TYPE_ORDER } from "../domain/mess.js";
import { inspectMessIssueEvidence } from "../domain/messIssueEvidence.js";
import {
  canTransitionMessIssue,
  MESS_ISSUE_STATUSES,
  MESS_ISSUE_TYPES,
} from "../domain/messIssues.js";
import { USER_ROLES } from "../domain/roles.js";
import { ApiError } from "../utils/apiErrors.js";
import { appendAuditEvent } from "./auditEventService.js";
import { privateFileStorage } from "./privateFileStorage.js";

const fail = (status, code, message) => {
  throw new ApiError(status, code, message);
};

const positiveInteger = (value, label) => {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) {
    fail(400, "INVALID_REQUEST", `${label} must be a positive integer`);
  }
  return number;
};

const validDate = (value) => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    fail(400, "INVALID_REQUEST", "Operation timestamp is invalid");
  }
  return value;
};

export const normalizeMessIssueInput = (input = {}) => {
  const issueType = input.issueType;
  const mealType = input.mealType;
  const description = typeof input.description === "string"
    ? input.description.trim().replace(/\s+/g, " ")
    : "";

  if (!Object.values(MESS_ISSUE_TYPES).includes(issueType)) {
    fail(400, "INVALID_MESS_ISSUE_TYPE", "Select a valid issue type");
  }
  if (!MEAL_TYPE_ORDER.includes(mealType)) {
    fail(400, "INVALID_MEAL_TYPE", "Select a valid meal");
  }
  if (description.length < 10 || description.length > 2000) {
    fail(400, "INVALID_DESCRIPTION", "Description must contain 10 to 2000 characters");
  }

  return Object.freeze({ issueType, mealType, description });
};

const normalizeListInput = (input = {}) => ({
  page: positiveInteger(input.page || 1, "Page"),
  pageSize: Math.min(50, positiveInteger(input.pageSize || 10, "Page size")),
  status: input.status,
  issueType: input.issueType,
  mealType: input.mealType,
  hostelId: input.hostelId ? positiveInteger(input.hostelId, "Hostel ID") : undefined,
});

const loadActor = async (database, requestActor) => {
  const actorId = positiveInteger(requestActor?.id, "Actor ID");
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

  if (!actor || actor.accountStatus !== ACCOUNT_STATUSES.ACTIVE) {
    fail(403, "ACCOUNT_INACTIVE", "An active account is required");
  }
  return actor;
};

const issueSelection = {
  id: messIssues.id,
  hostelId: messIssues.hostelId,
  hostelCode: hostels.code,
  hostelName: hostels.name,
  reportedByUserId: messIssues.reportedByUserId,
  studentName: users.name,
  studentEmail: users.email,
  issueType: messIssues.issueType,
  mealType: messIssues.mealType,
  description: messIssues.description,
  status: messIssues.status,
  resolvedAt: messIssues.resolvedAt,
  createdAt: messIssues.createdAt,
  updatedAt: messIssues.updatedAt,
  evidenceId: messIssueAttachments.id,
  evidenceName: messIssueAttachments.originalName,
  evidenceMimeType: messIssueAttachments.mimeType,
  evidenceSizeBytes: messIssueAttachments.sizeBytes,
};

const formatIssue = (issue) => Object.freeze({
  id: issue.id,
  hostel: Object.freeze({
    id: issue.hostelId,
    code: issue.hostelCode,
    name: issue.hostelName,
  }),
  student: Object.freeze({
    id: issue.reportedByUserId,
    name: issue.studentName,
    email: issue.studentEmail,
  }),
  issueType: issue.issueType,
  mealType: issue.mealType,
  description: issue.description,
  status: issue.status,
  resolvedAt: issue.resolvedAt,
  createdAt: issue.createdAt,
  updatedAt: issue.updatedAt,
  evidence: issue.evidenceId
    ? Object.freeze({
        id: issue.evidenceId,
        originalName: issue.evidenceName,
        mimeType: issue.evidenceMimeType,
        sizeBytes: issue.evidenceSizeBytes,
        downloadUrl: `/api/mess/issues/${issue.id}/evidence`,
      })
    : null,
});

const baseIssueQuery = (database) => database
  .select(issueSelection)
  .from(messIssues)
  .innerJoin(hostels, eq(messIssues.hostelId, hostels.id))
  .innerJoin(users, eq(messIssues.reportedByUserId, users.id))
  .leftJoin(
    messIssueAttachments,
    eq(messIssueAttachments.messIssueId, messIssues.id)
  );

const loadIssue = async (database, issueId) => {
  const [issue] = await baseIssueQuery(database)
    .where(eq(messIssues.id, issueId))
    .limit(1);
  if (!issue) fail(404, "MESS_ISSUE_NOT_FOUND", "Mess issue not found");
  return issue;
};

const getManagedHostelIds = async (database, actor) => {
  if (![USER_ROLES.WARDEN, USER_ROLES.ADMIN].includes(actor.role)) {
    fail(403, "MESS_ISSUE_MANAGE_DENIED", "Only wardens and administrators can manage mess issues");
  }
  if (actor.role === USER_ROLES.ADMIN) return null;

  const memberships = await database
    .select({ hostelId: hostelMemberships.hostelId })
    .from(hostelMemberships)
    .where(eq(hostelMemberships.userId, actor.id));
  return memberships.map((membership) => membership.hostelId);
};

const assertManagedIssue = async (database, actor, issue) => {
  const hostelIds = await getManagedHostelIds(database, actor);
  if (hostelIds && !hostelIds.includes(issue.hostelId)) {
    fail(403, "HOSTEL_ACCESS_DENIED", "This mess issue is outside your hostel assignment");
  }
};

const checksum = (contents) => createHash("sha256").update(contents).digest("hex");

export const createMessIssue = async (
  database,
  requestActor,
  input,
  file,
  { storage = privateFileStorage, now = new Date(), createId = randomUUID } = {}
) => {
  const values = normalizeMessIssueInput(input);
  const createdAt = validDate(now);
  const actor = await loadActor(database, requestActor);
  if (actor.role !== USER_ROLES.STUDENT) {
    fail(403, "STUDENT_ISSUE_REQUIRED", "Only students can report mess issues");
  }

  const [profile] = await database
    .select({ hostelId: studentProfiles.hostelId })
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, actor.id))
    .limit(1);
  if (!profile) fail(409, "STUDENT_PROFILE_REQUIRED", "A student hostel profile is required");

  const evidence = file ? inspectMessIssueEvidence(file) : null;
  const storageKey = evidence
    ? `mess-issues/${createId()}.${evidence.extension}`
    : null;
  if (evidence) {
    try {
      await storage.write(storageKey, evidence.buffer);
    } catch {
      fail(503, "EVIDENCE_STORAGE_UNAVAILABLE", "The evidence could not be stored. Please try again");
    }
  }

  try {
    const issue = await database.transaction(async (transaction) => {
      const [created] = await transaction
        .insert(messIssues)
        .values({
          hostelId: profile.hostelId,
          reportedByUserId: actor.id,
          ...values,
          status: MESS_ISSUE_STATUSES.REPORTED,
          createdAt,
          updatedAt: createdAt,
        })
        .returning({ id: messIssues.id });

      await transaction.insert(messIssueEvents).values({
        messIssueId: created.id,
        actorUserId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        fromStatus: null,
        toStatus: MESS_ISSUE_STATUSES.REPORTED,
        occurredAt: createdAt,
      });

      if (evidence) {
        await transaction.insert(messIssueAttachments).values({
          messIssueId: created.id,
          uploadedByUserId: actor.id,
          storageKey,
          originalName: evidence.originalName,
          mimeType: evidence.mimeType,
          sizeBytes: evidence.sizeBytes,
          sha256: checksum(evidence.buffer),
          createdAt,
        });
      }

      const [hostel] = await transaction
        .select({ id: hostels.id, code: hostels.code })
        .from(hostels)
        .where(eq(hostels.id, profile.hostelId));
      await appendAuditEvent(transaction, {
        actor,
        category: AUDIT_CATEGORIES.MESS,
        action: AUDIT_ACTIONS.MESS_ISSUE_REPORTED,
        resourceType: AUDIT_RESOURCE_TYPES.MESS_ISSUE,
        resourceId: created.id,
        description: `Reported a ${values.issueType} mess issue`,
        metadata: {
          mealType: values.mealType,
          hasEvidence: Boolean(evidence),
        },
        assignedHostels: [hostel],
        createdAt,
      });

      return loadIssue(transaction, created.id);
    });
    return formatIssue(issue);
  } catch (error) {
    if (storageKey) {
      try {
        await storage.remove(storageKey);
      } catch (cleanupError) {
        console.error("Mess issue evidence cleanup failed:", cleanupError);
      }
    }
    throw error;
  }
};

const paginate = (records, total, page, pageSize) => ({
  data: records.map(formatIssue),
  pagination: Object.freeze({
    page,
    pageSize,
    total: Number(total),
    totalPages: Math.ceil(Number(total) / pageSize),
  }),
});

export const listOwnMessIssues = async (database, requestActor, input = {}) => {
  const actor = await loadActor(database, requestActor);
  if (actor.role !== USER_ROLES.STUDENT) {
    fail(403, "STUDENT_ISSUE_REQUIRED", "Only students have personal mess issue history");
  }
  const filters = normalizeListInput(input);
  const conditions = [eq(messIssues.reportedByUserId, actor.id)];
  if (filters.status) conditions.push(eq(messIssues.status, filters.status));

  const where = and(...conditions);
  const [totalRow] = await database.select({ total: count() }).from(messIssues).where(where);
  const records = await baseIssueQuery(database)
    .where(where)
    .orderBy(desc(messIssues.createdAt), desc(messIssues.id))
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize);
  return paginate(records, totalRow.total, filters.page, filters.pageSize);
};

export const listManagedMessIssues = async (database, requestActor, input = {}) => {
  const actor = await loadActor(database, requestActor);
  const managedHostelIds = await getManagedHostelIds(database, actor);
  const filters = normalizeListInput(input);
  if (managedHostelIds && managedHostelIds.length === 0) {
    return paginate([], 0, filters.page, filters.pageSize);
  }
  if (managedHostelIds && filters.hostelId && !managedHostelIds.includes(filters.hostelId)) {
    fail(403, "HOSTEL_ACCESS_DENIED", "This hostel is outside your assignment");
  }

  const conditions = [];
  if (filters.hostelId) conditions.push(eq(messIssues.hostelId, filters.hostelId));
  else if (managedHostelIds) conditions.push(inArray(messIssues.hostelId, managedHostelIds));
  if (filters.status) conditions.push(eq(messIssues.status, filters.status));
  if (filters.issueType) conditions.push(eq(messIssues.issueType, filters.issueType));
  if (filters.mealType) conditions.push(eq(messIssues.mealType, filters.mealType));

  const where = conditions.length ? and(...conditions) : undefined;
  const [totalRow] = await database.select({ total: count() }).from(messIssues).where(where);
  const records = await baseIssueQuery(database)
    .where(where)
    .orderBy(desc(messIssues.createdAt), desc(messIssues.id))
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize);
  return paginate(records, totalRow.total, filters.page, filters.pageSize);
};

export const transitionMessIssue = async (
  database,
  requestActor,
  issueId,
  input,
  { now = new Date() } = {}
) => {
  const id = positiveInteger(issueId, "Mess issue ID");
  const changedAt = validDate(now);
  const note = typeof input.note === "string" ? input.note.trim() : "";
  if (note.length > 1000) fail(400, "NOTE_TOO_LONG", "Note cannot exceed 1000 characters");
  if (!Object.values(MESS_ISSUE_STATUSES).includes(input.status)) {
    fail(400, "INVALID_MESS_ISSUE_STATUS", "Select a valid mess issue status");
  }

  return database.transaction(async (transaction) => {
    const actor = await loadActor(transaction, requestActor);
    await transaction.execute(sql`select pg_advisory_xact_lock(72001, ${id})`);
    const current = await loadIssue(transaction, id);
    await assertManagedIssue(transaction, actor, current);
    if (!canTransitionMessIssue(current.status, input.status)) {
      fail(
        409,
        "INVALID_MESS_ISSUE_TRANSITION",
        `A ${current.status} issue cannot move to ${input.status}`
      );
    }

    await transaction
      .update(messIssues)
      .set({
        status: input.status,
        updatedAt: changedAt,
        resolvedAt: input.status === MESS_ISSUE_STATUSES.RESOLVED ? changedAt : null,
      })
      .where(and(eq(messIssues.id, id), eq(messIssues.status, current.status)));
    await transaction.insert(messIssueEvents).values({
      messIssueId: id,
      actorUserId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      fromStatus: current.status,
      toStatus: input.status,
      note: note || null,
      occurredAt: changedAt,
    });

    await appendAuditEvent(transaction, {
      actor,
      category: AUDIT_CATEGORIES.MESS,
      action: AUDIT_ACTIONS.MESS_ISSUE_STATUS_CHANGED,
      resourceType: AUDIT_RESOURCE_TYPES.MESS_ISSUE,
      resourceId: id,
      description: `Changed mess issue status to ${input.status}`,
      metadata: { fromStatus: current.status, toStatus: input.status },
      assignedHostels: [{ id: current.hostelId, code: current.hostelCode }],
      createdAt: changedAt,
    });

    return formatIssue(await loadIssue(transaction, id));
  });
};

export const readMessIssueEvidence = async (
  database,
  requestActor,
  issueId,
  { storage = privateFileStorage } = {}
) => {
  const id = positiveInteger(issueId, "Mess issue ID");
  const actor = await loadActor(database, requestActor);
  const issue = await loadIssue(database, id);
  if (actor.role === USER_ROLES.STUDENT) {
    if (issue.reportedByUserId !== actor.id) {
      fail(403, "MESS_ISSUE_ACCESS_DENIED", "You can only view evidence for your own mess issues");
    }
  } else {
    await assertManagedIssue(database, actor, issue);
  }
  if (!issue.evidenceId) fail(404, "MESS_ISSUE_EVIDENCE_NOT_FOUND", "This mess issue has no evidence");

  const [attachment] = await database
    .select()
    .from(messIssueAttachments)
    .where(eq(messIssueAttachments.id, issue.evidenceId))
    .limit(1);
  let contents;
  try {
    contents = await storage.read(attachment.storageKey);
  } catch {
    fail(503, "EVIDENCE_UNAVAILABLE", "The evidence is temporarily unavailable");
  }
  if (checksum(contents) !== attachment.sha256) {
    fail(503, "EVIDENCE_UNAVAILABLE", "The evidence is temporarily unavailable");
  }

  return { ...issue.evidence, contents };
};
