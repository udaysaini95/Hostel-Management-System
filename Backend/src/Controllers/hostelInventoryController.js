import { db } from "../db/index.js";
import {
  createHostelBlock,
  createHostelRoom,
  getHostelInventory,
  setHostelBlockStatus,
  setHostelRoomStatus,
  updateHostelBlock,
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

export const postBlock = async (req, res) => {
  try {
    const block = await createHostelBlock(
      db,
      req.params.id,
      req.body,
      req.user.id
    );
    return res.status(201).json({ message: "Block created", block });
  } catch (error) {
    return handleControllerError(res, error, "Create Hostel Block Error");
  }
};

export const patchBlock = async (req, res) => {
  try {
    const block = await updateHostelBlock(
      db,
      req.params.id,
      req.params.blockId,
      req.body,
      req.user.id
    );
    return res.json({ message: "Block updated", block });
  } catch (error) {
    return handleControllerError(res, error, "Update Hostel Block Error");
  }
};

export const patchBlockStatus = async (req, res) => {
  try {
    const block = await setHostelBlockStatus(
      db,
      req.params.id,
      req.params.blockId,
      req.body.isActive,
      req.user.id
    );
    return res.json({ message: "Block status updated", block });
  } catch (error) {
    return handleControllerError(res, error, "Change Hostel Block Status Error");
  }
};

export const postRoom = async (req, res) => {
  try {
    const room = await createHostelRoom(
      db,
      req.params.id,
      req.params.blockId,
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
