import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { 
  ShieldCheck, 
  AlertCircle, 
  FileText, 
  Utensils, 
  ArrowRight,
  CheckCircle2
} from "lucide-react";

const AdminDashboard = () => {
  const userStr = localStorage.getItem("user");
  let user = null;
  try {
    user = userStr ? JSON.parse(userStr) : null;
  } catch (e) {
    user = null;
  }

  const [complaints, setComplaints] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [complaintsRes, leavesRes, feedbacksRes] = await Promise.allSettled([
          api.get("/api/complaints/admin/complaints"),
          api.get("/api/leave/admin/all"),
          api.get("/api/mess/admin"),
        ]);

        if (complaintsRes.status === "fulfilled") setComplaints(complaintsRes.value.data || []);
        if (leavesRes.status === "fulfilled") setLeaves(leavesRes.value.data || []);
        if (feedbacksRes.status === "fulfilled") setFeedbacks(feedbacksRes.value.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const pendingComplaints = complaints.filter(c => c.status !== "Resolved").length;
  const pendingLeaves = leaves.filter(l => l.status === "Pending").length;
  const avgFeedbackRating = feedbacks.length > 0
    ? (feedbacks.reduce((acc, curr) => acc + (curr.rating || 0), 0) / feedbacks.length).toFixed(1)
    : "4.5";

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Banner */}
      <div className="ui-panel p-6 rounded-2xl bg-white border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[11px] font-mono text-emerald-800 mb-1">
            Warden Console
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Hostel Admin Overview
          </h1>
          <p className="text-slate-600 text-xs mt-0.5">
            Logged in as <strong className="text-slate-900">{user?.name || "Warden"}</strong>
          </p>
        </div>

        <Link
          to="/admin/leaves"
          className="py-2 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Review Leave Queue ({pendingLeaves})</span>
        </Link>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="ui-card p-4 rounded-xl bg-white border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Open Tickets</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
            {loading ? "-" : pendingComplaints}
          </div>
          <span className="text-[11px] text-amber-700 mt-0.5 block font-mono font-medium">Unresolved issues</span>
        </div>

        <div className="ui-card p-4 rounded-xl bg-white border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Leaves</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
            {loading ? "-" : pendingLeaves}
          </div>
          <span className="text-[11px] text-indigo-700 mt-0.5 block font-mono font-medium">Awaiting approval</span>
        </div>

        <div className="ui-card p-4 rounded-xl bg-white border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Complaints</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
            {loading ? "-" : complaints.length}
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block font-mono">All logged tickets</span>
        </div>

        <div className="ui-card p-4 rounded-xl bg-white border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Mess Rating Score</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
            {loading ? "-" : `${avgFeedbackRating} ★`}
          </div>
          <span className="text-[11px] text-emerald-700 mt-0.5 block font-mono font-medium">Average score</span>
        </div>

      </div>

      {/* Admin Shortcuts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        <Link
          to="/admin/complaints"
          className="ui-card p-5 rounded-xl bg-white border-slate-200 hover:border-amber-300 group space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Complaints</span>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-700 transition-colors" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Manage Complaints Queue</h3>
          <p className="text-slate-600 text-xs leading-relaxed">
            Review student tickets, inspect photo attachments, and update status.
          </p>
        </Link>

        <Link
          to="/admin/leaves"
          className="ui-card p-5 rounded-xl bg-white border-slate-200 hover:border-indigo-300 group space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Outpasses</span>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-700 transition-colors" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Approve Outpass Passes</h3>
          <p className="text-slate-600 text-xs leading-relaxed">
            Issue digital warden signatures and generate downloadable PDF passes.
          </p>
        </Link>

        <Link
          to="/admin/mess"
          className="ui-card p-5 rounded-xl bg-white border-slate-200 hover:border-emerald-300 group space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Mess Admin</span>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-700 transition-colors" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Mess Menu & Feedback</h3>
          <p className="text-slate-600 text-xs leading-relaxed">
            Publish daily menus for Breakfast, Lunch, and Dinner.
          </p>
        </Link>

      </div>

    </div>
  );
};

export default AdminDashboard;
