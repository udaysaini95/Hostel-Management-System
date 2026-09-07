import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gte,
  ilike,
  isNull,
  lte,
  lt,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  complaintAssignments,
  complaintCategories,
  complaintEvents,
  complaints,
  hostelBlocks,
  hostelMemberships,
  hostels,
  roomAllocations,
  rooms,
  studentProfiles,
  users,
} from "../db/schema.js";
import { ACCOUNT_STATUSES } from "../domain/accountStatuses.js";
import {
  AUDIT_ACTIONS,
  AUDIT_CATEGORIES,
  AUDIT_RESOURCE_TYPES,
} from "../domain/auditEvents.js";
import {
  COMPLAINT_EVENT_TYPES,
  COMPLAINT_PRIORITIES,
  COMPLAINT_SLA_MINUTES,
  COMPLAINT_STATUSES,
} from "../domain/complaintWorkflow.js";
import { USER_ROLES } from "../domain/roles.js";
import { ApiError } from "../utils/apiErrors.js";
import { appendAuditEvent } from "./auditEventService.js";

const complaintCreatorRoles = new Set([
  USER_ROLES.STUDENT,
  USER_ROLES.WARDEN,
  USER_ROLES.ADMIN,
]);
const complaintManagerRoles = new Set([
  USER_ROLES.WARDEN,
  USER_ROLES.ADMIN,
]);
const completedComplaintStatuses = new Set([
  COMPLAINT_STATUSES.RESOLVED,
  COMPLAINT_STATUSES.CLOSED,
]);
const knownStatuses = new Set(Object.values(COMPLAINT_STATUSES));
const knownPriorities = new Set(Object.values(COMPLAINT_PRIORITIES));
const knownSlaStates = new Set(["all", "open", "breached"]);
const knownSortFields = new Set(["createdAt", "slaDeadline", "priority"]);
const knownSortOrders = new Set(["asc", "desc"]);
const priorityRank = Object.freeze({
  [COMPLAINT_PRIORITIES.CRITICAL]: 1,
  [COMPLAINT_PRIORITIES.HIGH]: 2,
  [COMPLAINT_PRIORITIES.MEDIUM]: 3,
  [COMPLAINT_PRIORITIES.LOW]: 4,
});

const fail = (status, code, message) => {
  throw new ApiError(status, code, message);
};

const normalizeCode = (value, transform = (text) => text) =>
  typeof value === "string" ? transform(value.trim()) : "";

const requirePositiveInteger = (value, label = "ID") => {
  const number = Number(value);

  if (!Number.isSafeInteger(number) || number < 1) {
    fail(400, "INVALID_REQUEST", `${label} must be a positive integer`);
  }

  return number;
};

const requireActorId = (value) => {
  const actorId = Number(value);

  if (!Number.isSafeInteger(actorId) || actorId < 1) {
    fail(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  }

  return actorId;
};

const requireOperationTime = (value) => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    fail(400, "INVALID_REQUEST", "Operation timestamp is invalid");
  }

  return value;
};

// Priority and request normalization ---------------------------------------

export const determineComplaintPriority = (
  categoryPriority,
  requestedPriority = null
) => {
  if (!knownPriorities.has(categoryPriority)) {
    fail(500, "INVALID_COMPLAINT_POLICY", "Complaint priority policy is invalid");
  }

  if (requestedPriority !== null && !knownPriorities.has(requestedPriority)) {
    fail(400, "INVALID_COMPLAINT_PRIORITY", "Complaint priority is invalid");
  }

  if (
    requestedPriority &&
    priorityRank[requestedPriority] < priorityRank[categoryPriority]
  ) {
    return requestedPriority;
  }

  // A requester may flag greater urgency, but cannot weaken the category rule.
  return categoryPriority;
};

