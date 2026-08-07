import React, { useEffect, useState } from "react";
import api from "../api/axios";
import { 
  Utensils, 
  CheckCircle2, 
  AlertTriangle, 
  Coffee, 
  Sun, 
  Moon, 
  User
} from "lucide-react";

const MessAdmin = () => {
  const [breakfast, setBreakfast] = useState("Poha, Tea, Milk, Boiled Eggs");
  const [lunch, setLunch] = useState("Rajma, Rice, Chapati, Salad, Curd");
  const [dinner, setDinner] = useState("Paneer Butter Masala, Chapati, Rice, Gulab Jamun");
  const [menuSuccess, setMenuSuccess] = useState("");
  const [menuLoading, setMenuLoading] = useState(false);

  const [issues, setIssues] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);

  const fetchData = async () => {
    try {
      const [issuesRes, feedbacksRes] = await Promise.allSettled([
        api.get("/api/mess"),
        api.get("/api/mess/admin"),
      ]);

      if (issuesRes.status === "fulfilled") setIssues(issuesRes.value.data || []);
      if (feedbacksRes.status === "fulfilled") setFeedbacks(feedbacksRes.value.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleMenuSubmit = async (e) => {
    e.preventDefault();
    setMenuLoading(true);
    setMenuSuccess("");

    try {
      const breakfastArr = breakfast.split(",").map(s => s.trim());
      const lunchArr = lunch.split(",").map(s => s.trim());
      const dinnerArr = dinner.split(",").map(s => s.trim());

      await api.post("/api/mess/admin/create", {
        date: new Date().toISOString(),
        breakfast: breakfastArr,
        lunch: lunchArr,
        dinner: dinnerArr,
      });

      setMenuSuccess("Today's Mess Menu updated successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to update mess menu.");
    } finally {
      setMenuLoading(false);
    }
  };

  const handleIssueStatusChange = async (id, newStatus) => {
    try {
      await api.put(`/api/mess/${id}/status`, { status: newStatus });
      setIssues(issues.map(i => (i.id || i._id) === id ? { ...i, status: newStatus } : i));
    } catch (err) {
      alert("Failed to update mess issue status.");
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Header */}
      <div className="ui-panel p-6 rounded-2xl bg-white border-slate-200 shadow-xs">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Warden Mess Admin & Food Quality Control
        </h1>
        <p className="text-slate-500 text-xs mt-0.5">
          Publish daily menus, inspect student food ratings, and resolve mess complaints.
        </p>
      </div>

      {/* Menu Form */}
      <div className="ui-panel p-6 rounded-2xl bg-white border-slate-200 space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Utensils className="w-4 h-4 text-emerald-600" /> Daily Menu Manager
        </h2>

        {menuSuccess && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{menuSuccess}</span>
          </div>
        )}

        <form onSubmit={handleMenuSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Coffee className="w-3.5 h-3.5" /> Breakfast
              </label>
              <textarea
                rows={3}
                value={breakfast}
                onChange={(e) => setBreakfast(e.target.value)}
                className="w-full px-3 py-2 rounded-lg ui-input text-xs resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-cyan-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Sun className="w-3.5 h-3.5" /> Lunch
              </label>
              <textarea
                rows={3}
                value={lunch}
                onChange={(e) => setLunch(e.target.value)}
                className="w-full px-3 py-2 rounded-lg ui-input text-xs resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-indigo-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Moon className="w-3.5 h-3.5" /> Dinner
              </label>
              <textarea
                rows={3}
                value={dinner}
                onChange={(e) => setDinner(e.target.value)}
                className="w-full px-3 py-2 rounded-lg ui-input text-xs resize-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={menuLoading}
            className="py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition-colors flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Publish Mess Menu</span>
          </button>
        </form>
      </div>

      {/* Reported Issues */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 text-rose-600" />
          <span>Reported Mess Issues</span>
        </h2>

        {issues.length === 0 ? (
          <div className="ui-panel p-6 text-center text-slate-500 text-xs rounded-xl">
            No mess issues reported by students.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {issues.map((i) => {
              const issueId = i.id || i._id;
              return (
                <div key={issueId} className="ui-card p-4 rounded-xl bg-white border-slate-200 flex flex-col justify-between space-y-2">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" />
                        {i.studentName || "Student"}
                      </span>

                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                        i.status === "Resolved"
                          ? "badge-resolved"
                          : "badge-pending"
                      }`}>
                        {i.status}
                      </span>
                    </div>

                    <div className="text-xs font-bold text-amber-700">{i.issueType} ({i.mealType})</div>
                    <p className="text-slate-600 text-xs mt-0.5 leading-relaxed">{i.description}</p>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                    <span className="text-[11px] text-slate-500">Update Status:</span>
                    <select
                      value={i.status}
                      onChange={(e) => handleIssueStatusChange(issueId, e.target.value)}
                      className="px-2.5 py-1 rounded-lg ui-input text-xs"
                    >
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Resolved">Resolved</option>
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};

export default MessAdmin;
