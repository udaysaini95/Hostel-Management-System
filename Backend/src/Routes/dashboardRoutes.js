import express from "express";
import { getDashboard } from "../Controllers/dashboardController.js";
import { PERMISSIONS } from "../domain/permissions.js";
import { protect } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/authorizationMiddleware.js";

const router = express.Router();

router.get(
  "/",
  protect,
  requirePermission(PERMISSIONS.DASHBOARD_READ),
  getDashboard
);

export default router;
