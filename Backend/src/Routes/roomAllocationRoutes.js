import express from "express";
import {
  createRoomAllocation,
  transferAllocation,
  vacateAllocation,
} from "../Controllers/roomController.js";
import { PERMISSIONS } from "../domain/permissions.js";
import { protect } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/authorizationMiddleware.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import {
  createRoomAllocationRequestSchema,
  transferRoomAllocationRequestSchema,
  vacateRoomAllocationRequestSchema,
} from "../validation/roomSchemas.js";

const router = express.Router();
const canManageAllocations = requirePermission(
  PERMISSIONS.ROOM_ALLOCATION_MANAGE
);

router.post(
  "/",
  protect,
  canManageAllocations,
  validateRequest(createRoomAllocationRequestSchema),
  createRoomAllocation
);

router.patch(
  "/:id/vacate",
  protect,
  canManageAllocations,
  validateRequest(vacateRoomAllocationRequestSchema),
  vacateAllocation
);

router.post(
  "/:id/transfer",
  protect,
  canManageAllocations,
  validateRequest(transferRoomAllocationRequestSchema),
  transferAllocation
);

export default router;
