const mongoose = require("mongoose");

const messFeedbackSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  mealType: String,
  foodItem: String,
  rating: Number,
  date: Date,
});

module.exports = mongoose.model("MessFeedback", messFeedbackSchema);