export const normalizeComplaintFilters = (input = {}) => {
  const page = Number(input.page ?? 1);
  const pageSize = Number(input.pageSize ?? 20);
  const search = normalizeCode(input.search);
  const hostelCode = normalizeCode(input.hostelCode, (value) =>
    value.toUpperCase()
  );
  const categoryCode = normalizeCode(input.categoryCode, (value) =>
    value.toLowerCase()
  );
  const status = normalizeCode(input.status);
  const priority = normalizeCode(input.priority);
  const slaState = normalizeCode(input.slaState) || "all";
  const sortBy = normalizeCode(input.sortBy) || "createdAt";
  const sortOrder = normalizeCode(input.sortOrder) || "desc";
  const createdFrom = normalizeCode(input.createdFrom);
  const createdTo = normalizeCode(input.createdTo);

  if (!Number.isSafeInteger(page) || page < 1) {
    fail(400, "INVALID_PAGE", "Page must be a positive integer");
  }
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    fail(400, "INVALID_PAGE_SIZE", "Page size must be between 1 and 100");
  }
  if (search.length > 100) {
    fail(400, "INVALID_SEARCH", "Search must contain at most 100 characters");
  }
  if (hostelCode && !/^[A-Z][A-Z0-9-]{0,19}$/.test(hostelCode)) {
    fail(400, "INVALID_HOSTEL", "Hostel code is invalid");
  }
  if (categoryCode && !/^[a-z][a-z0-9_]{1,49}$/.test(categoryCode)) {
    fail(400, "INVALID_COMPLAINT_CATEGORY", "Complaint category is invalid");
  }
  if (status && !knownStatuses.has(status)) {
    fail(400, "INVALID_COMPLAINT_STATUS", "Complaint status is invalid");
  }
  if (priority && !knownPriorities.has(priority)) {
    fail(400, "INVALID_COMPLAINT_PRIORITY", "Complaint priority is invalid");
  }
  if (!knownSlaStates.has(slaState)) {
    fail(400, "INVALID_SLA_STATE", "Complaint SLA state is invalid");
  }
  if (!knownSortFields.has(sortBy)) {
    fail(400, "INVALID_SORT", "Complaint sort field is invalid");
  }
  if (!knownSortOrders.has(sortOrder)) {
    fail(400, "INVALID_SORT_ORDER", "Complaint sort order is invalid");
  }

  const createdFromDate = createdFrom ? new Date(createdFrom) : null;
  const createdToDate = createdTo ? new Date(createdTo) : null;

  if (createdFrom && Number.isNaN(createdFromDate.getTime())) {
    fail(400, "INVALID_DATE_FILTER", "Created-from timestamp is invalid");
  }
  if (createdTo && Number.isNaN(createdToDate.getTime())) {
    fail(400, "INVALID_DATE_FILTER", "Created-to timestamp is invalid");
  }
  if (createdFromDate && createdToDate && createdFromDate > createdToDate) {
    fail(
      400,
      "INVALID_DATE_RANGE",
      "Created-from timestamp cannot be after created-to timestamp"
    );
  }

  return Object.freeze({
    page,
    pageSize,
    search: search || null,
    hostelCode: hostelCode || null,
    categoryCode: categoryCode || null,
    status: status || null,
    priority: priority || null,
    slaState,
    sortBy,
    sortOrder,
    createdFrom: createdFromDate,
    createdTo: createdToDate,
  });
};

export const normalizeWorkQueueFilters = (input = {}) =>
  normalizeComplaintFilters({
    ...input,
    sortBy: input.sortBy ?? "priority",
    sortOrder: input.sortOrder ?? "asc",
  });

