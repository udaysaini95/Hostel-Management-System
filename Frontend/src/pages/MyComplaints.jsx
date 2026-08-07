import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { 
  AlertCircle, 
  Plus, 
  Trash2, 
  Image as ImageIcon,
  ExternalLink,
  Filter,
  Clock
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

  const filteredComplaints = complaints.filter(c => {
    if (filterStatus === "All") return true;
    return c.status === filterStatus;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
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
        {["All", "Created", "In Progress", "Resolved"].map((status) => (
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

                {c.image && (
                  <div className="pt-1">
                    <a
                      href={`http://localhost:5000/uploads/${c.image}`}
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
