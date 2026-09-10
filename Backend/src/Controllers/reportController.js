import { db } from "../db/index.js";
import { REPORT_TYPES } from "../domain/reports.js";
import { getOperationalReport } from "../services/reportService.js";
import { handleControllerError } from "../utils/apiErrors.js";

const reportHandler = (type, operation) => async (req, res) => {
  try {
    const report = await getOperationalReport(db, req.user, type, req.query);
    return res.json(report);
  } catch (error) {
    return handleControllerError(res, error, operation);
  }
};

export const getComplaintReport = reportHandler(
  REPORT_TYPES.COMPLAINTS,
  "Complaint Report Error"
);
export const getLeaveReport = reportHandler(
  REPORT_TYPES.LEAVES,
  "Leave Report Error"
);
export const getGateReport = reportHandler(
  REPORT_TYPES.GATE,
  "Gate Report Error"
);
export const getMessReport = reportHandler(
  REPORT_TYPES.MESS,
  "Mess Report Error"
);
