import React, { useEffect, useState } from "react";
import api from "../api/axios";
import { buildUploadUrl } from "../config/serviceUrls";
import { 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Calendar, 
  User, 
  Download
} from "lucide-react";

const AdminLeaves = () => {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/leave/admin/all");
      setLeaves(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, []);

  const handleApprove = async (id) => {
    try {
      await api.put(`/api/leave/admin/approve/${id}`);
      fetchLeaves();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to approve leave.");
    }
  };

  const handleReject = async (id) => {
    try {
      await api.put(`/api/leave/admin/reject/${id}`);
      fetchLeaves();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to reject leave.");
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Header */}
      <div className="ui-panel p-6 rounded-2xl bg-white border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Leave Applications & Digital PDF Outpasses
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Review student gate pass applications and issue Warden digital signatures.
          </p>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="ui-panel p-8 text-center text-slate-500 text-xs rounded-xl">
          Loading leave applications...
        </div>
      ) : leaves.length === 0 ? (
        <div className="ui-panel p-8 text-center border border-slate-200 rounded-xl space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
          <p className="text-slate-700 font-semibold text-xs">No leave applications pending</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {leaves.map((l) => {
            const leaveId = l.id || l._id;
            const passUrl = buildUploadUrl(l.pdfFile);
            return (
              <div key={leaveId} className="ui-card p-5 rounded-xl bg-white border-slate-200 flex flex-col justify-between space-y-3">
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200 flex items-center gap-1">
                      <User className="w-3 h-3 text-slate-500" />
                      {l.student?.name || "Student"}
                    </span>

                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                      l.status === "Approved"
                        ? "badge-resolved"
                        : l.status === "Rejected"
                        ? "badge-rejected"
                        : "badge-pending"
                    }`}>
                      {l.status}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span><strong className="text-slate-800">Dates:</strong> {l.fromDate} ➔ {l.toDate}</span>
                  </div>

                  <p className="text-slate-700 text-xs leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <strong className="text-slate-500 uppercase text-[9px] tracking-wider block mb-0.5">Reason</strong>
                    {l.reason}
                  </p>
                </div>

                {l.status === "Pending" ? (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleApprove(leaveId)}
                      className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition-colors flex items-center justify-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve & Sign PDF</span>
                    </button>
                    <button
                      onClick={() => handleReject(leaveId)}
                      className="py-2 px-3 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold text-xs transition-colors flex items-center justify-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                ) : l.status === "Approved" && passUrl ? (
                  <a
                    href={passUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2 px-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>View Approved PDF Pass</span>
                  </a>
                ) : (
                  <div className="text-xs text-rose-700 font-medium pt-1">
                    Application rejected by Warden.
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};

export default AdminLeaves;
