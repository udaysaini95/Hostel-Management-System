import express from "express";
import { register, login, getProfile } from "../Controllers/authController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/authorizationMiddleware.js";
import { PERMISSIONS } from "../domain/permissions.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get(
  "/profile",
  protect,
  requirePermission(PERMISSIONS.PROFILE_READ_SELF),
  getProfile
);
router.get(
  "/me",
  protect,
  requirePermission(PERMISSIONS.PROFILE_READ_SELF),
  getProfile
);

export default router;
