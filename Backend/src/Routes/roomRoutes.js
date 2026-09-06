import express from "express";
import { listRooms } from "../Controllers/roomController.js";
import { PERMISSIONS } from "../domain/permissions.js";
import { protect } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/authorizationMiddleware.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import { roomInventoryRequestSchema } from "../validation/roomSchemas.js";

const router = express.Router();

router.get(
  "/",
  protect,
  requirePermission(PERMISSIONS.ROOM_INVENTORY_READ),
  validateRequest(roomInventoryRequestSchema),
  listRooms
);

export default router;