export const normalizeComplaintInput = (input = {}) => {
  const categoryCode = normalizeCode(input.categoryCode, (value) =>
    value.toLowerCase()
  );
  const location = normalizeCode(input.location);
  const description = normalizeCode(input.description);
  const hostelCode = normalizeCode(input.hostelCode, (value) =>
    value.toUpperCase()
  );
  const requestedPriority = input.requestedPriority ?? null;
  const roomId = input.roomId == null
    ? null
    : requirePositiveInteger(input.roomId, "Room ID");

  if (!/^[a-z][a-z0-9_]{1,49}$/.test(categoryCode)) {
    fail(400, "INVALID_COMPLAINT_CATEGORY", "Complaint category is invalid");
  }
  if (!location || location.length > 255) {
    fail(400, "INVALID_COMPLAINT_LOCATION", "Complaint location is invalid");
  }
  if (description.length < 10 || description.length > 2000) {
    fail(
      400,
      "INVALID_COMPLAINT_DESCRIPTION",
      "Complaint description must contain between 10 and 2000 characters"
    );
  }
  if (hostelCode && !/^[A-Z][A-Z0-9-]{0,19}$/.test(hostelCode)) {
    fail(400, "INVALID_HOSTEL", "Hostel code is invalid");
  }
  if (requestedPriority && !knownPriorities.has(requestedPriority)) {
    fail(400, "INVALID_COMPLAINT_PRIORITY", "Complaint priority is invalid");
  }

  return Object.freeze({
    categoryCode,
    location,
    description,
    requestedPriority,
    hostelCode: hostelCode || null,
    roomId,
  });
};

// Authenticated actor and creation context --------------------------------

export const loadComplaintActor = async (database, requestActor) => {
  const actorId = requireActorId(requestActor?.id);
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
    actor.role !== requestActor?.role
  ) {
    fail(
      403,
      "COMPLAINT_ACCESS_DENIED",
      "You do not have access to complaints"
    );
  }

  return Object.freeze(actor);
};

const loadStudentComplaintContext = async (database, actor, input) => {
  const [context] = await database
    .select({
      studentProfileId: studentProfiles.id,
      hostelId: hostels.id,
      hostelCode: hostels.code,
      hostelName: hostels.name,
      allocatedRoomId: roomAllocations.roomId,
    })
    .from(studentProfiles)
    .innerJoin(hostels, eq(studentProfiles.hostelId, hostels.id))
    .leftJoin(
      roomAllocations,
      and(
        eq(roomAllocations.studentProfileId, studentProfiles.id),
        isNull(roomAllocations.vacatedAt)
      )
    )
    .where(
      and(
        eq(studentProfiles.userId, actor.id),
        eq(hostels.isActive, true)
      )
    )
    .limit(1);

  if (!context) {
    fail(
      409,
      "STUDENT_PROFILE_REQUIRED",
      "Complete your approved student profile before creating a complaint"
    );
  }

  if (input.hostelCode && input.hostelCode !== context.hostelCode) {
    fail(403, "HOSTEL_SCOPE_DENIED", "You cannot report for this hostel");
  }

  return Object.freeze(context);
};

const loadStaffComplaintContext = async (database, actor, input) => {
  if (!input.hostelCode) {
    fail(
      400,
      "HOSTEL_REQUIRED",
      "Staff must choose the hostel for this complaint"
    );
  }

  const conditions = [
    eq(hostels.code, input.hostelCode),
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
    conditions.push(exists(assignedHostel));
  }

  const [hostel] = await database
    .select({
      hostelId: hostels.id,
      hostelCode: hostels.code,
      hostelName: hostels.name,
    })
    .from(hostels)
    .where(and(...conditions))
    .limit(1);

  if (!hostel) {
    fail(403, "HOSTEL_SCOPE_DENIED", "You cannot report for this hostel");
  }

  return Object.freeze({ ...hostel, studentProfileId: null, allocatedRoomId: null });
};

const loadComplaintContext = async (database, actor, input) => {
  if (!complaintCreatorRoles.has(actor.role)) {
    fail(
      403,
      "COMPLAINT_CREATE_DENIED",
      "You cannot create maintenance complaints"
    );
  }

  return actor.role === USER_ROLES.STUDENT
    ? loadStudentComplaintContext(database, actor, input)
    : loadStaffComplaintContext(database, actor, input);
};

