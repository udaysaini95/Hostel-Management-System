import React, { useEffect, useState } from "react";
import api from "../api/axios";
import { buildUploadUrl } from "../config/serviceUrls";
import { 
  CheckCircle2, 
  ImageIcon, 
  ExternalLink,
  ShieldCheck,
  User,
  Filter,
  Clock,
  AlertOctagon
} from "lucide-react";

const AllComplaintsAdmin = () => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("All");

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/complaints/admin/complaints");
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

  const handleStatusChange = async (id, newStatus) => {
    let resolutionNote = "";
    if (newStatus === "Resolved") {
      resolutionNote = window.prompt("Optional: Add a resolution note for the student:");
      // If user cancels prompt, it returns null. We can still proceed without a note, 
      // but let's let them cancel the whole action if they hit cancel.
      if (resolutionNote === null) return; 
    }

    try {
      await api.put(`/api/complaints/status/${id}`, { status: newStatus, resolutionNote });
      setComplaints(complaints.map(c => (c.id || c._id) === id ? { ...c, status: newStatus, resolutionNote } : c));
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update status.");
    }
  };

  const isSlaBreached = (deadline, status) => {
    if (!deadline || status === "Resolved" || status === "Closed") return false;
    return new Date(deadline) < new Date();
  };

  const filteredComplaints = complaints.filter(c => {
    if (filterStatus === "All") return true;
    return c.status === filterStatus;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Header */}
      <div className="ui-panel p-6 rounded-2xl bg-white border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            All Student Complaints Queue
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Review room maintenance tickets and update resolution status.
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200">
        <span className="text-xs font-semibold text-slate-500 flex items-center gap-1 mr-2">
          <Filter className="w-3 h-3" /> Filter Status:
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

      {/* List */}
      {loading ? (
        <div className="ui-panel p-8 text-center text-slate-500 text-xs rounded-xl">
          Loading complaints list...
        </div>
      ) : filteredComplaints.length === 0 ? (
        <div className="ui-panel p-8 text-center border border-slate-200 rounded-xl space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
          <p className="text-slate-700 font-semibold text-xs">No complaints found for this filter</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredComplaints.map((c) => {
            const complaintId = c.id || c._id;
            const attachmentUrl = buildUploadUrl(c.image);
            return (
              <div key={complaintId} className={`ui-card p-5 rounded-xl bg-white border flex flex-col md:flex-row md:items-center justify-between gap-4 ${isSlaBreached(c.slaDeadline, c.status) ? 'border-rose-300 bg-rose-50' : 'border-slate-200'}`}>
                
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-800 uppercase tracking-wider">
                      {c.type}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${c.priority?.startsWith('P0') ? 'bg-rose-100 text-rose-800 border-rose-200' : c.priority?.startsWith('P1') ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                      {c.priority || 'P2 - Medium'}
                    </span>
                    <span className="text-xs font-bold text-slate-900 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                      Room {c.room}
                    </span>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <User className="w-3 h-3 text-slate-400" />
                      {c.user?.name || "Student"}
                    </span>
                    
                    {isSlaBreached(c.slaDeadline, c.status) && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-600 text-white flex items-center gap-1 animate-pulse">
                        <AlertOctagon className="w-3 h-3" /> SLA BREACHED
                      </span>
                    )}
                  </div>

                  <p className="text-slate-800 text-xs font-medium leading-relaxed">
                    {c.description}
                  </p>

                  {c.resolutionNote && (
                    <div className={`mt-2 p-3 rounded-xl border text-xs ${c.resolutionNote.startsWith('[Reopened by Student]') ? 'bg-rose-50 border-rose-100 text-rose-800' : 'bg-emerald-50 border-emerald-100 text-emerald-800'}`}>
                      <span className="font-bold">Note: </span>
                      {c.resolutionNote}
                    </div>
                  )}

                  {attachmentUrl && (
                    <a
                      href={attachmentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline font-semibold pt-0.5"
                    >
                      <ImageIcon className="w-3 h-3" />
                      <span>View Photo Attachment</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0 border-t md:border-t-0 border-slate-200 pt-3 md:pt-0">
                  <span className="text-xs font-semibold text-slate-500">Update Status:</span>
                  <select
                    value={c.status}
                    onChange={(e) => handleStatusChange(complaintId, e.target.value)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold ui-input cursor-pointer"
                    disabled={c.status === "Closed"}
                  >
                    <option value="Created">Created</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                    {c.status === "Closed" && <option value="Closed">Closed</option>}
                  </select>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};

export default AllComplaintsAdmin;
