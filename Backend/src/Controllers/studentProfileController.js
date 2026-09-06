import { db } from "../db/index.js";
import {
  getOwnStudentProfile,
  updateOwnStudentProfile,
} from "../services/studentProfileService.js";
import { handleControllerError } from "../utils/apiErrors.js";

export const getMyStudentProfile = async (req, res) => {
  try {
    const profile = await getOwnStudentProfile(db, req.user.id);
    return res.json({ profile });
  } catch (error) {
    return handleControllerError(res, error, "Get Student Profile Error");
  }
};

export const updateMyStudentProfile = async (req, res) => {
  try {
    const profile = await updateOwnStudentProfile(
      db,
      req.user.id,
      req.body
    );
    return res.json({ profile });
  } catch (error) {
    return handleControllerError(res, error, "Update Student Profile Error");
  }
};