const loadCategory = async (database, categoryCode) => {
  const [category] = await database
    .select({
      id: complaintCategories.id,
      code: complaintCategories.code,
      name: complaintCategories.name,
      defaultPriority: complaintCategories.defaultPriority,
      slaMinutes: complaintCategories.slaMinutes,
    })
    .from(complaintCategories)
    .where(
      and(
        eq(complaintCategories.code, categoryCode),
        eq(complaintCategories.isActive, true)
      )
    )
    .limit(1);

  if (!category) {
    fail(
      422,
      "COMPLAINT_CATEGORY_NOT_FOUND",
      "Choose an active complaint category"
    );
  }

  return Object.freeze(category);
};

const resolveRoomId = async (database, context, requestedRoomId) => {
  const roomId = requestedRoomId ?? context.allocatedRoomId ?? null;

  if (!roomId) {
    return null;
  }

  const [room] = await database
    .select({ id: rooms.id })
    .from(rooms)
    .innerJoin(hostelBlocks, eq(rooms.blockId, hostelBlocks.id))
    .where(
      and(
        eq(rooms.id, roomId),
        eq(rooms.isActive, true),
        eq(hostelBlocks.isActive, true),
        eq(hostelBlocks.hostelId, context.hostelId)
      )
    )
    .limit(1);

  if (!room) {
    fail(
      422,
      "COMPLAINT_ROOM_NOT_FOUND",
      "Choose an active room in the complaint hostel"
    );
  }

  return room.id;
};

// Shared API response shape ------------------------------------------------

const assigneeUsers = alias(users, "complaint_assignee");

const complaintSelection = {
  id: complaints.id,
  hostelId: complaints.hostelId,
  hostelCode: hostels.code,
  hostelName: hostels.name,
  reportedByUserId: complaints.reportedByUserId,
  reporterName: users.name,
  categoryCode: complaintCategories.code,
  categoryName: complaintCategories.name,
  roomId: complaints.roomId,
  blockCode: hostelBlocks.code,
  roomNumber: rooms.roomNumber,
  location: complaints.location,
  description: complaints.description,
  requestedPriority: complaints.requestedPriority,
  priority: complaints.priority,
  slaPolicyMinutes: complaints.slaPolicyMinutes,
  slaDeadline: complaints.slaDeadline,
  status: complaints.status,
  resolutionNote: complaints.resolutionNote,
  resolvedAt: complaints.resolvedAt,
  closedAt: complaints.closedAt,
  createdAt: complaints.createdAt,
  updatedAt: complaints.updatedAt,
  assignmentId: complaintAssignments.id,
  assigneeUserId: complaintAssignments.assigneeUserId,
  assigneeName: assigneeUsers.name,
  assignedAt: complaintAssignments.assignedAt,
};

const addComplaintJoins = (query) =>
  query
    .innerJoin(hostels, eq(complaints.hostelId, hostels.id))
    .innerJoin(users, eq(complaints.reportedByUserId, users.id))
    .innerJoin(
      complaintCategories,
      eq(complaints.categoryId, complaintCategories.id)
    )
    .leftJoin(rooms, eq(complaints.roomId, rooms.id))
    .leftJoin(hostelBlocks, eq(rooms.blockId, hostelBlocks.id))
    .leftJoin(
      complaintAssignments,
      and(
        eq(complaintAssignments.complaintId, complaints.id),
        isNull(complaintAssignments.endedAt)
      )
    )
    .leftJoin(
      assigneeUsers,
      eq(complaintAssignments.assigneeUserId, assigneeUsers.id)
    );

const getSlaView = (record, now) => {
  const open = !completedComplaintStatuses.has(record.status);
  const millisecondsRemaining = new Date(record.slaDeadline).getTime() - now.getTime();
  const breached = open && millisecondsRemaining < 0;

  return {
    deadline: record.slaDeadline,
    policyMinutes: record.slaPolicyMinutes,
    state: open ? (breached ? "breached" : "active") : "completed",
    remainingSeconds: open ? Math.max(0, Math.ceil(millisecondsRemaining / 1000)) : null,
    breached,
  };
};

