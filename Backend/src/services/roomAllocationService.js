import { and, asc, count, eq, exists, isNull, sql } from "drizzle-orm";
import {
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
import { USER_ROLES } from "../domain/roles.js";
import { appendAuditEvent } from "./auditEventService.js";
import { ApiError } from "../utils/apiErrors.js";

const managementRoles = new Set([USER_ROLES.ADMIN, USER_ROLES.WARDEN]);
const availabilityFilters = new Set(["all", "available", "full"]);
const codePattern = /^[A-Z][A-Z0-9-]{0,19}$/;

const fail = (status, code, message) => {
  throw new ApiError(status, code, message);
};

const requirePositiveInteger = (value, label) => {
  if (!Number.isSafeInteger(value) || value < 1) {
    fail(400, "INVALID_ROOM_ALLOCATION", `${label} must be a positive integer`);
  }

  return value;
};

const requireDate = (value) => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    fail(400, "INVALID_ROOM_ALLOCATION", "Operation timestamp is invalid");
  }

  return value;
};

const normalizeCode = (value) =>
  typeof value === "string" ? value.trim().toUpperCase() : "";

export const normalizeRoomInventoryFilters = (input = {}) => {
  const page = Number(input.page ?? 1);
  const pageSize = Number(input.pageSize ?? 20);
  const hostelCode = normalizeCode(input.hostelCode);
  const blockCode = normalizeCode(input.blockCode);
  const availability =
    typeof input.availability === "string"
      ? input.availability.trim().toLowerCase()
      : "all";

  if (!Number.isSafeInteger(page) || page < 1) {
    fail(400, "INVALID_PAGE", "Page must be a positive integer");
  }
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    fail(400, "INVALID_PAGE_SIZE", "Page size must be between 1 and 100");
  }
  if (hostelCode && !codePattern.test(hostelCode)) {
    fail(400, "INVALID_HOSTEL", "Hostel code is invalid");
  }
  if (blockCode && !codePattern.test(blockCode)) {
    fail(400, "INVALID_BLOCK", "Block code is invalid");
  }
  if (!availabilityFilters.has(availability)) {
    fail(400, "INVALID_AVAILABILITY", "Availability filter is invalid");
  }

  return Object.freeze({
    page,
    pageSize,
    hostelCode: hostelCode || null,
    blockCode: blockCode || null,
    availability,
  });
};

