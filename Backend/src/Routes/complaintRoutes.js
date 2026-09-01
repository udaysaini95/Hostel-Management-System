import express from "express";
import { 
  createComplaint, 
  myComplaints, 
  deleteComplaint, 
  allComplaints, 
  updateStatus,
  studentVerifyComplaint
} from "../Controllers/complaintController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/authorizationMiddleware.js";
import { PERMISSIONS } from "../domain/permissions.js";
import upload from "../middlewares/upload.js";

const router = express.Router();

// ================= STUDENT ROUTES =================
router.post(
  "/create",
  protect,
  requirePermission(PERMISSIONS.COMPLAINT_CREATE),
  upload.single("image"),
  createComplaint
);
router.get(
  "/my",
  protect,
  requirePermission(PERMISSIONS.COMPLAINT_READ_OWN),
  myComplaints
);
router.delete(
  "/:id",
  protect,
  requirePermission(PERMISSIONS.COMPLAINT_DELETE_OWN),
  deleteComplaint
);
router.put(
  "/verify/:id",
  protect,
  requirePermission(PERMISSIONS.COMPLAINT_VERIFY_OWN),
  studentVerifyComplaint
);

// ================= ADMIN ROUTE ================
router.get(
  "/admin/complaints",
  protect,
  requirePermission(PERMISSIONS.COMPLAINT_READ_MANAGED),
  allComplaints
);
router.put(
  "/status/:id",
  protect,
  requirePermission(PERMISSIONS.COMPLAINT_UPDATE_MANAGED),
  updateStatus
);

export default router;