const toComplaintView = (record, now) => ({
  id: record.id,
  category: { code: record.categoryCode, name: record.categoryName },
  hostel: { code: record.hostelCode, name: record.hostelName },
  room: record.roomId
    ? {
        id: record.roomId,
        number: record.roomNumber,
        label: `${record.blockCode}-${record.roomNumber}`,
      }
    : null,
  location: record.location,
  description: record.description,
  requestedPriority: record.requestedPriority,
  priority: record.priority,
  status: record.status,
  sla: getSlaView(record, now),
  reportedBy: { id: record.reportedByUserId, name: record.reporterName },
  resolutionNote: record.resolutionNote,
  resolvedAt: record.resolvedAt,
  closedAt: record.closedAt,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
  assignment: record.assignmentId
    ? {
        id: record.assignmentId,
        assignee: {
          id: record.assigneeUserId,
          name: record.assigneeName,
        },
        assignedAt: record.assignedAt,
      }
    : null,
});

// Transactional creation ---------------------------------------------------

export const createComplaint = async (
  database,
  requestActor,
  input,
  { now = new Date() } = {}
) => {
  const createdAt = requireOperationTime(now);
  const actor = await loadComplaintActor(database, requestActor);
  const complaintInput = normalizeComplaintInput(input);
  const context = await loadComplaintContext(database, actor, complaintInput);
  const category = await loadCategory(database, complaintInput.categoryCode);
  const roomId = await resolveRoomId(
    database,
    context,
    complaintInput.roomId
  );
  const priority = determineComplaintPriority(
    category.defaultPriority,
    complaintInput.requestedPriority
  );
  const slaPolicyMinutes =
    priority === category.defaultPriority
      ? category.slaMinutes
      : COMPLAINT_SLA_MINUTES[priority];
  const slaDeadline = new Date(
    createdAt.getTime() + slaPolicyMinutes * 60 * 1000
  );

  const complaintId = await database.transaction(async (transaction) => {
    const [complaint] = await transaction
      .insert(complaints)
      .values({
        hostelId: context.hostelId,
        reportedByUserId: actor.id,
        studentProfileId: context.studentProfileId,
        categoryId: category.id,
        roomId,
        location: complaintInput.location,
        description: complaintInput.description,
        requestedPriority: complaintInput.requestedPriority,
        priority,
        slaPolicyMinutes,
        slaDeadline,
        status: COMPLAINT_STATUSES.CREATED,
        createdAt,
        updatedAt: createdAt,
      })
      .returning({ id: complaints.id });

    await transaction.insert(complaintEvents).values({
      complaintId: complaint.id,
      eventType: COMPLAINT_EVENT_TYPES.CREATED,
      fromStatus: null,
      toStatus: COMPLAINT_STATUSES.CREATED,
      actorUserId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      metadata: { categoryCode: category.code, priority },
      occurredAt: createdAt,
    });

    await appendAuditEvent(transaction, {
      actor,
      category: AUDIT_CATEGORIES.COMPLAINT,
      action: AUDIT_ACTIONS.COMPLAINT_CREATED,
      resourceType: AUDIT_RESOURCE_TYPES.COMPLAINT,
      resourceId: complaint.id,
      description: "Created a maintenance complaint",
      metadata: { categoryCode: category.code, priority },
      assignedHostels: [
        { id: context.hostelId, code: context.hostelCode },
      ],
      createdAt,
    });

    return complaint.id;
  });

  return getComplaintById(database, requestActor, complaintId, { now });
};

// Paginated own, managed, and assigned queues ------------------------------

const addManagedScope = (database, actor, conditions) => {
  if (actor.role === USER_ROLES.ADMIN) {
    return;
  }

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
};

