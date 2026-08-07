import express from "express";
import { applyLeave, myLeaves, getAllLeaves, approveLeave, rejectLeave } from "../Controllers/leaveController.js";
import { protect, admin } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/apply", protect, applyLeave);
router.get("/mine", protect, myLeaves);
router.get("/admin/all", protect, admin, getAllLeaves);
router.put("/admin/approve/:id", protect, admin, approveLeave);
router.put("/admin/reject/:id", protect, admin, rejectLeave);

export default router;
