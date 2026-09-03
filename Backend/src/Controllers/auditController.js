import { db } from "../db/index.js";
import { searchAuditEvents } from "../services/auditEventService.js";
import { handleControllerError } from "../utils/apiErrors.js";

export const listAuditEvents = async (req, res) => {
  try {
    const result = await searchAuditEvents(db, req.user, req.query);
    return res.json(result);
  } catch (error) {
    return handleControllerError(res, error, "List Audit Events Error");
  }
};
