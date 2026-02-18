const Menu = require("../model/Menu")
const MessFeedback = require("../model/MessFeedback")
const MessIssue = require("../model/MessIssue")

// ================= CREATE / UPDATE MENU =================
exports.createMenu = async (req, res) => {
  try {

    const { date, breakfast, lunch, dinner } = req.body

    const existing = await Menu.findOne({ date })

    if (existing) {
      existing.breakfast = breakfast
      existing.lunch = lunch
      existing.dinner = dinner
      await existing.save()

      return res.json({ message: "Menu Updated" })
    }

    await Menu.create({ date, breakfast, lunch, dinner })

    res.json({ message: "Menu Created" })

  } catch (err) {
    console.log(err)
    res.status(500).json({ message: "Menu save failed" })
  }
}

// ================= GET TODAY MENU =================
exports.getTodayMenu = async (req, res) => {
  try {

    const start = new Date()
    start.setHours(0, 0, 0, 0)

    const end = new Date()
    end.setHours(23, 59, 59, 999)

    const menu = await Menu.findOne({
      date: { $gte: start, $lte: end }
    })

    if (!menu) return res.status(404).json({ message: "No menu today" })

    res.json(menu)

  } catch (err) {
    res.status(500).json({ message: "Server error" })
  }
}

exports.createFeedback = async (req, res) => {
  try {

    const feedback = await MessFeedback.create({
      user: req.user.id,
      rating: req.body.rating,
      comment: req.body.comment
    })

    res.json({ message: "Feedback Saved", feedback })

  } catch (error) {
    console.log(error)
    res.status(500).json({ message: "Feedback failed" })
  }
}


// ================= GET ALL FEEDBACK (ADMIN) =================
exports.getAllFeedback = async (req, res) => {
  try {

    const feedbacks = await MessFeedback.find()
      .populate("user", "name email")
      .sort({ date: -1 })

    res.json(feedbacks)

  } catch (error) {
    res.status(500).json({ message: "Failed to load feedback" })
  }
}

exports.createIssue = async (req, res) => {
  try {
    const issue = await MessIssue.create({
      student: req.user.id,
      studentName: req.user.name || "Anonymous",
      issueType: req.body.issueType,
      mealType: req.body.mealType,
      description: req.body.description,
      status: "Pending"
    })

    res.status(201).json(issue)
  } catch (err) {
    res.status(500).json({ message: "Failed to create issue" })
  }
}

exports.getMyIssues = async (req, res) => {
  try {
    const issues = await MessIssue.find({
      student: req.user.id
    }).sort({ createdAt: -1 })

    res.json(issues)
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch issues" })
  }
}

exports.getAllIssues = async (req, res) => {
  try {
    const issues = await MessIssue.find()
      .sort({ createdAt: -1 })

    res.json(issues)
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch issues" })
  }
}

exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body

    if (!["Pending", "In Progress", "Resolved"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" })
    }

    const updated = await MessIssue.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    )

    if (!updated) {
      return res.status(404).json({ message: "Issue not found" })
    }

    res.json(updated)
  } catch (err) {
    res.status(500).json({ message: "Failed to update status" })
  }
}
