import React, { useEffect, useState } from "react";
import api from "../api/axios";
import { getApiErrorMessage } from "../api/errors.js";
import { buildUploadUrl } from "../config/serviceUrls";
import {
  Button,
  ConfirmationDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  Textarea,
} from "../components/ui/index.js";
import { useToast } from "../feedback/toastContext.js";
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
  const [loadError, setLoadError] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [resolutionDialog, setResolutionDialog] = useState(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const { showToast } = useToast();

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      setLoadError("");
      const res = await api.get("/api/complaints/admin/complaints");
      setComplaints(res.data || []);
    } catch (err) {
      setLoadError(
        getApiErrorMessage(err, "The complaint queue could not be loaded.")
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, []);

  const updateComplaintStatus = async (complaint, newStatus, note = "") => {
    const id = complaint.id || complaint._id;
    try {
      setUpdatingId(id);
      await api.put(`/api/complaints/status/${id}`, {
        status: newStatus,
        resolutionNote: note,
      });
      setComplaints((currentComplaints) =>
        currentComplaints.map((item) =>
          (item.id || item._id) === id
            ? { ...item, status: newStatus, resolutionNote: note }
            : item
        )
      );
      setResolutionDialog(null);
      setResolutionNote("");
      showToast({
        tone: "success",
        title: "Complaint status updated",
        message: `The complaint is now ${newStatus.toLowerCase()}.`,
      });
    } catch (err) {
      showToast({
        tone: "danger",
        title: "Complaint status was not changed",
        message: getApiErrorMessage(err, "Try again in a moment."),
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleStatusSelection = (complaint, newStatus) => {
    if (newStatus === "Resolved") {
      setResolutionDialog(complaint);
      setResolutionNote("");
      return;
    }

    updateComplaintStatus(complaint, newStatus);
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
    <div className="hm-page-stack hm-page-stack--wide">
      
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
        <LoadingState label="Loading the complaint queue" rows={5} />
      ) : loadError ? (
        <ErrorState
          title="Complaint queue is unavailable"
          description={loadError}
          onRetry={fetchComplaints}
        />
      ) : filteredComplaints.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title={filterStatus === "All" ? "No complaints in the queue" : "No matching complaints"}
          description={
            filterStatus === "All"
              ? "New student complaints will appear here for operational review."
              : "No complaints match the selected status."
          }
          action={
            filterStatus === "All" ? null : (
              <Button onClick={() => setFilterStatus("All")}>
                Show all complaints
              </Button>
            )
          }
        />
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
                    onChange={(e) => handleStatusSelection(c, e.target.value)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold ui-input cursor-pointer"
                    disabled={c.status === "Closed" || updatingId === complaintId}
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

      <ConfirmationDialog
        open={Boolean(resolutionDialog)}
        title="Mark this complaint as resolved?"
        description="The student will be asked to confirm the completed repair or reopen the complaint."
        confirmLabel="Mark as resolved"
        loadingLabel="Updating"
        loading={Boolean(updatingId)}
        onConfirm={() =>
          updateComplaintStatus(
            resolutionDialog,
            "Resolved",
            resolutionNote.trim()
          )
        }
        onDismiss={() => {
          setResolutionDialog(null);
          setResolutionNote("");
        }}
      >
        <Textarea
          label="Resolution note"
          name="resolutionNote"
          hint="Optional. Briefly explain the completed work."
          value={resolutionNote}
          onChange={(event) => setResolutionNote(event.target.value)}
        />
      </ConfirmationDialog>

    </div>
  );
};

export default AllComplaintsAdmin;
