import { db } from "../db/index.js";
import {
  allocateRoom,
  listRoomInventory,
  vacateRoomAllocation,
} from "../services/roomAllocationService.js";
import { handleControllerError } from "../utils/apiErrors.js";

export const listRooms = async (req, res) => {
  try {
    const result = await listRoomInventory(db, req.user, req.query);
    return res.json(result);
  } catch (error) {
    return handleControllerError(res, error, "List Rooms Error");
  }
};

export const createRoomAllocation = async (req, res) => {
  try {
    const result = await allocateRoom(db, req.user, req.body);
    return res.status(201).json(result);
  } catch (error) {
    return handleControllerError(res, error, "Create Room Allocation Error");
  }
};

export const vacateAllocation = async (req, res) => {
  try {
    const result = await vacateRoomAllocation(
      db,
      req.user,
      req.params.id,
      req.body
    );
    return res.json(result);
  } catch (error) {
    return handleControllerError(res, error, "Vacate Room Allocation Error");
  }
};
