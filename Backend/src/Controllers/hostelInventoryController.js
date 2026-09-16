import { db } from "../db/index.js";
import {
  createHostelRoom,
  getHostelInventory,
  setHostelRoomStatus,
  updateHostelRoom,
} from "../services/hostelInventoryService.js";
import { handleControllerError } from "../utils/apiErrors.js";

export const getInventory = async (req, res) => {
  try {
    return res.json(await getHostelInventory(db, req.params.id));
  } catch (error) {
    return handleControllerError(res, error, "List Hostel Inventory Error");
  }
};

export const postRoom = async (req, res) => {
  try {
    const room = await createHostelRoom(
      db,
      req.params.id,
      req.body,
      req.user.id
    );
    return res.status(201).json({ message: "Room created", room });
  } catch (error) {
    return handleControllerError(res, error, "Create Hostel Room Error");
  }
};

export const patchRoom = async (req, res) => {
  try {
    const room = await updateHostelRoom(
      db,
      req.params.id,
      req.params.roomId,
      req.body,
      req.user.id
    );
    return res.json({ message: "Room updated", room });
  } catch (error) {
    return handleControllerError(res, error, "Update Hostel Room Error");
  }
};

export const patchRoomStatus = async (req, res) => {
  try {
    const room = await setHostelRoomStatus(
      db,
      req.params.id,
      req.params.roomId,
      req.body.isActive,
      req.user.id
    );
    return res.json({ message: "Room status updated", room });
  } catch (error) {
    return handleControllerError(res, error, "Change Hostel Room Status Error");
  }
};
