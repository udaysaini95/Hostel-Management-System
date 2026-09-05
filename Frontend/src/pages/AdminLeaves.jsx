import React, { useEffect, useState } from "react";
import api from "../api/axios";
import { getApiErrorMessage } from "../api/errors.js";
import { buildUploadUrl } from "../config/serviceUrls";
import {
  ConfirmationDialog,
  EmptyState,
  ErrorState,
  LoadingState,
} from "../components/ui/index.js";
import { useToast } from "../feedback/toastContext.js";
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
  const [loadError, setLoadError] = useState("");
  const [decision, setDecision] = useState(null);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const { showToast } = useToast();

  const fetchLeaves = async ({ showLoading = true } = {}) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      setLoadError("");
      const res = await api.get("/api/leave/admin/all");
      setLeaves(res.data || []);
    } catch (err) {
      setLoadError(
        getApiErrorMessage(err, "Leave applications could not be loaded.")
      );
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, []);

  const handleDecision = async () => {
    if (!decision) {
      return;
    }

    const leaveId = decision.leave.id || decision.leave._id;
    const actionLabel = decision.action === "approve" ? "approved" : "rejected";

    try {
      setDecisionLoading(true);
      await api.put(`/api/leave/admin/${decision.action}/${leaveId}`);
      setDecision(null);
      showToast({
        tone: "success",
        title: `Leave ${actionLabel}`,
        message:
          decision.action === "approve"
            ? "The signed gate pass is ready for the student."
            : "The student can now see that the request was rejected.",
      });
      await fetchLeaves({ showLoading: false });
    } catch (err) {
      showToast({
        tone: "danger",
        title: "Leave decision was not saved",
        message: getApiErrorMessage(err, "Try again in a moment."),
      });
    } finally {
      setDecisionLoading(false);
    }
  };

  return (
    <div className="hm-page-stack hm-page-stack--medium">
      
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
        <LoadingState label="Loading leave applications" rows={4} />
      ) : loadError ? (
        <ErrorState
          title="Leave applications are unavailable"
          description={loadError}
          onRetry={fetchLeaves}
        />
      ) : leaves.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="No leave applications"
          description="New student gate-pass requests will appear here for review."
        />
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
                      onClick={() =>
                        setDecision({ action: "approve", leave: l })
                      }
                      className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition-colors flex items-center justify-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve & Sign PDF</span>
                    </button>
                    <button
                      onClick={() =>
                        setDecision({ action: "reject", leave: l })
                      }
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

      <ConfirmationDialog
        open={Boolean(decision)}
        title={
          decision?.action === "approve"
            ? "Approve this leave request?"
            : "Reject this leave request?"
        }
        description={
          decision?.action === "approve"
            ? "HostelMate will issue the student's signed gate pass."
            : "The student will see the rejected status for this request."
        }
        confirmLabel={decision?.action === "approve" ? "Approve leave" : "Reject leave"}
        loadingLabel={decision?.action === "approve" ? "Approving" : "Rejecting"}
        tone={decision?.action === "reject" ? "danger" : "default"}
        loading={decisionLoading}
        onConfirm={handleDecision}
        onDismiss={() => setDecision(null)}
      />

    </div>
  );
};

export default AdminLeaves;
