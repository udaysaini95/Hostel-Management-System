const mongoose = require("mongoose")

const messIssueSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    studentName: { type: String, required: true },
    issueType: String,
    mealType: String,
    description: String,
    image: String,
    status: {
        type: String,
        default: "Pending"
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
})

module.exports = mongoose.model("MessIssue", messIssueSchema)
