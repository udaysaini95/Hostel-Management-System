import React, { useEffect, useState } from "react";
import api from "../api/axios";
import { getApiErrorMessage } from "../api/errors.js";
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
} from "../components/ui/index.js";
import { useToast } from "../feedback/toastContext.js";
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
  const [menuLoading, setMenuLoading] = useState(false);

  const [issues, setIssues] = useState([]);
  const [issuesLoading, setIssuesLoading] = useState(true);
  const [issuesError, setIssuesError] = useState("");
  const [updatingIssueId, setUpdatingIssueId] = useState(null);
  const { showToast } = useToast();

  const fetchData = async () => {
    try {
      setIssuesLoading(true);
      setIssuesError("");
      const response = await api.get("/api/mess");
      setIssues(response.data || []);
    } catch (err) {
      setIssuesError(
        getApiErrorMessage(err, "Reported mess issues could not be loaded.")
      );
    } finally {
      setIssuesLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleMenuSubmit = async (e) => {
    e.preventDefault();
    setMenuLoading(true);

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

      showToast({
        tone: "success",
        title: "Mess menu published",
        message: "Students can now view today's breakfast, lunch, and dinner.",
      });
    } catch (err) {
      showToast({
        tone: "danger",
        title: "Mess menu was not published",
        message: getApiErrorMessage(err, "Try again in a moment."),
      });
    } finally {
      setMenuLoading(false);
    }
  };

  const handleIssueStatusChange = async (id, newStatus) => {
    try {
      setUpdatingIssueId(id);
      await api.put(`/api/mess/${id}/status`, { status: newStatus });
      setIssues((currentIssues) =>
        currentIssues.map((issue) =>
          (issue.id || issue._id) === id
            ? { ...issue, status: newStatus }
            : issue
        )
      );
      showToast({
        tone: "success",
        title: "Mess issue updated",
        message: `The issue is now ${newStatus.toLowerCase()}.`,
      });
    } catch (err) {
      showToast({
        tone: "danger",
        title: "Mess issue was not updated",
        message: getApiErrorMessage(err, "Try again in a moment."),
      });
    } finally {
      setUpdatingIssueId(null);
    }
  };

  return (
    <div className="hm-page-stack hm-page-stack--medium">
      
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

          <Button
            type="submit"
            variant="primary"
            loading={menuLoading}
            loadingLabel="Publishing menu"
            leadingIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
          >
            Publish mess menu
          </Button>
        </form>
      </div>

      {/* Reported Issues */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 text-rose-600" />
          <span>Reported Mess Issues</span>
        </h2>

        {issuesLoading ? (
          <LoadingState label="Loading reported mess issues" rows={3} compact />
        ) : issuesError ? (
          <ErrorState
            title="Mess issues are unavailable"
            description={issuesError}
            onRetry={fetchData}
          />
        ) : issues.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title="No reported mess issues"
            description="Student food-quality reports will appear here for review."
          />
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
                      disabled={updatingIssueId === issueId}
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
