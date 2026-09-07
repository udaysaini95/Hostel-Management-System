import { and, asc, count, eq, exists, isNull, sql } from "drizzle-orm";
import {
  complaintAssignments,
  complaintEvents,
  complaints,
  hostelMemberships,
  hostels,
  users,
} from "../db/schema.js";
import { ACCOUNT_STATUSES } from "../domain/accountStatuses.js";
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
import {
  getComplaintById,
  loadComplaintActor,
} from "./complaintService.js";

const assignmentManagerRoles = new Set([
  USER_ROLES.WARDEN,
  USER_ROLES.ADMIN,
]);

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

const normalizeHostelCode = (value) =>
  typeof value === "string" ? value.trim().toUpperCase() : "";

export const normalizeComplaintAssignmentInput = (input = {}) => {
  const assigneeUserId = requirePositiveInteger(
    input.assigneeUserId,
    "Assignee user ID"
  );
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";

  if (reason && reason.length < 5) {
    fail(
      400,
      "INVALID_ASSIGNMENT_REASON",
      "Assignment reason must contain between 5 and 500 characters"
    );
  }

  if (reason.length > 500) {
    fail(
      400,
      "INVALID_ASSIGNMENT_REASON",
      "Assignment reason must contain between 5 and 500 characters"
    );
  }

  return Object.freeze({
    assigneeUserId,
    reason: reason || null,
  });
};

export const normalizeAssigneeFilters = (input = {}) => {
  const hostelCode = normalizeHostelCode(input.hostelCode);

  if (!/^[A-Z][A-Z0-9-]{0,19}$/.test(hostelCode)) {
    fail(400, "INVALID_HOSTEL", "Hostel code is invalid");
  }

  return Object.freeze({ hostelCode });
};

const assertManagerRole = (actor) => {
  if (!assignmentManagerRoles.has(actor.role)) {
    fail(
      403,
      "COMPLAINT_ASSIGNMENT_DENIED",
      "You cannot assign maintenance complaints"
    );
  }
};

const lockComplaint = (database, complaintId) =>
  database.execute(
    sql`select pg_advisory_xact_lock(71001, ${complaintId})`
  );

const loadManagedComplaint = async (database, actor, complaintId) => {
  const conditions = [eq(complaints.id, complaintId)];

  if (actor.role === USER_ROLES.WARDEN) {
    const assignedHostel = database
      .select({ id: hostelMemberships.id })
      .from(hostelMemberships)
      .where(
        and(
          eq(hostelMemberships.userId, actor.id),
          eq(hostelMemberships.hostelId, complaints.hostelId)
        )
      );
    conditions.push(exists(assignedHostel));
  }

  const [complaint] = await database
    .select({
      id: complaints.id,
      hostelId: complaints.hostelId,
      hostelCode: hostels.code,
      status: complaints.status,
      createdAt: complaints.createdAt,
    })
    .from(complaints)
    .innerJoin(hostels, eq(complaints.hostelId, hostels.id))
    .where(and(...conditions))
    .limit(1);

  if (!complaint) {
    // A hostel-scoped manager should not learn that another hostel owns the ID.
    fail(404, "COMPLAINT_NOT_FOUND", "Complaint not found");
  }

  return complaint;
};

const loadAvailableAssignee = async (database, userId, hostelId) => {
  const [assignee] = await database
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
    })
    .from(users)
    .innerJoin(
      hostelMemberships,
      and(
        eq(hostelMemberships.userId, users.id),
        eq(hostelMemberships.hostelId, hostelId)
      )
    )
    .where(
      and(
        eq(users.id, userId),
        eq(users.role, USER_ROLES.MAINTENANCE),
        eq(users.accountStatus, ACCOUNT_STATUSES.ACTIVE)
      )
    )
    .limit(1);

  if (!assignee) {
    fail(
      422,
      "ASSIGNEE_NOT_AVAILABLE",
      "Choose an active maintenance staff member assigned to this hostel"
    );
  }

  return assignee;
};

