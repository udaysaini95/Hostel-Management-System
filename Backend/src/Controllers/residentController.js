import { db } from "../db/index.js";
import { searchResidents } from "../services/residentDirectoryService.js";
import { handleControllerError } from "../utils/apiErrors.js";

export const listResidents = async (req, res) => {
  try {
    const result = await searchResidents(db, req.user, req.query);
    return res.json(result);
  } catch (error) {
    return handleControllerError(res, error, "List Residents Error");
  }
};
