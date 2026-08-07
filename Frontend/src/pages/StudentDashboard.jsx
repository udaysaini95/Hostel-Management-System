import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { 
  AlertCircle, 
  FileText, 
  Utensils, 
  Plus, 
  Clock, 
  CheckCircle2, 
  ArrowRight
} from "lucide-react";

const StudentDashboard = () => {
  const userStr = localStorage.getItem("user");
  let user = null;
  try {
    user = userStr ? JSON.parse(userStr) : null;
  } catch (e) {
    user = null;
  }

  const [complaints, setComplaints] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [todayMenu, setTodayMenu] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [complaintsRes, leavesRes, menuRes] = await Promise.allSettled([
          api.get("/api/complaints/my"),
          api.get("/api/leave/mine"),
          api.get("/api/mess/today"),
        ]);

        if (complaintsRes.status === "fulfilled") setComplaints(complaintsRes.value.data || []);
        if (leavesRes.status === "fulfilled") setLeaves(leavesRes.value.data || []);
        if (menuRes.status === "fulfilled") setTodayMenu(menuRes.value.data);
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const pendingComplaints = complaints.filter(c => c.status !== "Resolved").length;
  const approvedLeaves = leaves.filter(l => l.status === "Approved").length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Top Welcome Header */}
      <div className="ui-panel p-6 rounded-2xl bg-white border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Welcome back, {user?.name || "Student"}
          </h1>
          <p className="text-slate-600 text-xs mt-0.5">
            Student Hostel Portal • Track complaints, leaves, and mess menus
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/student/complaints/raise"
            className="py-2 px-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Raise Ticket</span>
          </Link>
          <Link
            to="/student/leaves/apply"
            className="py-2 px-3.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Apply Leave</span>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="ui-card p-4 rounded-xl bg-white border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Complaints</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
            {loading ? "-" : pendingComplaints}
          </div>
          <span className="text-[11px] text-amber-600 mt-0.5 block font-mono font-medium">
            {pendingComplaints > 0 ? `${pendingComplaints} unresolved` : "Zero pending"}
          </span>
        </div>

        <div className="ui-card p-4 rounded-xl bg-white border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Complaints</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
            {loading ? "-" : complaints.length}
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block font-mono">Lifetime tickets</span>
        </div>

        <div className="ui-card p-4 rounded-xl bg-white border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Approved Passes</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
            {loading ? "-" : approvedLeaves}
          </div>
          <span className="text-[11px] text-emerald-600 mt-0.5 block font-mono font-medium">Digital PDF outpasses</span>
        </div>

        <div className="ui-card p-4 rounded-xl bg-white border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Leave Applications</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
            {loading ? "-" : leaves.length}
          </div>
          <span className="text-[11px] text-indigo-600 mt-0.5 block font-mono font-medium">Gate pass requests</span>
        </div>

      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Complaints */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Recent Complaints</h2>
            <Link to="/student/complaints" className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {loading ? (
            <div className="ui-panel p-6 rounded-xl text-center text-slate-500 text-xs">
              Loading complaints...
            </div>
          ) : complaints.length === 0 ? (
            <div className="ui-panel p-6 rounded-xl text-center text-xs text-slate-500">
              No active complaints filed yet.
            </div>
          ) : (
            <div className="space-y-2.5">
              {complaints.slice(0, 4).map((c) => (
                <div key={c.id || c._id} className="ui-card p-3.5 rounded-xl bg-white border-slate-200 flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-slate-900">{c.type} — Room {c.room}</div>
                    <div className="text-[11px] text-slate-600 line-clamp-1">{c.description}</div>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                    c.status === "Resolved"
                      ? "badge-resolved"
                      : c.status === "In Progress"
                      ? "badge-pending"
                      : "badge-created"
                  }`}>
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mess Today Preview */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Today's Mess Schedule</h2>
            <Link to="/student/mess" className="text-xs font-semibold text-indigo-600 hover:underline">
              Rate Food
            </Link>
          </div>

          <div className="ui-panel p-4 rounded-xl bg-white border-slate-200 space-y-3">
            {todayMenu ? (
              <>
                <div>
                  <span className="text-[10px] font-mono font-bold text-amber-700 uppercase">Breakfast</span>
                  <p className="text-xs text-slate-800 font-medium mt-0.5">
                    {Array.isArray(todayMenu.breakfast) ? todayMenu.breakfast.join(", ") : todayMenu.breakfast}
                  </p>
                </div>
                <div className="border-t border-slate-100 pt-2">
                  <span className="text-[10px] font-mono font-bold text-cyan-700 uppercase">Lunch</span>
                  <p className="text-xs text-slate-800 font-medium mt-0.5">
                    {Array.isArray(todayMenu.lunch) ? todayMenu.lunch.join(", ") : todayMenu.lunch}
                  </p>
                </div>
                <div className="border-t border-slate-100 pt-2">
                  <span className="text-[10px] font-mono font-bold text-indigo-700 uppercase">Dinner</span>
                  <p className="text-xs text-slate-800 font-medium mt-0.5">
                    {Array.isArray(todayMenu.dinner) ? todayMenu.dinner.join(", ") : todayMenu.dinner}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-500 py-4 text-center">No menu uploaded for today yet.</p>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

export default StudentDashboard;