const loadManager = async (database, requestActor) => {
  const actorId = Number(requestActor?.id);

  if (!Number.isSafeInteger(actorId) || actorId < 1) {
    fail(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
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
    actor.role !== requestActor.role ||
    !managementRoles.has(actor.role)
  ) {
    fail(
      403,
      "ROOM_MANAGEMENT_ACCESS_DENIED",
      "You do not have access to room management"
    );
  }

  return Object.freeze(actor);
};

const assertHostelAccess = async (database, actor, hostelId) => {
  if (actor.role === USER_ROLES.ADMIN) {
    return;
  }

  const [membership] = await database
    .select({ id: hostelMemberships.id })
    .from(hostelMemberships)
    .where(
      and(
        eq(hostelMemberships.userId, actor.id),
        eq(hostelMemberships.hostelId, hostelId)
      )
    )
    .limit(1);

  if (!membership) {
    fail(
      403,
      "HOSTEL_SCOPE_DENIED",
      "You cannot manage rooms in this hostel"
    );
  }
};

const activeOccupancy = sql`(
  select count(*)::integer
  from ${roomAllocations} as active_allocations
  where active_allocations.room_id = ${rooms.id}
    and active_allocations.vacated_at is null
)`;

const buildRoomInventoryConditions = (database, actor, filters) => {
  const conditions = [
    eq(hostels.isActive, true),
    eq(hostelBlocks.isActive, true),
    eq(rooms.isActive, true),
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
  if (filters.hostelCode) {
    conditions.push(eq(hostels.code, filters.hostelCode));
  }
  if (filters.blockCode) {
    conditions.push(eq(hostelBlocks.code, filters.blockCode));
  }
  if (filters.availability === "available") {
    conditions.push(sql`${activeOccupancy} < ${rooms.capacity}`);
  }
  if (filters.availability === "full") {
    conditions.push(sql`${activeOccupancy} >= ${rooms.capacity}`);
  }

  return and(...conditions);
};

const addRoomLocationJoins = (query) =>
  query
    .innerJoin(hostelBlocks, eq(rooms.blockId, hostelBlocks.id))
    .innerJoin(hostels, eq(hostelBlocks.hostelId, hostels.id));

export const listRoomInventory = async (database, requestActor, input = {}) => {
  const filters = normalizeRoomInventoryFilters(input);
  const actor = await loadManager(database, requestActor);
  const whereClause = buildRoomInventoryConditions(database, actor, filters);
  const [countResult] = await addRoomLocationJoins(
    database.select({ total: count() }).from(rooms)
  ).where(whereClause);
  const records = await addRoomLocationJoins(
    database
      .select({
        id: rooms.id,
        roomNumber: rooms.roomNumber,
        floor: rooms.floor,
        capacity: rooms.capacity,
        occupancy: activeOccupancy.as("occupancy"),
        blockId: hostelBlocks.id,
        blockCode: hostelBlocks.code,
        blockName: hostelBlocks.name,
        hostelId: hostels.id,
        hostelCode: hostels.code,
        hostelName: hostels.name,
      })
      .from(rooms)
  )
    .where(whereClause)
    .orderBy(
      asc(hostels.code),
      asc(hostelBlocks.code),
      asc(rooms.floor),
      asc(rooms.roomNumber)
    )
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize);
  const total = Number(countResult?.total ?? 0);

  return {
    data: records.map((record) => {
      const occupancy = Number(record.occupancy);

      return {
        id: record.id,
        number: record.roomNumber,
        label: `${record.blockCode}-${record.roomNumber}`,
        floor: record.floor,
        capacity: record.capacity,
        occupancy,
        availableBeds: Math.max(record.capacity - occupancy, 0),
        isFull: occupancy >= record.capacity,
        block: {
          id: record.blockId,
          code: record.blockCode,
          name: record.blockName,
        },
        hostel: {
          id: record.hostelId,
          code: record.hostelCode,
          name: record.hostelName,
        },
      };
    }),
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / filters.pageSize),
    },
  };
};

const lockStudent = async (transaction, studentUserId) => {
  const [profile] = await transaction
    .select({
      id: studentProfiles.id,
      userId: studentProfiles.userId,
      hostelId: studentProfiles.hostelId,
      rollNo: studentProfiles.rollNo,
    })
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, studentUserId))
    .for("update")
    .limit(1);

  if (!profile) {
    fail(404, "RESIDENT_NOT_FOUND", "Student profile was not found");
  }

  const [student] = await transaction
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      accountStatus: users.accountStatus,
    })
    .from(users)
    .where(eq(users.id, profile.userId))
    .limit(1);

  if (!student || student.role !== USER_ROLES.STUDENT) {
    fail(404, "RESIDENT_NOT_FOUND", "Student profile was not found");
  }
  if (student.accountStatus !== ACCOUNT_STATUSES.ACTIVE) {
    fail(
      409,
      "STUDENT_ACCOUNT_INACTIVE",
      "Only an active student can receive a room allocation"
    );
  }

  return { profile, student };
};

const lockRoom = async (transaction, roomId) => {
  const [room] = await transaction
    .select()
    .from(rooms)
    .where(eq(rooms.id, roomId))
    .for("update")
    .limit(1);

  if (!room) {
    fail(404, "ROOM_NOT_FOUND", "Room was not found");
  }

  const [location] = await transaction
    .select({
      blockId: hostelBlocks.id,
      blockCode: hostelBlocks.code,
      blockName: hostelBlocks.name,
      blockIsActive: hostelBlocks.isActive,
      hostelId: hostels.id,
      hostelCode: hostels.code,
      hostelName: hostels.name,
      hostelIsActive: hostels.isActive,
    })
    .from(hostelBlocks)
    .innerJoin(hostels, eq(hostelBlocks.hostelId, hostels.id))
    .where(eq(hostelBlocks.id, room.blockId))
    .limit(1);

  if (
    !location ||
    !room.isActive ||
    !location.blockIsActive ||
    !location.hostelIsActive
  ) {
    fail(409, "ROOM_UNAVAILABLE", "This room is not available for allocation");
  }

  return { room, location };
};