const loadActiveAssignment = async (database, complaintId) => {
  const [assignment] = await database
    .select({
      id: complaintAssignments.id,
      assigneeUserId: complaintAssignments.assigneeUserId,
      assigneeName: users.name,
      assignedAt: complaintAssignments.assignedAt,
    })
    .from(complaintAssignments)
    .innerJoin(users, eq(complaintAssignments.assigneeUserId, users.id))
    .where(
      and(
        eq(complaintAssignments.complaintId, complaintId),
        isNull(complaintAssignments.endedAt)
      )
    )
    .limit(1);

  return assignment ?? null;
};

const getAssignmentKind = (complaint, activeAssignment, values, now) => {
  if (!activeAssignment) {
    if (complaint.status !== COMPLAINT_STATUSES.CREATED) {
      fail(
        409,
        "COMPLAINT_ASSIGNMENT_STATE_INVALID",
        "This complaint is missing the active assignment required by its state"
      );
    }

    assertComplaintTransition(
      COMPLAINT_STATUSES.CREATED,
      COMPLAINT_STATUSES.ASSIGNED
    );
    return "initial";
  }

  if (
    ![
      COMPLAINT_STATUSES.ASSIGNED,
      COMPLAINT_STATUSES.IN_PROGRESS,
    ].includes(complaint.status)
  ) {
    fail(
      409,
      "COMPLAINT_REASSIGNMENT_CLOSED",
      "This complaint cannot be reassigned in its current state"
    );
  }

  if (activeAssignment.assigneeUserId === values.assigneeUserId) {
    fail(
      409,
      "ASSIGNEE_ALREADY_ACTIVE",
      "This maintenance staff member is already assigned"
    );
  }

  if (!values.reason) {
    fail(
      422,
      "REASSIGNMENT_REASON_REQUIRED",
      "A reason is required when changing the assignee"
    );
  }

  if (now <= new Date(activeAssignment.assignedAt)) {
    fail(
      409,
      "INVALID_REASSIGNMENT_TIME",
      "Reassignment time must be after the original assignment"
    );
  }

  return "reassignment";
};

