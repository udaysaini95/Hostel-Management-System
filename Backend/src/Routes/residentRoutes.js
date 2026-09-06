import express from "express";
import { listResidents } from "../Controllers/residentController.js";
import { PERMISSIONS } from "../domain/permissions.js";
import { protect } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/authorizationMiddleware.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import { residentDirectoryRequestSchema } from "../validation/residentSchemas.js";

const router = express.Router();

router.get(
  "/",
  protect,
  requirePermission(PERMISSIONS.RESIDENT_DIRECTORY_READ),
  validateRequest(residentDirectoryRequestSchema),
  listResidents
);

export default router;