const toAllocationResult = ({
  allocation,
  student,
  profile,
  room,
  location,
}) => ({
  id: allocation.id,
  allocatedAt: allocation.allocatedAt,
  vacatedAt: allocation.vacatedAt ?? null,
  vacateReason: allocation.vacateReason ?? null,
  student: {
    userId: student.id,
    name: student.name,
    email: student.email,
    rollNo: profile.rollNo,
  },
  room: {
    id: room.id,
    number: room.roomNumber,
    label: `${location.blockCode}-${room.roomNumber}`,
    floor: room.floor,
    capacity: room.capacity,
  },
  block: {
    id: location.blockId,
    code: location.blockCode,
    name: location.blockName,
  },
  hostel: {
    id: location.hostelId,
    code: location.hostelCode,
    name: location.hostelName,
  },
});

export const allocateRoom = async (
  database,
  requestActor,
  input = {},
  { now = new Date() } = {}
) => {
  const studentUserId = requirePositiveInteger(
    input.studentUserId,
    "Student user ID"
  );
  const roomId = requirePositiveInteger(input.roomId, "Room ID");
  requireDate(now);

  return database.transaction(async (transaction) => {
    const actor = await loadManager(transaction, requestActor);
    // Every allocation locks in this order. That order protects both the
    // one-active-room rule and capacity when requests arrive together.
    const { profile, student } = await lockStudent(transaction, studentUserId);
    const { room, location } = await lockRoom(transaction, roomId);

    await assertHostelAccess(transaction, actor, location.hostelId);

    if (profile.hostelId !== location.hostelId) {
      fail(
        409,
        "ROOM_HOSTEL_MISMATCH",
        "A student can only be allocated within their assigned hostel"
      );
    }

    const [currentAllocation] = await transaction
      .select({ id: roomAllocations.id })
      .from(roomAllocations)
      .where(
        and(
          eq(roomAllocations.studentProfileId, profile.id),
          isNull(roomAllocations.vacatedAt)
        )
      )
      .limit(1);

    if (currentAllocation) {
      fail(
        409,
        "STUDENT_ALREADY_ALLOCATED",
        "Vacate the student's current allocation before assigning another room"
      );
    }

    const [occupancyResult] = await transaction
      .select({ total: count() })
      .from(roomAllocations)
      .where(
        and(
          eq(roomAllocations.roomId, room.id),
          isNull(roomAllocations.vacatedAt)
        )
      );
    const occupancy = Number(occupancyResult?.total ?? 0);

    if (occupancy >= room.capacity) {
      fail(409, "ROOM_CAPACITY_REACHED", "This room has no available beds");
    }

    const [allocation] = await transaction
      .insert(roomAllocations)
      .values({
        studentProfileId: profile.id,
        roomId: room.id,
        allocatedByUserId: actor.id,
        allocatedAt: now,
        createdAt: now,
      })
      .returning();

    await transaction
      .update(users)
      .set({
        roomNo: `${location.blockCode}-${room.roomNumber}`,
        updatedAt: now,
      })
      .where(eq(users.id, student.id));

    await appendAuditEvent(transaction, {
      actor,
      category: AUDIT_CATEGORIES.ROOM,
      action: AUDIT_ACTIONS.ROOM_ALLOCATION_CREATED,
      resourceType: AUDIT_RESOURCE_TYPES.ROOM_ALLOCATION,
      resourceId: allocation.id,
      description: `Allocated ${profile.rollNo} to ${location.blockCode}-${room.roomNumber}`,
      metadata: {
        studentUserId: student.id,
        rollNo: profile.rollNo,
        hostelCode: location.hostelCode,
        blockCode: location.blockCode,
        roomNumber: room.roomNumber,
        capacity: room.capacity,
        occupancyAfter: occupancy + 1,
      },
      assignedHostels: [
        { id: location.hostelId, code: location.hostelCode },
      ],
      createdAt: now,
    });

    return {
      allocation: toAllocationResult({
        allocation,
        student,
        profile,
        room,
        location,
      }),
    };
  });
};

