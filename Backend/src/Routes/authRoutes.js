import express from "express";
import { register, login, getProfile } from "../Controllers/authController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/authorizationMiddleware.js";
import { PERMISSIONS } from "../domain/permissions.js";
import { acceptStaffInvitationRequest } from "../Controllers/staffAccountController.js";
import {
  completeActivation,
  requestActivation,
} from "../Controllers/studentActivationController.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/staff-invitations/accept", acceptStaffInvitationRequest);
router.post("/student-activation/request", requestActivation);
router.post("/student-activation/complete", completeActivation);
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
