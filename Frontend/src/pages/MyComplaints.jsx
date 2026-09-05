import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { getApiErrorMessage } from "../api/errors.js";
import { buildUploadUrl } from "../config/serviceUrls";
import {
  Button,
  ButtonLink,
  ConfirmationDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  Textarea,
} from "../components/ui/index.js";
import { useToast } from "../feedback/toastContext.js";
import { 
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
  const [loadError, setLoadError] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [dialogAction, setDialogAction] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [reopenNote, setReopenNote] = useState("");
  const [reopenNoteError, setReopenNoteError] = useState("");
  const { showToast } = useToast();

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      setLoadError("");
      const res = await api.get("/api/complaints/my");
      setComplaints(res.data || []);
    } catch (err) {
      setLoadError(
        getApiErrorMessage(err, "Your complaints could not be loaded.")
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, []);

  const closeDialog = () => {
    setDialogAction(null);
    setReopenNote("");
    setReopenNoteError("");
  };

  const handleDelete = async (complaint) => {
    const id = complaint.id || complaint._id;

    try {
      setActionLoading(true);
      await api.delete(`/api/complaints/${id}`);
      setComplaints((currentComplaints) =>
        currentComplaints.filter((item) => (item.id || item._id) !== id)
      );
      closeDialog();
      showToast({
        tone: "success",
        title: "Complaint deleted",
        message: "The complaint was removed from your history.",
      });
    } catch (err) {
      showToast({
        tone: "danger",
        title: "Complaint could not be deleted",
        message: getApiErrorMessage(err, "Try again in a moment."),
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerify = async (id, newStatus, note = "") => {
    try {
      setActionLoading(true);
      await api.put(`/api/complaints/verify/${id}`, { status: newStatus, note });
      setComplaints((currentComplaints) =>
        currentComplaints.map((item) =>
          (item.id || item._id) === id
            ? { ...item, status: newStatus }
            : item
        )
      );
      closeDialog();
      showToast({
        tone: "success",
        title: newStatus === "Closed" ? "Complaint closed" : "Complaint reopened",
        message:
          newStatus === "Closed"
            ? "The completed repair has been confirmed."
            : "The complaint returned to the maintenance queue.",
      });
    } catch (err) {
      showToast({
        tone: "danger",
        title: "Complaint status was not changed",
        message: getApiErrorMessage(err, "Try again in a moment."),
      });
    } finally {
      setActionLoading(false);
    }
  };

  const confirmDialogAction = () => {
    if (dialogAction?.type === "delete") {
      handleDelete(dialogAction.complaint);
      return;
    }

    if (dialogAction?.type === "reopen") {
      const note = reopenNote.trim();

      if (!note) {
        setReopenNoteError("Explain what is still unresolved.");
        return;
      }

      const complaintId =
        dialogAction.complaint.id || dialogAction.complaint._id;
      handleVerify(complaintId, "Created", note);
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
        <LoadingState label="Loading your complaints" rows={4} />
      ) : loadError ? (
        <ErrorState
          title="Complaints are unavailable"
          description={loadError}
          onRetry={fetchComplaints}
        />
      ) : filteredComplaints.length === 0 ? (
        <EmptyState
          title={
            filterStatus === "All"
              ? "No complaints yet"
              : `No ${filterStatus.toLowerCase()} complaints`
          }
          description={
            filterStatus === "All"
              ? "New maintenance complaints and their updates will appear here."
              : "No complaints match the selected status."
          }
          action={
            filterStatus === "All" ? (
              <ButtonLink to="/student/complaints/raise" variant="primary">
                Raise a complaint
              </ButtonLink>
            ) : (
              <Button onClick={() => setFilterStatus("All")}>
                Show all complaints
              </Button>
            )
          }
        />
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
                      disabled={actionLoading}
                      className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Confirm Fixed
                    </button>
                    <button
                      onClick={() => {
                        setDialogAction({ type: "reopen", complaint: c });
                        setReopenNote("");
                        setReopenNoteError("");
                      }}
                      disabled={actionLoading}
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
                    onClick={() =>
                      setDialogAction({ type: "delete", complaint: c })
                    }
                    className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Delete Complaint"
                    aria-label="Delete complaint"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

      <ConfirmationDialog
        open={Boolean(dialogAction)}
        title={
          dialogAction?.type === "delete"
            ? "Delete this complaint?"
            : "Reopen this complaint?"
        }
        description={
          dialogAction?.type === "delete"
            ? "This removes the complaint from your history and cannot be undone."
            : "The complaint will return to the maintenance queue for further work."
        }
        confirmLabel={dialogAction?.type === "delete" ? "Delete complaint" : "Reopen complaint"}
        loadingLabel={dialogAction?.type === "delete" ? "Deleting" : "Reopening"}
        tone={dialogAction?.type === "delete" ? "danger" : "default"}
        loading={actionLoading}
        onConfirm={confirmDialogAction}
        onDismiss={closeDialog}
      >
        {dialogAction?.type === "reopen" && (
          <Textarea
            label="Reason for reopening"
            name="reopenReason"
            value={reopenNote}
            onChange={(event) => {
              setReopenNote(event.target.value);
              setReopenNoteError("");
            }}
            error={reopenNoteError}
            required
          />
        )}
      </ConfirmationDialog>

    </div>
  );
};

export default MyComplaints;