export const vacateRoomAllocation = async (
  database,
  requestActor,
  allocationId,
  input = {},
  { now = new Date() } = {}
) => {
  const id = requirePositiveInteger(allocationId, "Allocation ID");
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  requireDate(now);

  if (reason.length < 5 || reason.length > 500) {
    fail(
      400,
      "INVALID_VACATE_REASON",
      "Vacate reason must contain between 5 and 500 characters"
    );
  }

  return database.transaction(async (transaction) => {
    const actor = await loadManager(transaction, requestActor);
    const [knownAllocation] = await transaction
      .select({ studentProfileId: roomAllocations.studentProfileId })
      .from(roomAllocations)
      .where(eq(roomAllocations.id, id))
      .limit(1);

    if (!knownAllocation) {
      fail(404, "ROOM_ALLOCATION_NOT_FOUND", "Room allocation was not found");
    }

    const [profile] = await transaction
      .select({
        id: studentProfiles.id,
        userId: studentProfiles.userId,
        hostelId: studentProfiles.hostelId,
        rollNo: studentProfiles.rollNo,
      })
      .from(studentProfiles)
      .where(eq(studentProfiles.id, knownAllocation.studentProfileId))
      .for("update")
      .limit(1);
    const [allocation] = await transaction
      .select()
      .from(roomAllocations)
      .where(eq(roomAllocations.id, id))
      .for("update")
      .limit(1);

    if (!profile || !allocation) {
      fail(404, "ROOM_ALLOCATION_NOT_FOUND", "Room allocation was not found");
    }
    if (allocation.vacatedAt) {
      fail(409, "ROOM_ALREADY_VACATED", "This allocation is already vacant");
    }

    const [student] = await transaction
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, profile.userId))
      .limit(1);
    const [room] = await transaction
      .select()
      .from(rooms)
      .where(eq(rooms.id, allocation.roomId))
      .limit(1);

    if (!student || !room) {
      fail(409, "ROOM_ALLOCATION_INVALID", "Allocation details are incomplete");
    }

    const [location] = await transaction
      .select({
        blockId: hostelBlocks.id,
        blockCode: hostelBlocks.code,
        blockName: hostelBlocks.name,
        hostelId: hostels.id,
        hostelCode: hostels.code,
        hostelName: hostels.name,
      })
      .from(hostelBlocks)
      .innerJoin(hostels, eq(hostelBlocks.hostelId, hostels.id))
      .where(eq(hostelBlocks.id, room.blockId))
      .limit(1);

    if (!location) {
      fail(409, "ROOM_ALLOCATION_INVALID", "Allocation details are incomplete");
    }

    await assertHostelAccess(transaction, actor, location.hostelId);

    const vacatedAt = new Date(
      Math.max(now.getTime(), allocation.allocatedAt.getTime() + 1)
    );
    const [vacatedAllocation] = await transaction
      .update(roomAllocations)
      .set({
        vacatedAt,
        vacatedByUserId: actor.id,
        vacateReason: reason,
      })
      .where(eq(roomAllocations.id, allocation.id))
      .returning();

    await transaction
      .update(users)
      .set({ roomNo: null, updatedAt: vacatedAt })
      .where(eq(users.id, student.id));

    await appendAuditEvent(transaction, {
      actor,
      category: AUDIT_CATEGORIES.ROOM,
      action: AUDIT_ACTIONS.ROOM_ALLOCATION_VACATED,
      resourceType: AUDIT_RESOURCE_TYPES.ROOM_ALLOCATION,
      resourceId: allocation.id,
      description: `Vacated ${profile.rollNo} from ${location.blockCode}-${room.roomNumber}`,
      metadata: {
        studentUserId: student.id,
        rollNo: profile.rollNo,
        hostelCode: location.hostelCode,
        blockCode: location.blockCode,
        roomNumber: room.roomNumber,
        reason,
      },
      assignedHostels: [
        { id: location.hostelId, code: location.hostelCode },
      ],
      createdAt: vacatedAt,
    });

    return {
      allocation: toAllocationResult({
        allocation: vacatedAllocation,
        student,
        profile,
        room,
        location,
      }),
    };
  });
};
