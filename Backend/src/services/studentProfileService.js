import { and, eq, isNull } from "drizzle-orm";
import {
  hostelBlocks,
  hostels,
  roomAllocations,
  rooms,
  studentProfiles,
  users,
} from "../db/schema.js";
import { USER_ROLES } from "../domain/roles.js";
import { ApiError } from "../utils/apiErrors.js";

const editableProfileFields = ["phone", "guardianName", "guardianPhone"];

const requireUserId = (value) => {
  const userId = Number(value);

  if (!Number.isSafeInteger(userId) || userId < 1) {
    throw new ApiError(
      401,
      "AUTHENTICATION_REQUIRED",
      "Authentication is required"
    );
  }

  return userId;
};

const failProfileNotFound = () => {
  throw new ApiError(
    404,
    "STUDENT_PROFILE_NOT_FOUND",
    "Student profile not found"
  );
};

const toProfileView = (record) => {
  const currentAllocation = record.allocationId
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
    : null;

  return {
    userId: record.userId,
    name: record.name,
    email: record.email,
    accountStatus: record.accountStatus,
    rollNo: record.rollNo,
    phone: record.phone,
    guardian: {
      name: record.guardianName,
      phone: record.guardianPhone,
    },
    hostel: {
      code: record.hostelCode,
      name: record.hostelName,
    },
    currentAllocation,
    profileComplete: Boolean(
      record.phone && record.guardianName && record.guardianPhone
    ),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
};

export const getOwnStudentProfile = async (database, actorUserId) => {
  const userId = requireUserId(actorUserId);
  const [record] = await database
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      accountStatus: users.accountStatus,
      rollNo: studentProfiles.rollNo,
      phone: studentProfiles.phone,
      guardianName: studentProfiles.guardianName,
      guardianPhone: studentProfiles.guardianPhone,
      hostelCode: hostels.code,
      hostelName: hostels.name,
      allocationId: roomAllocations.id,
      allocatedAt: roomAllocations.allocatedAt,
      blockCode: hostelBlocks.code,
      blockName: hostelBlocks.name,
      roomNumber: rooms.roomNumber,
      roomFloor: rooms.floor,
      roomCapacity: rooms.capacity,
      createdAt: studentProfiles.createdAt,
      updatedAt: studentProfiles.updatedAt,
    })
    .from(studentProfiles)
    .innerJoin(users, eq(studentProfiles.userId, users.id))
    .innerJoin(hostels, eq(studentProfiles.hostelId, hostels.id))
    .leftJoin(
      roomAllocations,
      and(
        eq(roomAllocations.studentProfileId, studentProfiles.id),
        isNull(roomAllocations.vacatedAt)
      )
    )
    .leftJoin(rooms, eq(roomAllocations.roomId, rooms.id))
    .leftJoin(hostelBlocks, eq(rooms.blockId, hostelBlocks.id))
    .where(
      and(eq(studentProfiles.userId, userId), eq(users.role, USER_ROLES.STUDENT))
    )
    .limit(1);

  if (!record) {
    failProfileNotFound();
  }

  return toProfileView(record);
};

const getEditableChanges = (input) => {
  const changes = {};

  for (const field of editableProfileFields) {
    if (Object.hasOwn(input, field)) {
      changes[field] = input[field];
    }
  }

  if (Object.keys(changes).length === 0) {
    throw new ApiError(
      422,
      "INVALID_PROFILE_UPDATE",
      "Provide at least one profile field to update"
    );
  }

  return changes;
};

export const updateOwnStudentProfile = async (
  database,
  actorUserId,
  input,
  { now = new Date() } = {}
) => {
  const userId = requireUserId(actorUserId);
  const changes = getEditableChanges(input ?? {});

  return database.transaction(async (transaction) => {
    const [updatedProfile] = await transaction
      .update(studentProfiles)
      .set({ ...changes, updatedAt: now })
      .where(eq(studentProfiles.userId, userId))
      .returning({ id: studentProfiles.id });

    if (!updatedProfile) {
      failProfileNotFound();
    }

    // Legacy gate and leave queries still read users.phone. Keep that value in
    // sync until those modules move to the normalized student profile model.
    if (Object.hasOwn(changes, "phone")) {
      await transaction
        .update(users)
        .set({ phone: changes.phone, updatedAt: now })
        .where(eq(users.id, userId));
    }

    return getOwnStudentProfile(transaction, userId);
  });
};