const buildComplaintConditions = (database, actor, filters, scope, now) => {
  const conditions = [];

  if (scope === "own") {
    conditions.push(eq(complaints.reportedByUserId, actor.id));
  } else if (scope === "managed") {
    addManagedScope(database, actor, conditions);
  } else {
    conditions.push(eq(complaintAssignments.assigneeUserId, actor.id));
    conditions.push(isNull(complaintAssignments.endedAt));
  }

  if (filters.search) {
    const pattern = `%${filters.search}%`;
    conditions.push(
      or(
        ilike(complaints.location, pattern),
        ilike(complaints.description, pattern),
        ilike(complaintCategories.name, pattern),
        ilike(users.name, pattern)
      )
    );
  }
  if (filters.hostelCode) {
    conditions.push(eq(hostels.code, filters.hostelCode));
  }
  if (filters.categoryCode) {
    conditions.push(eq(complaintCategories.code, filters.categoryCode));
  }
  if (filters.status) {
    conditions.push(eq(complaints.status, filters.status));
  }
  if (filters.priority) {
    conditions.push(eq(complaints.priority, filters.priority));
  }
  if (filters.slaState === "open") {
    conditions.push(ne(complaints.status, COMPLAINT_STATUSES.RESOLVED));
    conditions.push(ne(complaints.status, COMPLAINT_STATUSES.CLOSED));
  }
  if (filters.slaState === "breached") {
    conditions.push(ne(complaints.status, COMPLAINT_STATUSES.RESOLVED));
    conditions.push(ne(complaints.status, COMPLAINT_STATUSES.CLOSED));
    conditions.push(lt(complaints.slaDeadline, now));
  }
  if (filters.createdFrom) {
    conditions.push(gte(complaints.createdAt, filters.createdFrom));
  }
  if (filters.createdTo) {
    conditions.push(lte(complaints.createdAt, filters.createdTo));
  }

  return and(...conditions);
};

const prioritySortExpression = sql`case ${complaints.priority}
  when 'critical' then 1
  when 'high' then 2
  when 'medium' then 3
  else 4
end`;

const getSortExpression = (sortBy) => {
  if (sortBy === "slaDeadline") {
    return complaints.slaDeadline;
  }
  if (sortBy === "priority") {
    return prioritySortExpression;
  }
  return complaints.createdAt;
};

const searchComplaints = async (
  database,
  requestActor,
  input,
  scope,
  { now = new Date() } = {}
) => {
  const operationTime = requireOperationTime(now);
  const filters =
    scope === "assigned"
      ? normalizeWorkQueueFilters(input)
      : normalizeComplaintFilters(input);
  const actor = await loadComplaintActor(database, requestActor);

  if (scope === "managed" && !complaintManagerRoles.has(actor.role)) {
    fail(
      403,
      "COMPLAINT_MANAGEMENT_DENIED",
      "You do not have access to the managed complaint queue"
    );
  }
  if (scope === "own" && !complaintCreatorRoles.has(actor.role)) {
    fail(
      403,
      "COMPLAINT_ACCESS_DENIED",
      "You do not have access to personal complaints"
    );
  }
  if (scope === "assigned" && actor.role !== USER_ROLES.MAINTENANCE) {
    fail(
      403,
      "COMPLAINT_WORK_QUEUE_DENIED",
      "You do not have access to a maintenance work queue"
    );
  }

  const whereClause = buildComplaintConditions(
    database,
    actor,
    filters,
    scope,
    operationTime
  );
  const [countResult] = await addComplaintJoins(
    database.select({ total: count() }).from(complaints)
  ).where(whereClause);
  const direction = filters.sortOrder === "asc" ? asc : desc;
  const orderBy = [direction(getSortExpression(filters.sortBy))];

  if (scope === "assigned" && filters.sortBy === "priority") {
    orderBy.push(asc(complaints.slaDeadline));
  }
  orderBy.push(direction(complaints.id));

  const records = await addComplaintJoins(
    database.select(complaintSelection).from(complaints)
  )
    .where(whereClause)
    .orderBy(...orderBy)
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize);
  const total = Number(countResult?.total ?? 0);

  return {
    data: records.map((record) => toComplaintView(record, operationTime)),
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / filters.pageSize),
    },
  };
};

