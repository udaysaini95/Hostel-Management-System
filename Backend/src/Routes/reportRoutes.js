import express from "express";
import {
  getComplaintReport,
  getGateReport,
  getLeaveReport,
  getMessReport,
} from "../Controllers/reportController.js";
import { PERMISSIONS } from "../domain/permissions.js";
import { protect } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/authorizationMiddleware.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import {
  complaintReportRequestSchema,
  gateReportRequestSchema,
  leaveReportRequestSchema,
  messReportRequestSchema,
} from "../validation/reportSchemas.js";

const router = express.Router();

const reportRoute = (path, schema, controller) => {
  router.get(
    path,
    protect,
    requirePermission(PERMISSIONS.REPORT_READ),
    validateRequest(schema),
    controller
  );
};

reportRoute("/complaints", complaintReportRequestSchema, getComplaintReport);
reportRoute("/leaves", leaveReportRequestSchema, getLeaveReport);
reportRoute("/gate", gateReportRequestSchema, getGateReport);
reportRoute("/mess", messReportRequestSchema, getMessReport);

export default router;
