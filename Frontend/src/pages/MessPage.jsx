import React, { useEffect, useState } from "react";
import api from "../api/axios";
import { Utensils, Star, AlertTriangle, CheckCircle2, Coffee, Sun, Moon } from "lucide-react";

const MessPage = () => {
  const [todayMenu, setTodayMenu] = useState(null);
  const [rating, setRating] = useState(5);
  const [mealType, setMealType] = useState("Breakfast");
  const [foodItem, setFoodItem] = useState("");
  const [issueType, setIssueType] = useState("Food Quality");
  const [issueDescription, setIssueDescription] = useState("");
  const [myIssues, setMyIssues] = useState([]);
  
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState("");
  const [issueLoading, setIssueLoading] = useState(false);
  const [issueSuccess, setIssueSuccess] = useState("");

  const fetchData = async () => {
    try {
      const [menuRes, issuesRes] = await Promise.allSettled([
        api.get("/api/mess/today"),
        api.get("/api/mess/my"),
      ]);

      if (menuRes.status === "fulfilled") setTodayMenu(menuRes.value.data);
      if (issuesRes.status === "fulfilled") setMyIssues(issuesRes.value.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    setFeedbackLoading(true);
    setFeedbackSuccess("");

    try {
      await api.post("/api/mess/create", {
        rating,
        mealType,
        foodItem: foodItem || mealType,
      });

      setFeedbackSuccess("Rating feedback submitted!");
      setFoodItem("");
    } catch (err) {
      console.error(err);
    } finally {
      setFeedbackLoading(false);
    }
  };

  const handleIssueSubmit = async (e) => {
    e.preventDefault();
    if (!issueDescription) return;

    setIssueLoading(true);
    setIssueSuccess("");

    try {
      const res = await api.post("/api/mess/issue/create", {
        issueType,
        mealType,
        description: issueDescription,
      });

      setIssueSuccess("Mess issue reported.");
      setIssueDescription("");
      setMyIssues([res.data, ...myIssues]);
    } catch (err) {
      console.error(err);
    } finally {
      setIssueLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Header */}
      <div className="ui-panel p-6 rounded-2xl bg-white border-slate-200 shadow-xs">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Mess Menu & Quality Feedback
        </h1>
        <p className="text-slate-500 text-xs mt-0.5">
          View today's meal schedule, rate food quality, or report mess issues.
        </p>
      </div>

      {/* Menu Cards */}
      <div>
        <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-1.5">
          <Utensils className="w-4 h-4 text-emerald-600" />
          <span>Today's Menu</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          <div className="ui-card p-4 rounded-xl bg-white border-slate-200 space-y-1.5">
            <div className="flex items-center gap-1.5 text-amber-700 font-bold text-xs uppercase tracking-wider">
              <Coffee className="w-3.5 h-3.5" />
              <span>Breakfast (8:00 AM)</span>
            </div>
            <p className="text-slate-800 text-xs font-medium leading-relaxed">
              {todayMenu
                ? Array.isArray(todayMenu.breakfast) ? todayMenu.breakfast.join(", ") : todayMenu.breakfast
                : "Poha, Tea / Coffee, Boiled Eggs / Milk"}
            </p>
          </div>

          <div className="ui-card p-4 rounded-xl bg-white border-slate-200 space-y-1.5">
            <div className="flex items-center gap-1.5 text-cyan-700 font-bold text-xs uppercase tracking-wider">
              <Sun className="w-3.5 h-3.5" />
              <span>Lunch (12:30 PM)</span>
            </div>
            <p className="text-slate-800 text-xs font-medium leading-relaxed">
              {todayMenu
                ? Array.isArray(todayMenu.lunch) ? todayMenu.lunch.join(", ") : todayMenu.lunch
                : "Rajma Chawal, Chapati, Curd, Salad"}
            </p>
          </div>

          <div className="ui-card p-4 rounded-xl bg-white border-slate-200 space-y-1.5">
            <div className="flex items-center gap-1.5 text-indigo-700 font-bold text-xs uppercase tracking-wider">
              <Moon className="w-3.5 h-3.5" />
              <span>Dinner (8:00 PM)</span>
            </div>
            <p className="text-slate-800 text-xs font-medium leading-relaxed">
              {todayMenu
                ? Array.isArray(todayMenu.dinner) ? todayMenu.dinner.join(", ") : todayMenu.dinner
                : "Paneer Butter Masala, Jeera Rice, Chapati, Gulab Jamun"}
            </p>
          </div>

        </div>
      </div>

      {/* Forms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Rate Form */}
        <div className="ui-panel p-6 rounded-2xl bg-white border-slate-200 space-y-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" /> Rate Today's Meal
          </h3>

          {feedbackSuccess && (
            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{feedbackSuccess}</span>
            </div>
          )}

          <form onSubmit={handleFeedbackSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Meal Type</label>
              <select
                value={mealType}
                onChange={(e) => setMealType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg ui-input text-xs"
              >
                <option value="Breakfast">Breakfast</option>
                <option value="Lunch">Lunch</option>
                <option value="Dinner">Dinner</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Rating</label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="p-1 focus:outline-none"
                  >
                    <Star className={`w-6 h-6 ${star <= rating ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={feedbackLoading}
              className="w-full py-2 px-4 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition-colors"
            >
              Submit Rating
            </button>
          </form>
        </div>

        {/* Issue Reporter */}
        <div className="ui-panel p-6 rounded-2xl bg-white border-slate-200 space-y-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600" /> Report Mess Issue
          </h3>

          {issueSuccess && (
            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{issueSuccess}</span>
            </div>
          )}

          <form onSubmit={handleIssueSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Issue Type</label>
              <select
                value={issueType}
                onChange={(e) => setIssueType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg ui-input text-xs"
              >
                <option value="Food Quality">Food Quality / Taste</option>
                <option value="Hygiene">Hygiene / Cleanliness</option>
                <option value="Quantity">Quantity Shortage</option>
                <option value="Staff Behavior">Staff Behavior</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
              <textarea
                required
                rows={3}
                placeholder="Explain the mess issue..."
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-lg ui-input text-xs resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={issueLoading}
              className="w-full py-2 px-4 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors"
            >
              Report Issue
            </button>
          </form>
        </div>

      </div>

    </div>
  );
};

export default MessPage;
