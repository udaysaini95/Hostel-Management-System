import {
  and,
  asc,
  count,
  eq,
  exists,
  ilike,
  isNull,
  or,
  sql,
} from "drizzle-orm";
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
import { USER_ROLES } from "../domain/roles.js";
import { ApiError } from "../utils/apiErrors.js";

const HOSTEL_OR_BLOCK_CODE_PATTERN = /^[A-Z][A-Z0-9-]{0,19}$/;
const ROOM_NUMBER_PATTERN = /^[A-Z0-9][A-Z0-9-]{0,19}$/;
const knownAccountStatuses = new Set(Object.values(ACCOUNT_STATUSES));
const directoryRoles = new Set([USER_ROLES.ADMIN, USER_ROLES.WARDEN]);

const fail = (status, code, message) => {
  throw new ApiError(status, code, message);
};

const normalizeCode = (value) =>
  typeof value === "string" ? value.trim().toUpperCase() : "";

export const normalizeResidentDirectoryFilters = (input = {}) => {
  const page = Number(input.page ?? 1);
  const pageSize = Number(input.pageSize ?? 20);
  const search = typeof input.search === "string" ? input.search.trim() : "";
  const hostelCode = normalizeCode(input.hostelCode);
  const blockCode = normalizeCode(input.blockCode);
  const roomNumber = normalizeCode(input.roomNumber);
  const accountStatus =
    typeof input.accountStatus === "string" ? input.accountStatus.trim() : "";

  if (!Number.isSafeInteger(page) || page < 1) {
    fail(400, "INVALID_PAGE", "Page must be a positive integer");
  }
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    fail(400, "INVALID_PAGE_SIZE", "Page size must be between 1 and 100");
  }
  if (search.length > 100) {
    fail(400, "INVALID_SEARCH", "Search must contain at most 100 characters");
  }
  if (hostelCode && !HOSTEL_OR_BLOCK_CODE_PATTERN.test(hostelCode)) {
    fail(400, "INVALID_HOSTEL", "Hostel code is invalid");
  }
  if (blockCode && !HOSTEL_OR_BLOCK_CODE_PATTERN.test(blockCode)) {
    fail(400, "INVALID_BLOCK", "Block code is invalid");
  }
  if (roomNumber && !ROOM_NUMBER_PATTERN.test(roomNumber)) {
    fail(400, "INVALID_ROOM", "Room number is invalid");
  }
  if (accountStatus && !knownAccountStatuses.has(accountStatus)) {
    fail(400, "INVALID_ACCOUNT_STATUS", "Account status is invalid");
  }

  return Object.freeze({
    page,
    pageSize,
    search: search || null,
    hostelCode: hostelCode || null,
    blockCode: blockCode || null,
    roomNumber: roomNumber || null,
    accountStatus: accountStatus || null,
  });
};

