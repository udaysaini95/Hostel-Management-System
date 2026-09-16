import { and, asc, count, eq, inArray, isNull } from "drizzle-orm";
import {
  hostelBlocks,
  hostels,
  roomAllocations,
  rooms,
} from "../db/schema.js";
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

const loadBlock = async (database, hostelId, blockId) => {
  const id = requireId(blockId, "Block ID");
  const [block] = await database
    .select()
    .from(hostelBlocks)
    .where(
      and(
        eq(hostelBlocks.id, id),
        eq(hostelBlocks.hostelId, requireId(hostelId, "Hostel ID"))
      )
    )
    .limit(1);

  if (!block) fail(404, "HOSTEL_BLOCK_NOT_FOUND", "Hostel block not found");
  return block;
};

const loadRoom = async (database, hostelId, roomId) => {
  const id = requireId(roomId, "Room ID");
  const [room] = await database
    .select({
      id: rooms.id,
      blockId: rooms.blockId,
      roomNumber: rooms.roomNumber,
      floor: rooms.floor,
      capacity: rooms.capacity,
      isActive: rooms.isActive,
      blockCode: hostelBlocks.code,
      blockIsActive: hostelBlocks.isActive,
      hostelId: hostelBlocks.hostelId,
    })
    .from(rooms)
    .innerJoin(hostelBlocks, eq(rooms.blockId, hostelBlocks.id))
    .where(
      and(
        eq(rooms.id, id),
        eq(hostelBlocks.hostelId, requireId(hostelId, "Hostel ID"))
      )
    )
    .limit(1);

  if (!room) fail(404, "ROOM_NOT_FOUND", "Room not found in this hostel");
  return room;
};

const countActiveAllocations = async (database, roomIds) => {
  if (roomIds.length === 0) return 0;

  const [result] = await database
    .select({ total: count() })
    .from(roomAllocations)
    .where(
      and(
        inArray(roomAllocations.roomId, roomIds),
        isNull(roomAllocations.vacatedAt)
      )
    );

  return Number(result?.total ?? 0);
};

const writeInventoryAudit = async (
  transaction,
  actorId,
  hostel,
  action,
  resourceType,
  resourceId,
  description,
  metadata
) => {
  const actor = await loadAuditActor(transaction, actorId);

  await appendAuditEvent(transaction, {
    actor,
    category: AUDIT_CATEGORIES.ROOM,
    action,
    resourceType,
    resourceId,
    description,
    metadata,
    assignedHostels: [hostel],
  });
};

export const getHostelInventory = async (database, hostelId) => {
  const hostel = await loadHostel(database, hostelId);
  const blocks = await database
    .select()
    .from(hostelBlocks)
    .where(eq(hostelBlocks.hostelId, hostel.id))
    .orderBy(asc(hostelBlocks.code));
  const blockIds = blocks.map((block) => block.id);
  const roomRows = blockIds.length
    ? await database
        .select({
          id: rooms.id,
          blockId: rooms.blockId,
          roomNumber: rooms.roomNumber,
          floor: rooms.floor,
          capacity: rooms.capacity,
          isActive: rooms.isActive,
          createdAt: rooms.createdAt,
          updatedAt: rooms.updatedAt,
        })
        .from(rooms)
        .where(inArray(rooms.blockId, blockIds))
        .orderBy(asc(rooms.floor), asc(rooms.roomNumber))
    : [];
  const roomIds = roomRows.map((room) => room.id);
  const occupancyRows = roomIds.length
    ? await database
        .select({ roomId: roomAllocations.roomId, total: count() })
        .from(roomAllocations)
        .where(
          and(
            inArray(roomAllocations.roomId, roomIds),
            isNull(roomAllocations.vacatedAt)
          )
        )
        .groupBy(roomAllocations.roomId)
    : [];
  const occupancyByRoom = new Map(
    occupancyRows.map((row) => [row.roomId, Number(row.total)])
  );
  const roomsByBlock = new Map();

  for (const room of roomRows) {
    const occupancy = occupancyByRoom.get(room.id) ?? 0;
    const values = roomsByBlock.get(room.blockId) ?? [];
    values.push({
      ...room,
      occupancy,
      availableBeds: Math.max(room.capacity - occupancy, 0),
    });
    roomsByBlock.set(room.blockId, values);
  }

  return {
    hostel,
    blocks: blocks.map((block) => ({
      ...block,
      rooms: roomsByBlock.get(block.id) ?? [],
    })),
  };
};

export const createHostelBlock = async (database, hostelId, input, actorId) =>
  database.transaction(async (transaction) => {
    const hostel = await loadHostel(transaction, hostelId);
    if (!hostel.isActive) {
      fail(409, "HOSTEL_INACTIVE", "Activate the hostel before adding blocks");
    }

    const [block] = await transaction
      .insert(hostelBlocks)
      .values({
        hostelId: hostel.id,
        code: input.code.trim().toUpperCase(),
        name: input.name.trim(),
      })
      .returning();

    await writeInventoryAudit(
      transaction,
      actorId,
      hostel,
      AUDIT_ACTIONS.HOSTEL_BLOCK_CREATED,
      AUDIT_RESOURCE_TYPES.HOSTEL_BLOCK,
      block.id,
      `Created block ${hostel.code}-${block.code}`,
      { blockCode: block.code, blockName: block.name }
    );

    return block;
  });

