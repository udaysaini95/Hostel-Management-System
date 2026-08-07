import express from "express";
import { 
  createMenu, 
  getTodayMenu, 
  createFeedback, 
  getAllFeedback, 
  createIssue, 
  getMyIssues, 
  getAllIssues, 
  updateStatus 
} from "../Controllers/messController.js";
import { protect, admin } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/admin/create", protect, admin, createMenu);
router.get("/today", protect, getTodayMenu);
router.post("/create", protect, createFeedback);
router.get("/admin", protect, admin, getAllFeedback);

// Mess Issue Routes
router.post("/issue/create", protect, createIssue);
router.get("/my", protect, getMyIssues);
router.get("/", protect, admin, getAllIssues);
router.put("/:id/status", protect, admin, updateStatus);

export default router;