const loadDirectoryActor = async (database, actor) => {
  const actorId = Number(actor?.id);

  if (!Number.isSafeInteger(actorId) || actorId < 1) {
    fail(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  }

  const [account] = await database
    .select({ role: users.role, accountStatus: users.accountStatus })
    .from(users)
    .where(eq(users.id, actorId))
    .limit(1);

  if (
    !account ||
    account.accountStatus !== ACCOUNT_STATUSES.ACTIVE ||
    account.role !== actor.role ||
    !directoryRoles.has(account.role)
  ) {
    fail(
      403,
      "RESIDENT_DIRECTORY_ACCESS_DENIED",
      "You do not have access to the resident directory"
    );
  }

  return Object.freeze({ id: actorId, role: account.role });
};

const addDirectoryScope = (database, actor, conditions) => {
  if (actor.role === USER_ROLES.ADMIN) {
    return;
  }

  const assignedHostel = database
    .select({ id: hostelMemberships.id })
    .from(hostelMemberships)
    .where(
      and(
        eq(hostelMemberships.userId, actor.id),
        eq(hostelMemberships.hostelId, studentProfiles.hostelId)
      )
    );

  conditions.push(exists(assignedHostel));
};

const buildDirectoryWhereClause = (database, actor, filters) => {
  const conditions = [eq(users.role, USER_ROLES.STUDENT)];
  addDirectoryScope(database, actor, conditions);

  if (filters.search) {
    const pattern = `%${filters.search}%`;
    conditions.push(
      or(
        ilike(users.name, pattern),
        ilike(users.email, pattern),
        ilike(studentProfiles.rollNo, pattern)
      )
    );
  }
  if (filters.hostelCode) {
    conditions.push(eq(hostels.code, filters.hostelCode));
  }
  if (filters.blockCode) {
    conditions.push(eq(hostelBlocks.code, filters.blockCode));
  }
  if (filters.roomNumber) {
    conditions.push(eq(rooms.roomNumber, filters.roomNumber));
  }
  if (filters.accountStatus) {
    conditions.push(eq(users.accountStatus, filters.accountStatus));
  }

  // Keep this defensive boundary even though the allocation service now rejects
  // cross-hostel assignments transactionally. It protects reads from old data.
  conditions.push(
    or(
      isNull(roomAllocations.id),
      eq(hostelBlocks.hostelId, studentProfiles.hostelId)
    )
  );

  return and(...conditions);
};

const currentAllocationJoin = and(
  eq(roomAllocations.studentProfileId, studentProfiles.id),
  isNull(roomAllocations.vacatedAt)
);

const addDirectoryJoins = (query) =>
  query
    .innerJoin(users, eq(studentProfiles.userId, users.id))
    .innerJoin(hostels, eq(studentProfiles.hostelId, hostels.id))
    .leftJoin(roomAllocations, currentAllocationJoin)
    .leftJoin(rooms, eq(roomAllocations.roomId, rooms.id))
    .leftJoin(hostelBlocks, eq(rooms.blockId, hostelBlocks.id));

const toResidentListItem = (record) => ({
  userId: record.userId,
  name: record.name,
  email: record.email,
  rollNo: record.rollNo,
  phone: record.phone,
  accountStatus: record.accountStatus,
  hostel: {
    code: record.hostelCode,
    name: record.hostelName,
  },
  currentAllocation: record.allocationId
    ? {
        allocatedAt: record.allocatedAt,
        block: {
          code: record.blockCode,
          name: record.blockName,
        },
        room: {
          number: record.roomNumber,
          label: `${record.blockCode}-${record.roomNumber}`,
          floor: record.roomFloor,
          capacity: record.roomCapacity,
        },
      }
    : null,
  profileComplete: record.profileComplete,
});

export const searchResidents = async (database, requestActor, input = {}) => {
  const filters = normalizeResidentDirectoryFilters(input);
  const actor = await loadDirectoryActor(database, requestActor);
  const whereClause = buildDirectoryWhereClause(database, actor, filters);

  const [countResult] = await addDirectoryJoins(
    database.select({ total: count() }).from(studentProfiles)
  ).where(whereClause);
  const records = await addDirectoryJoins(
    database
      .select({
        userId: users.id,
        name: users.name,
        email: users.email,
        accountStatus: users.accountStatus,
        rollNo: studentProfiles.rollNo,
        phone: studentProfiles.phone,
        profileComplete: sql`
          ${studentProfiles.phone} is not null
          and ${studentProfiles.guardianName} is not null
          and ${studentProfiles.guardianPhone} is not null
        `.as("profile_complete"),
        hostelCode: hostels.code,
        hostelName: hostels.name,
        allocationId: roomAllocations.id,
        allocatedAt: roomAllocations.allocatedAt,
        blockCode: hostelBlocks.code,
        blockName: hostelBlocks.name,
        roomNumber: rooms.roomNumber,
        roomFloor: rooms.floor,
        roomCapacity: rooms.capacity,
      })
      .from(studentProfiles)
  )
    .where(whereClause)
    .orderBy(asc(users.name), asc(studentProfiles.rollNo))
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize);
  const total = Number(countResult?.total ?? 0);

  return {
    data: records.map(toResidentListItem),
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / filters.pageSize),
    },
  };
};
