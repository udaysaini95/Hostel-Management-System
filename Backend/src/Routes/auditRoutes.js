import express from "express";
import { listAuditEvents } from "../Controllers/auditController.js";
import { PERMISSIONS } from "../domain/permissions.js";
import { protect } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/authorizationMiddleware.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import { auditEventQuerySchema } from "../validation/auditSchemas.js";

const router = express.Router();

router.get(
  "/",
  protect,
  requirePermission(PERMISSIONS.AUDIT_READ),
  validateRequest(auditEventQuerySchema),
  listAuditEvents
);

export default router;
