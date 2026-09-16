import { and, asc, count, eq, inArray, isNull } from "drizzle-orm";
import { hostels, roomAllocations, rooms } from "../db/schema.js";
import {
  AUDIT_ACTIONS,
  AUDIT_CATEGORIES,
  AUDIT_RESOURCE_TYPES,
} from "../domain/auditEvents.js";
import { ApiError } from "../utils/apiErrors.js";
import { appendAuditEvent, loadAuditActor } from "./auditEventService.js";

const fail = (status, code, message) => {
  throw new ApiError(status, code, message);
};

const requireId = (value, label) => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) {
    fail(400, "INVALID_REQUEST", `${label} must be a positive integer`);
  }
  return id;
};

const loadHostel = async (database, hostelId) => {
  const id = requireId(hostelId, "Hostel ID");
  const [hostel] = await database
    .select({
      id: hostels.id,
      code: hostels.code,
      name: hostels.name,
      residentType: hostels.residentType,
      isActive: hostels.isActive,
    })
    .from(hostels)
    .where(eq(hostels.id, id))
    .limit(1);

  if (!hostel) fail(404, "HOSTEL_NOT_FOUND", "Hostel not found");
  return hostel;
};

const loadRoom = async (database, hostelId, roomId) => {
  const id = requireId(roomId, "Room ID");
  const [room] = await database
    .select()
    .from(rooms)
    .where(
      and(
        eq(rooms.id, id),
        eq(rooms.hostelId, requireId(hostelId, "Hostel ID"))
      )
    )
    .limit(1);

  if (!room) fail(404, "ROOM_NOT_FOUND", "Room not found in this hostel");
  return room;
};

const occupancyForRooms = async (database, roomIds) => {
  if (roomIds.length === 0) return new Map();

  const rows = await database
    .select({ roomId: roomAllocations.roomId, total: count() })
    .from(roomAllocations)
    .where(
      and(
        inArray(roomAllocations.roomId, roomIds),
        isNull(roomAllocations.vacatedAt)
      )
    )
    .groupBy(roomAllocations.roomId);

  return new Map(rows.map((row) => [row.roomId, Number(row.total)]));
};

const writeRoomAudit = async (
  transaction,
  actorId,
  hostel,
  action,
  room,
  description,
  metadata
) => {
  const actor = await loadAuditActor(transaction, actorId);
  await appendAuditEvent(transaction, {
    actor,
    category: AUDIT_CATEGORIES.ROOM,
    action,
    resourceType: AUDIT_RESOURCE_TYPES.ROOM,
    resourceId: room.id,
    description,
    metadata,
    assignedHostels: [hostel],
  });
};

export const getHostelInventory = async (database, hostelId) => {
  const hostel = await loadHostel(database, hostelId);
  const roomRows = await database
    .select()
    .from(rooms)
    .where(eq(rooms.hostelId, hostel.id))
    .orderBy(asc(rooms.floor), asc(rooms.roomNumber));
  const occupancy = await occupancyForRooms(
    database,
    roomRows.map((room) => room.id)
  );

  return {
    hostel,
    rooms: roomRows.map((room) => {
      const occupiedBeds = occupancy.get(room.id) ?? 0;
      return {
        ...room,
        occupancy: occupiedBeds,
        availableBeds: Math.max(room.capacity - occupiedBeds, 0),
      };
    }),
  };
};

export const createHostelRoom = async (
  database,
  hostelId,
  input,
  actorId
) =>
  database.transaction(async (transaction) => {
    const hostel = await loadHostel(transaction, hostelId);
    if (!hostel.isActive) {
      fail(409, "HOSTEL_INACTIVE", "Activate the hostel before adding rooms");
    }

    const [room] = await transaction
      .insert(rooms)
      .values({
        hostelId: hostel.id,
        roomNumber: input.roomNumber.trim().toUpperCase(),
        floor: input.floor,
        capacity: input.capacity,
      })
      .returning();

    await writeRoomAudit(
      transaction,
      actorId,
      hostel,
      AUDIT_ACTIONS.ROOM_CREATED,
      room,
      `Created room ${room.roomNumber} in ${hostel.code}`,
      {
        roomNumber: room.roomNumber,
        floor: room.floor,
        capacity: room.capacity,
      }
    );

    return { ...room, occupancy: 0, availableBeds: room.capacity };
  });

export const updateHostelRoom = async (
  database,
  hostelId,
  roomId,
  input,
  actorId
) =>
  database.transaction(async (transaction) => {
    const hostel = await loadHostel(transaction, hostelId);
    const existing = await loadRoom(transaction, hostel.id, roomId);
    const occupancy =
      (await occupancyForRooms(transaction, [existing.id])).get(existing.id) ??
      0;

    if (input.capacity < occupancy) {
      fail(
        409,
        "ROOM_CAPACITY_BELOW_OCCUPANCY",
        `Capacity cannot be lower than the current occupancy of ${occupancy}`
      );
    }

    const [room] = await transaction
      .update(rooms)
      .set({ floor: input.floor, capacity: input.capacity, updatedAt: new Date() })
      .where(eq(rooms.id, existing.id))
      .returning();

    await writeRoomAudit(
      transaction,
      actorId,
      hostel,
      AUDIT_ACTIONS.ROOM_UPDATED,
      room,
      `Updated room ${room.roomNumber} in ${hostel.code}`,
      {
        before: { floor: existing.floor, capacity: existing.capacity },
        after: { floor: room.floor, capacity: room.capacity },
      }
    );

    return { ...room, occupancy, availableBeds: room.capacity - occupancy };
  });

export const setHostelRoomStatus = async (
  database,
  hostelId,
  roomId,
  isActive,
  actorId
) =>
  database.transaction(async (transaction) => {
    const hostel = await loadHostel(transaction, hostelId);
    const existing = await loadRoom(transaction, hostel.id, roomId);
    const occupancy =
      (await occupancyForRooms(transaction, [existing.id])).get(existing.id) ??
      0;

    if (!isActive && occupancy > 0) {
      fail(
        409,
        "ROOM_DEACTIVATION_BLOCKED",
        "Vacate every resident before deactivating this room"
      );
    }
    if (isActive && !hostel.isActive) {
      fail(409, "HOSTEL_INACTIVE", "Activate the hostel before this room");
    }

    if (existing.isActive === isActive) {
      return {
        ...existing,
        occupancy,
        availableBeds: existing.capacity - occupancy,
      };
    }

    const [room] = await transaction
      .update(rooms)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(rooms.id, existing.id))
      .returning();

    await writeRoomAudit(
      transaction,
      actorId,
      hostel,
      AUDIT_ACTIONS.ROOM_STATUS_CHANGED,
      room,
      `${isActive ? "Activated" : "Deactivated"} room ${room.roomNumber} in ${hostel.code}`,
      { isActive, roomNumber: room.roomNumber }
    );

    return { ...room, occupancy, availableBeds: room.capacity - occupancy };
  });
