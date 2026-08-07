import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { 
  FileText, 
  Plus, 
  Calendar, 
  Download, 
  FileCheck,
  Clock,
  XCircle
} from "lucide-react";

const MyLeaves = () => {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/leave/mine");
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

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 ui-panel p-6 rounded-2xl bg-white border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            My Leave Applications
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            View approval status and download digitally signed outpass PDFs.
          </p>
        </div>

        <Link
          to="/student/leaves/apply"
          className="py-2 px-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Apply Leave</span>
        </Link>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="ui-panel p-8 text-center text-slate-500 text-xs rounded-xl">
          Loading leave passes...
        </div>
      ) : leaves.length === 0 ? (
        <div className="ui-panel p-8 text-center border border-slate-200 rounded-xl space-y-2">
          <FileText className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-slate-700 font-semibold text-xs">No leave applications found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {leaves.map((l) => {
            const leaveId = l.id || l._id;
            return (
              <div key={leaveId} className="ui-card p-5 rounded-xl bg-white border-slate-200 flex flex-col justify-between space-y-3">
                
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>{l.fromDate} ➔ {l.toDate}</span>
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

                  <h3 className="text-sm font-bold text-slate-900 mb-0.5">
                    Reason: {l.reason}
                  </h3>
                </div>

                {l.status === "Approved" && l.pdfFile ? (
                  <div className="pt-2">
                    <a
                      href={`http://localhost:5000/uploads/${l.pdfFile}`}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-2 px-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download PDF Outpass</span>
                    </a>
                  </div>
                ) : l.status === "Approved" ? (
                  <div className="text-xs text-emerald-700 font-medium flex items-center gap-1 pt-1">
                    <FileCheck className="w-3.5 h-3.5" /> Approved — PDF pass ready
                  </div>
                ) : l.status === "Rejected" ? (
                  <div className="text-xs text-rose-700 font-medium flex items-center gap-1 pt-1">
                    <XCircle className="w-3.5 h-3.5" /> Application rejected by Warden
                  </div>
                ) : (
                  <div className="text-xs text-amber-700 font-medium flex items-center gap-1 pt-1">
                    <Clock className="w-3.5 h-3.5" /> Pending Warden Signature
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

export default MyLeaves;