export const updateHostelBlock = async (
  database,
  hostelId,
  blockId,
  input,
  actorId
) =>
  database.transaction(async (transaction) => {
    const hostel = await loadHostel(transaction, hostelId);
    const existing = await loadBlock(transaction, hostel.id, blockId);
    const [block] = await transaction
      .update(hostelBlocks)
      .set({ name: input.name.trim(), updatedAt: new Date() })
      .where(eq(hostelBlocks.id, existing.id))
      .returning();

    await writeInventoryAudit(
      transaction,
      actorId,
      hostel,
      AUDIT_ACTIONS.HOSTEL_BLOCK_UPDATED,
      AUDIT_RESOURCE_TYPES.HOSTEL_BLOCK,
      block.id,
      `Updated block ${hostel.code}-${block.code}`,
      { before: { name: existing.name }, after: { name: block.name } }
    );

    return block;
  });

export const setHostelBlockStatus = async (
  database,
  hostelId,
  blockId,
  isActive,
  actorId
) =>
  database.transaction(async (transaction) => {
    const hostel = await loadHostel(transaction, hostelId);
    const existing = await loadBlock(transaction, hostel.id, blockId);

    if (!isActive) {
      const roomRows = await transaction
        .select({ id: rooms.id })
        .from(rooms)
        .where(eq(rooms.blockId, existing.id));
      if (
        (await countActiveAllocations(
          transaction,
          roomRows.map((room) => room.id)
        )) > 0
      ) {
        fail(
          409,
          "BLOCK_DEACTIVATION_BLOCKED",
          "Vacate every occupied room before deactivating this block"
        );
      }
    } else if (!hostel.isActive) {
      fail(409, "HOSTEL_INACTIVE", "Activate the hostel before this block");
    }

    if (existing.isActive === isActive) return existing;

    const [block] = await transaction
      .update(hostelBlocks)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(hostelBlocks.id, existing.id))
      .returning();

    await writeInventoryAudit(
      transaction,
      actorId,
      hostel,
      AUDIT_ACTIONS.HOSTEL_BLOCK_STATUS_CHANGED,
      AUDIT_RESOURCE_TYPES.HOSTEL_BLOCK,
      block.id,
      `${isActive ? "Activated" : "Deactivated"} block ${hostel.code}-${block.code}`,
      { isActive, blockCode: block.code }
    );

    return block;
  });

export const createHostelRoom = async (
  database,
  hostelId,
  blockId,
  input,
  actorId
) =>
  database.transaction(async (transaction) => {
    const hostel = await loadHostel(transaction, hostelId);
    const block = await loadBlock(transaction, hostel.id, blockId);
    if (!hostel.isActive || !block.isActive) {
      fail(409, "BLOCK_INACTIVE", "Activate the hostel and block before adding rooms");
    }

    const [room] = await transaction
      .insert(rooms)
      .values({
        blockId: block.id,
        roomNumber: input.roomNumber.trim().toUpperCase(),
        floor: input.floor,
        capacity: input.capacity,
      })
      .returning();

    await writeInventoryAudit(
      transaction,
      actorId,
      hostel,
      AUDIT_ACTIONS.ROOM_CREATED,
      AUDIT_RESOURCE_TYPES.ROOM,
      room.id,
      `Created room ${block.code}-${room.roomNumber}`,
      { blockCode: block.code, roomNumber: room.roomNumber, floor: room.floor, capacity: room.capacity }
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
    const occupancy = await countActiveAllocations(transaction, [existing.id]);

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

    await writeInventoryAudit(
      transaction,
      actorId,
      hostel,
      AUDIT_ACTIONS.ROOM_UPDATED,
      AUDIT_RESOURCE_TYPES.ROOM,
      room.id,
      `Updated room ${existing.blockCode}-${room.roomNumber}`,
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
    const occupancy = await countActiveAllocations(transaction, [existing.id]);

    if (!isActive && occupancy > 0) {
      fail(
        409,
        "ROOM_DEACTIVATION_BLOCKED",
        "Vacate every resident before deactivating this room"
      );
    }
    if (isActive && (!hostel.isActive || !existing.blockIsActive)) {
      fail(
        409,
        "BLOCK_INACTIVE",
        "Activate the hostel and block before this room"
      );
    }

    if (existing.isActive === isActive) {
      return { ...existing, occupancy, availableBeds: existing.capacity - occupancy };
    }

    const [room] = await transaction
      .update(rooms)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(rooms.id, existing.id))
      .returning();

    await writeInventoryAudit(
      transaction,
      actorId,
      hostel,
      AUDIT_ACTIONS.ROOM_STATUS_CHANGED,
      AUDIT_RESOURCE_TYPES.ROOM,
      room.id,
      `${isActive ? "Activated" : "Deactivated"} room ${existing.blockCode}-${room.roomNumber}`,
      { isActive, blockCode: existing.blockCode, roomNumber: room.roomNumber }
    );

    return { ...room, occupancy, availableBeds: room.capacity - occupancy };
  });
