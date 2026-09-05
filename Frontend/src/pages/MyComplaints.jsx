import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { buildUploadUrl } from "../config/serviceUrls";
import { 
  AlertCircle, 
  Plus, 
  Trash2, 
  Image as ImageIcon,
  ExternalLink,
  Filter,
  Clock,
  CheckCircle,
  XCircle,
  MessageSquare
} from "lucide-react";

const MyComplaints = () => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("All");

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/complaints/my");
      setComplaints(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this complaint?")) return;
    try {
      await api.delete(`/api/complaints/${id}`);
      setComplaints(complaints.filter(c => (c.id || c._id) !== id));
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete complaint.");
    }
  };

  const handleVerify = async (id, newStatus) => {
    let note = "";
    if (newStatus === "Created") {
      note = window.prompt("Please provide a reason for reopening this ticket:");
      if (note === null) return;
    }

    try {
      await api.put(`/api/complaints/verify/${id}`, { status: newStatus, note });
      setComplaints(complaints.map(c => (c.id || c._id) === id ? { ...c, status: newStatus } : c));
    } catch (err) {
      alert(err.response?.data?.message || "Failed to verify complaint.");
    }
  };

  const filteredComplaints = complaints.filter(c => {
    if (filterStatus === "All") return true;
    return c.status === filterStatus;
  });

  return (
    <div className="hm-page-stack hm-page-stack--medium">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 ui-panel p-6 rounded-2xl bg-white border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            My Maintenance Complaints
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Track status updates and resolution progress for your room tickets.
          </p>
        </div>

        <Link
          to="/student/complaints/raise"
          className="py-2 px-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Raise Complaint</span>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200">
        <span className="text-xs font-semibold text-slate-500 flex items-center gap-1 mr-2">
          <Filter className="w-3 h-3" /> Filter:
        </span>
        {["All", "Created", "In Progress", "Resolved", "Closed"].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors shrink-0 ${
              filterStatus === status
                ? "bg-slate-900 text-white font-semibold"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="ui-panel p-8 text-center text-slate-500 text-xs rounded-xl">
          Loading complaints...
        </div>
      ) : filteredComplaints.length === 0 ? (
        <div className="ui-panel p-8 text-center border border-slate-200 rounded-xl space-y-2">
          <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-slate-700 font-semibold text-xs">No complaints found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredComplaints.map((c) => {
            const complaintId = c.id || c._id;
            const attachmentUrl = buildUploadUrl(c.image);
            return (
              <div key={complaintId} className="ui-card p-5 rounded-xl bg-white border-slate-200 flex flex-col justify-between space-y-3">
                
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 uppercase tracking-wider">
                      {c.type}
                    </span>
                    
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                      c.status === "Resolved"
                        ? "badge-resolved"
                        : c.status === "In Progress"
                        ? "badge-pending"
                        : "badge-created"
                    }`}>
                      {c.status}
                    </span>
                  </div>

                  <div className="text-base font-bold text-slate-900 mt-1">
                    Room {c.room}
                  </div>
                  <p className="text-slate-600 text-xs mt-1 leading-relaxed">
                    {c.description}
                  </p>
                </div>

                {attachmentUrl && (
                  <div className="pt-1">
                    <a
                      href={attachmentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:underline"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>View Attached Photo</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                {(c.status === "Resolved" || c.status === "Closed") && c.resolutionNote && (
                  <div className="mt-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-xs">
                    <div className="flex items-center gap-1.5 text-emerald-800 font-bold mb-1">
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Admin Resolution Note:</span>
                    </div>
                    <p className="text-emerald-700">{c.resolutionNote}</p>
                  </div>
                )}

                {c.status === "Resolved" && (
                  <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                    <button
                      onClick={() => handleVerify(complaintId, "Closed")}
                      className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Confirm Fixed
                    </button>
                    <button
                      onClick={() => handleVerify(complaintId, "Created")}
                      className="flex-1 py-2 rounded-lg bg-white border border-rose-200 hover:bg-rose-50 text-rose-700 text-[11px] font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Reopen Ticket
                    </button>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "Recently"}</span>
                  </div>

                  <button
                    onClick={() => handleDelete(complaintId)}
                    className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Delete Complaint"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};

export default MyComplaints;
