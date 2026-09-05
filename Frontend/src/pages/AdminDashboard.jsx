import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { 
  ShieldCheck, 
  AlertCircle, 
  FileText, 
  Utensils, 
  ArrowRight,
  CheckCircle2,
  Users,
  QrCode
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
  const [outsideStudents, setOutsideStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [complaintsRes, leavesRes, feedbacksRes, outsideRes] = await Promise.allSettled([
          api.get("/api/complaints/admin/complaints"),
          api.get("/api/leave/admin/all"),
          api.get("/api/mess/admin"),
          api.get("/api/gate/active-outside"),
        ]);

        if (complaintsRes.status === "fulfilled") setComplaints(complaintsRes.value.data || []);
        if (leavesRes.status === "fulfilled") setLeaves(leavesRes.value.data || []);
        if (feedbacksRes.status === "fulfilled") setFeedbacks(feedbacksRes.value.data || []);
        if (outsideRes.status === "fulfilled") setOutsideStudents(outsideRes.value.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const pendingComplaints = complaints.filter(c => c.status !== "Resolved" && c.status !== "Closed").length;
  
  const slaBreachedComplaints = complaints.filter(c => {
    if (!c.slaDeadline || c.status === "Resolved" || c.status === "Closed") return false;
    return new Date(c.slaDeadline) < new Date();
  }).length;

  const pendingLeaves = leaves.filter(l => l.status === "Pending").length;
  const avgFeedbackRating = feedbacks.length > 0
    ? (feedbacks.reduce((acc, curr) => acc + (curr.rating || 0), 0) / feedbacks.length).toFixed(1)
    : "4.5";

  return (
    <div className="hm-page-stack hm-page-stack--wide">
      
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

        <div className="flex items-center gap-2">
          <Link
            to="/guard/terminal"
            className="py-2 px-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Gate Terminal</span>
          </Link>
          <Link
            to="/admin/leaves"
            className="py-2 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Leaves Queue ({pendingLeaves})</span>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="ui-card p-4 rounded-xl bg-white border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Outside Campus</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
            {loading ? "-" : outsideStudents.length}
          </div>
          <span className="text-[11px] text-amber-700 mt-0.5 block font-mono font-medium">Currently on leave</span>
        </div>

        <div className="ui-card p-4 rounded-xl bg-white border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Passes</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
            {loading ? "-" : pendingLeaves}
          </div>
          <span className="text-[11px] text-indigo-700 mt-0.5 block font-mono font-medium">Awaiting approval</span>
        </div>

        <div className="ui-card p-4 rounded-xl bg-white border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Open Complaints</div>
          <div className="flex items-end gap-2 mt-1">
            <div className="text-2xl font-bold text-slate-900 font-mono">
              {loading ? "-" : pendingComplaints}
            </div>
            {slaBreachedComplaints > 0 && (
              <span className="text-xs font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 mb-1 animate-pulse">
                {slaBreachedComplaints} Breached
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block font-mono">Unresolved tickets</span>
        </div>

        <div className="ui-card p-4 rounded-xl bg-white border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Mess Rating Score</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
            {loading ? "-" : `${avgFeedbackRating} ★`}
          </div>
          <span className="text-[11px] text-emerald-700 mt-0.5 block font-mono font-medium">Average score</span>
        </div>

      </div>

      {/* Real-time Outside Campus Roster */}
      <div className="ui-panel p-6 rounded-2xl bg-white border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-600" />
            <span>Live Gate Roster — Students Outside Campus ({outsideStudents.length})</span>
          </h2>
          <Link to="/guard/terminal" className="text-xs font-semibold text-indigo-600 hover:underline">
            Open Terminal ➔
          </Link>
        </div>

        {outsideStudents.length === 0 ? (
          <div className="p-4 rounded-xl bg-slate-50 text-center text-xs text-slate-500 border border-slate-100">
            No students are currently outside campus. All hostel residents are accounted for.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                <tr>
                  <th className="py-2">Student Name</th>
                  <th className="py-2">Roll No</th>
                  <th className="py-2">Room</th>
                  <th className="py-2">Pass Code</th>
                  <th className="py-2">Exited At</th>
                  <th className="py-2">Valid Until</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {outsideStudents.map((s) => (
                  <tr key={s.leaveId}>
                    <td className="py-2.5 font-bold text-slate-900">{s.student?.name}</td>
                    <td className="py-2.5 text-slate-600">{s.student?.rollNo || "N/A"}</td>
                    <td className="py-2.5 text-slate-600">{s.student?.roomNo || "N/A"}</td>
                    <td className="py-2.5 font-mono font-semibold text-indigo-700">{s.passCode}</td>
                    <td className="py-2.5 text-amber-700 font-mono">
                      {s.leftAt ? new Date(s.leftAt).toLocaleTimeString() : "Earlier"}
                    </td>
                    <td className="py-2.5 text-slate-600">{s.toDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
            Issue digital warden signatures and generate downloadable PDF passes with QR codes.
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
