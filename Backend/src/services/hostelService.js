import { asc, eq } from "drizzle-orm";
import {
  hostelMemberships,
  hostels,
  studentProfiles,
} from "../db/schema.js";
import {
  AUDIT_ACTIONS,
  AUDIT_CATEGORIES,
  AUDIT_RESOURCE_TYPES,
} from "../domain/auditEvents.js";
import { appendAuditEvent, loadAuditActor } from "./auditEventService.js";
import { ApiError } from "../utils/apiErrors.js";

const hostelSelection = {
  id: hostels.id,
  code: hostels.code,
  name: hostels.name,
  residentType: hostels.residentType,
  address: hostels.address,
  isActive: hostels.isActive,
  createdAt: hostels.createdAt,
  updatedAt: hostels.updatedAt,
};

const requireHostel = async (database, hostelId) => {
  const [hostel] = await database
    .select(hostelSelection)
    .from(hostels)
    .where(eq(hostels.id, Number(hostelId)))
    .limit(1);

  if (!hostel) {
    throw new ApiError(404, "HOSTEL_NOT_FOUND", "Hostel not found");
  }

  return hostel;
};

const normalizeAddress = (value) => {
  if (value === undefined) return undefined;
  return value.trim() || null;
};

export const listHostels = async (database, { includeInactive = false } = {}) => {
  const query = database.select(hostelSelection).from(hostels);
  const records = includeInactive
    ? await query.orderBy(asc(hostels.code))
    : await query.where(eq(hostels.isActive, true)).orderBy(asc(hostels.code));

  return Object.freeze({ hostels: records.map((hostel) => Object.freeze(hostel)) });
};

export const createHostel = async (database, input, actorId) =>
  database.transaction(async (transaction) => {
    const actor = await loadAuditActor(transaction, actorId);
    const [hostel] = await transaction
      .insert(hostels)
      .values({
        code: input.code.trim().toUpperCase(),
        name: input.name.trim(),
        residentType: input.residentType,
        address: normalizeAddress(input.address),
      })
      .returning(hostelSelection);

    await appendAuditEvent(transaction, {
      actor,
      category: AUDIT_CATEGORIES.HOSTEL,
      action: AUDIT_ACTIONS.HOSTEL_CREATED,
      resourceType: AUDIT_RESOURCE_TYPES.HOSTEL,
      resourceId: hostel.id,
      description: `Created hostel ${hostel.code}`,
      metadata: { residentType: hostel.residentType },
      assignedHostels: [hostel],
    });

    return Object.freeze(hostel);
  });

export const updateHostel = async (database, hostelId, input, actorId) =>
  database.transaction(async (transaction) => {
    const existing = await requireHostel(transaction, hostelId);
    const actor = await loadAuditActor(transaction, actorId);

    if (input.residentType && input.residentType !== existing.residentType) {
      const [resident] = await transaction
        .select({ id: studentProfiles.id })
        .from(studentProfiles)
        .where(eq(studentProfiles.hostelId, existing.id))
        .limit(1);

      if (resident) {
        throw new ApiError(
          409,
          "HOSTEL_TYPE_CHANGE_BLOCKED",
          "Move existing residents before changing the hostel type"
        );
      }
    }

    const changes = {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.residentType !== undefined
        ? { residentType: input.residentType }
        : {}),
      ...(input.address !== undefined
        ? { address: normalizeAddress(input.address) }
        : {}),
      updatedAt: new Date(),
    };
    const [hostel] = await transaction
      .update(hostels)
      .set(changes)
      .where(eq(hostels.id, existing.id))
      .returning(hostelSelection);

    await appendAuditEvent(transaction, {
      actor,
      category: AUDIT_CATEGORIES.HOSTEL,
      action: AUDIT_ACTIONS.HOSTEL_UPDATED,
      resourceType: AUDIT_RESOURCE_TYPES.HOSTEL,
      resourceId: hostel.id,
      description: `Updated hostel ${hostel.code}`,
      metadata: { before: existing, after: hostel },
      assignedHostels: [hostel],
    });

    return Object.freeze(hostel);
  });

export const setHostelStatus = async (
  database,
  hostelId,
  isActive,
  actorId
) =>
  database.transaction(async (transaction) => {
    const existing = await requireHostel(transaction, hostelId);
    const actor = await loadAuditActor(transaction, actorId);

    if (!isActive) {
      const [membership] = await transaction
        .select({ id: hostelMemberships.id })
        .from(hostelMemberships)
        .where(eq(hostelMemberships.hostelId, existing.id))
        .limit(1);

      if (membership) {
        throw new ApiError(
          409,
          "HOSTEL_DEACTIVATION_BLOCKED",
          "Remove active hostel memberships before deactivating this hostel"
        );
      }
    }

    if (existing.isActive === isActive) return Object.freeze(existing);

    const [hostel] = await transaction
      .update(hostels)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(hostels.id, existing.id))
      .returning(hostelSelection);

    await appendAuditEvent(transaction, {
      actor,
      category: AUDIT_CATEGORIES.HOSTEL,
      action: AUDIT_ACTIONS.HOSTEL_STATUS_CHANGED,
      resourceType: AUDIT_RESOURCE_TYPES.HOSTEL,
      resourceId: hostel.id,
      description: `${isActive ? "Activated" : "Deactivated"} hostel ${hostel.code}`,
      metadata: { isActive },
      assignedHostels: [hostel],
    });

    return Object.freeze(hostel);
  });
