import { db } from "../db/index.js";
import {
  createHostel,
  listHostels,
  setHostelStatus,
  updateHostel,
} from "../services/hostelService.js";
import { handleControllerError } from "../utils/apiErrors.js";

export const getHostels = async (req, res) => {
  try {
    return res.json(await listHostels(db, req.query));
  } catch (error) {
    return handleControllerError(res, error, "List Hostels Error");
  }
};

export const postHostel = async (req, res) => {
  try {
    const hostel = await createHostel(db, req.body, req.user.id);
    return res.status(201).json({ message: "Hostel created", hostel });
  } catch (error) {
    return handleControllerError(res, error, "Create Hostel Error");
  }
};

export const patchHostel = async (req, res) => {
  try {
    const hostel = await updateHostel(db, req.params.id, req.body, req.user.id);
    return res.json({ message: "Hostel updated", hostel });
  } catch (error) {
    return handleControllerError(res, error, "Update Hostel Error");
  }
};

export const patchHostelStatus = async (req, res) => {
  try {
    const hostel = await setHostelStatus(
      db,
      req.params.id,
      req.body.isActive,
      req.user.id
    );
    return res.json({
      message: hostel.isActive ? "Hostel activated" : "Hostel deactivated",
      hostel,
    });
  } catch (error) {
    return handleControllerError(res, error, "Change Hostel Status Error");
  }
};
