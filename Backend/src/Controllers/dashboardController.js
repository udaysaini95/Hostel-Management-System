import { db } from "../db/index.js";
import { getDashboardSummary } from "../services/dashboardService.js";
import { handleControllerError } from "../utils/apiErrors.js";

export const getDashboard = async (req, res) => {
  try {
    return res.json(await getDashboardSummary(db, req.user));
  } catch (error) {
    return handleControllerError(res, error, "Dashboard Summary Error");
  }
};
