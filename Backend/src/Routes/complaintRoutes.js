import express from "express";
import { 
  createComplaint, 
  myComplaints, 
  deleteComplaint, 
  allComplaints, 
  updateStatus
} from "../Controllers/complaintController.js";
import { protect, admin } from "../middlewares/authMiddleware.js";
import upload from "../middlewares/upload.js";

const router = express.Router();

// ================= STUDENT ROUTES =================
router.post("/create", protect, upload.single("image"), createComplaint);
router.get("/my", protect, myComplaints);
router.delete("/:id", protect, deleteComplaint);

// ================= ADMIN ROUTE ================
router.get("/admin/complaints", protect, admin, allComplaints);
router.put("/status/:id", protect, admin, updateStatus);

export default router;