export const assignComplaint = async (
  database,
  requestActor,
  complaintId,
  input,
  { now = new Date() } = {}
) => {
  const id = requirePositiveInteger(complaintId, "Complaint ID");
  const values = normalizeComplaintAssignmentInput(input);
  const assignedAt = requireOperationTime(now);
  const actor = await loadComplaintActor(database, requestActor);
  assertManagerRole(actor);

  const result = await database.transaction(async (transaction) => {
    await lockComplaint(transaction, id);
    const complaint = await loadManagedComplaint(transaction, actor, id);

    if (assignedAt < new Date(complaint.createdAt)) {
      fail(
        409,
        "INVALID_ASSIGNMENT_TIME",
        "Assignment time cannot be before complaint creation"
      );
    }

    const assignee = await loadAvailableAssignee(
      transaction,
      values.assigneeUserId,
      complaint.hostelId
    );
    const activeAssignment = await loadActiveAssignment(transaction, id);
    const kind = getAssignmentKind(
      complaint,
      activeAssignment,
      values,
      assignedAt
    );
    const nextStatus = kind === "initial"
      ? COMPLAINT_STATUSES.ASSIGNED
      : complaint.status;

    if (activeAssignment) {
      await transaction
        .update(complaintAssignments)
        .set({
          endedAt: assignedAt,
          endedByUserId: actor.id,
          endReason: values.reason,
        })
        .where(eq(complaintAssignments.id, activeAssignment.id));
    }

    const [assignment] = await transaction
      .insert(complaintAssignments)
      .values({
        complaintId: complaint.id,
        assigneeUserId: assignee.id,
        assignedByUserId: actor.id,
        assignedAt,
      })
      .returning({
        id: complaintAssignments.id,
        assignedAt: complaintAssignments.assignedAt,
      });

    await transaction
      .update(complaints)
      .set({ status: nextStatus, updatedAt: assignedAt })
      .where(eq(complaints.id, complaint.id));

    const eventType = kind === "initial"
      ? COMPLAINT_EVENT_TYPES.ASSIGNED
      : COMPLAINT_EVENT_TYPES.REASSIGNED;
    const action = kind === "initial"
      ? AUDIT_ACTIONS.COMPLAINT_ASSIGNED
      : AUDIT_ACTIONS.COMPLAINT_REASSIGNED;

    await transaction.insert(complaintEvents).values({
      complaintId: complaint.id,
      eventType,
      fromStatus: complaint.status,
      toStatus: nextStatus,
      actorUserId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      note: values.reason ?? `Assigned to ${assignee.name}`,
      metadata: {
        assignmentId: assignment.id,
        assigneeUserId: assignee.id,
        assigneeName: assignee.name,
        previousAssigneeUserId: activeAssignment?.assigneeUserId ?? null,
      },
      occurredAt: assignedAt,
    });

    await appendAuditEvent(transaction, {
      actor,
      category: AUDIT_CATEGORIES.COMPLAINT,
      action,
      resourceType: AUDIT_RESOURCE_TYPES.COMPLAINT_ASSIGNMENT,
      resourceId: assignment.id,
      description:
        kind === "initial"
          ? "Assigned a maintenance complaint"
          : "Reassigned a maintenance complaint",
      metadata: {
        complaintId: complaint.id,
        assigneeUserId: assignee.id,
        previousAssigneeUserId: activeAssignment?.assigneeUserId ?? null,
        reason: values.reason,
      },
      assignedHostels: [
        { id: complaint.hostelId, code: complaint.hostelCode },
      ],
      createdAt: assignedAt,
    });

    return {
      id: assignment.id,
      kind,
      assignee,
      assignedAt: assignment.assignedAt,
      previousAssignee: activeAssignment
        ? {
            id: activeAssignment.assigneeUserId,
            name: activeAssignment.assigneeName,
          }
        : null,
    };
  });

  const complaint = await getComplaintById(database, requestActor, id, {
    now: assignedAt,
  });

  return { assignment: result, complaint };
};

export const listMaintenanceAssignees = async (
  database,
  requestActor,
  input
) => {
  const filters = normalizeAssigneeFilters(input);
  const actor = await loadComplaintActor(database, requestActor);
  assertManagerRole(actor);

  const hostelConditions = [
    eq(hostels.code, filters.hostelCode),
    eq(hostels.isActive, true),
  ];

  if (actor.role === USER_ROLES.WARDEN) {
    const assignedHostel = database
      .select({ id: hostelMemberships.id })
      .from(hostelMemberships)
      .where(
        and(
          eq(hostelMemberships.userId, actor.id),
          eq(hostelMemberships.hostelId, hostels.id)
        )
      );
    hostelConditions.push(exists(assignedHostel));
  }

  const [hostel] = await database
    .select({ id: hostels.id, code: hostels.code, name: hostels.name })
    .from(hostels)
    .where(and(...hostelConditions))
    .limit(1);

  if (!hostel) {
    fail(404, "HOSTEL_NOT_FOUND", "Hostel not found");
  }

  const records = await database
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      activeAssignmentCount: count(complaintAssignments.id),
    })
    .from(users)
    .innerJoin(
      hostelMemberships,
      and(
        eq(hostelMemberships.userId, users.id),
        eq(hostelMemberships.hostelId, hostel.id)
      )
    )
    .leftJoin(
      complaintAssignments,
      and(
        eq(complaintAssignments.assigneeUserId, users.id),
        isNull(complaintAssignments.endedAt)
      )
    )
    .where(
      and(
        eq(users.role, USER_ROLES.MAINTENANCE),
        eq(users.accountStatus, ACCOUNT_STATUSES.ACTIVE)
      )
    )
    .groupBy(users.id, users.name, users.email)
    .orderBy(asc(users.name), asc(users.id));

  return {
    hostel,
    data: records.map((record) => ({
      ...record,
      activeAssignmentCount: Number(record.activeAssignmentCount),
    })),
  };
};
