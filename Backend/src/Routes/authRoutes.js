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
import { validateRequest } from "../middlewares/validateRequest.js";
import {
  loginRequestSchema,
  staffInvitationAcceptanceSchema,
  studentActivationCompletionSchema,
  studentActivationRequestSchema,
} from "../validation/authSchemas.js";
import {
  activationRequestRateLimiter,
  credentialSetupRateLimiter,
  loginRateLimiter,
} from "../middlewares/authRateLimiters.js";

const router = express.Router();

router.post("/register", register);
router.post(
  "/login",
  loginRateLimiter,
  validateRequest(loginRequestSchema),
  login
);
router.post(
  "/staff-invitations/accept",
  credentialSetupRateLimiter,
  validateRequest(staffInvitationAcceptanceSchema),
  acceptStaffInvitationRequest
);
router.post(
  "/student-activation/request",
  activationRequestRateLimiter,
  validateRequest(studentActivationRequestSchema),
  requestActivation
);
router.post(
  "/student-activation/complete",
  credentialSetupRateLimiter,
  validateRequest(studentActivationCompletionSchema),
  completeActivation
);
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
