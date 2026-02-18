const router = require("express").Router()
const { createMenu, getTodayMenu, createFeedback, getAllFeedback, createIssue, getMyIssues, getAllIssues, updateStatus } = require("../Controllers/messController")
const { protect, admin } = require("../middlewares/authMiddleware")

router.post("/admin/create", protect, admin, createMenu)
router.get("/today", protect, getTodayMenu)
router.post("/create", protect, createFeedback)
router.get("/admin", protect, admin, getAllFeedback)

// Mess Issue Routes
router.post("/issue/create", protect, createIssue)
router.get("/my", protect, getMyIssues)
router.get("/", protect, admin, getAllIssues)
router.put("/:id/status", protect, admin, updateStatus)

module.exports = router