export const searchOwnComplaints = (database, actor, input, options) =>
  searchComplaints(database, actor, input, "own", options);

export const searchManagedComplaints = (database, actor, input, options) =>
  searchComplaints(database, actor, input, "managed", options);

export const searchAssignedComplaints = (database, actor, input, options) =>
  searchComplaints(database, actor, input, "assigned", options);

// Authorized detail and reference data ------------------------------------

export const assertComplaintVisibility = async (database, actor, complaint) => {
  if (actor.role === USER_ROLES.ADMIN) {
    return;
  }
  if (
    actor.role === USER_ROLES.STUDENT &&
    complaint.reportedByUserId === actor.id
  ) {
    return;
  }
  if (actor.role === USER_ROLES.WARDEN) {
    const [membership] = await database
      .select({ id: hostelMemberships.id })
      .from(hostelMemberships)
      .where(
        and(
          eq(hostelMemberships.userId, actor.id),
          eq(hostelMemberships.hostelId, complaint.hostelId)
        )
      )
      .limit(1);

    if (membership) {
      return;
    }
  }
  if (actor.role === USER_ROLES.MAINTENANCE) {
    const [assignment] = await database
      .select({ id: complaintAssignments.id })
      .from(complaintAssignments)
      .where(
        and(
          eq(complaintAssignments.complaintId, complaint.id),
          eq(complaintAssignments.assigneeUserId, actor.id),
          isNull(complaintAssignments.endedAt)
        )
      )
      .limit(1);

    if (assignment) {
      return;
    }
  }

  // Do not reveal whether an inaccessible complaint ID exists.
  fail(404, "COMPLAINT_NOT_FOUND", "Complaint not found");
};

export const getComplaintById = async (
  database,
  requestActor,
  complaintId,
  { now = new Date() } = {}
) => {
  const operationTime = requireOperationTime(now);
  const id = requirePositiveInteger(complaintId, "Complaint ID");
  const actor = await loadComplaintActor(database, requestActor);
  const [record] = await addComplaintJoins(
    database.select(complaintSelection).from(complaints)
  )
    .where(eq(complaints.id, id))
    .limit(1);

  if (!record) {
    fail(404, "COMPLAINT_NOT_FOUND", "Complaint not found");
  }

  await assertComplaintVisibility(database, actor, record);

  const timeline = await database
    .select({
      id: complaintEvents.id,
      type: complaintEvents.eventType,
      fromStatus: complaintEvents.fromStatus,
      toStatus: complaintEvents.toStatus,
      actor: {
        id: complaintEvents.actorUserId,
        name: complaintEvents.actorName,
        role: complaintEvents.actorRole,
      },
      note: complaintEvents.note,
      metadata: complaintEvents.metadata,
      occurredAt: complaintEvents.occurredAt,
    })
    .from(complaintEvents)
    .where(eq(complaintEvents.complaintId, id))
    .orderBy(asc(complaintEvents.occurredAt), asc(complaintEvents.id));

  return { ...toComplaintView(record, operationTime), timeline };
};

export const listComplaintCategories = async (database, requestActor) => {
  const actor = await loadComplaintActor(database, requestActor);

  if (!complaintCreatorRoles.has(actor.role)) {
    fail(
      403,
      "COMPLAINT_CREATE_DENIED",
      "You cannot create maintenance complaints"
    );
  }

  return database
    .select({
      code: complaintCategories.code,
      name: complaintCategories.name,
      defaultPriority: complaintCategories.defaultPriority,
      slaMinutes: complaintCategories.slaMinutes,
    })
    .from(complaintCategories)
    .where(eq(complaintCategories.isActive, true))
    .orderBy(asc(complaintCategories.name));
};
