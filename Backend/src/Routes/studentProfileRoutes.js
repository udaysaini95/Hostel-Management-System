import express from "express";
import {
  getMyStudentProfile,
  updateMyStudentProfile,
} from "../Controllers/studentProfileController.js";
import { PERMISSIONS } from "../domain/permissions.js";
import { protect } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/authorizationMiddleware.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import {
  studentProfileReadRequestSchema,
  studentProfileUpdateRequestSchema,
} from "../validation/studentProfileSchemas.js";

const router = express.Router();

router.get(
  "/",
  protect,
  requirePermission(PERMISSIONS.STUDENT_PROFILE_READ_SELF),
  validateRequest(studentProfileReadRequestSchema),
  getMyStudentProfile
);

router.patch(
  "/",
  protect,
  requirePermission(PERMISSIONS.STUDENT_PROFILE_UPDATE_SELF),
  validateRequest(studentProfileUpdateRequestSchema),
  updateMyStudentProfile
);

export default router;
