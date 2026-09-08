import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, RotateCcw } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { getApiErrorMessage } from "../api/errors.js";
import {
  Badge,
  Button,
  ConfirmationDialog,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
  StatusBadge,
  Textarea,
} from "../components/ui/index.js";
import { ComplaintAttachments } from "../complaints/ComplaintAttachments.jsx";
import { ComplaintTimeline } from "../complaints/ComplaintTimeline.jsx";
import {
  addComplaintAttachment,
  getComplaint,
  getComplaintAttachmentBlob,
  removeComplaintAttachment,
  verifyComplaint,
} from "../complaints/complaintApi.js";
import {
  formatComplaintDate,
  getComplaintPriorityLabel,
  getComplaintPriorityTone,
  getComplaintStatusLabel,
  getSlaPresentation,
  validateComplaintImage,
} from "../complaints/complaintView.js";
import { useToast } from "../feedback/toastContext.js";

const ComplaintDetail = () => {
  const { id } = useParams();
  const { showToast } = useToast();
  const [complaint, setComplaint] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [dialogAction, setDialogAction] = useState(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState("");
  const [busyAttachmentId, setBusyAttachmentId] = useState(null);

  const loadComplaint = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError("");
      const result = await getComplaint(id);
      if (!result.complaint) throw new Error("Complaint response was empty");
      setComplaint(result.complaint);
      setAttachments(result.attachments);
    } catch (error) {
      setLoadError(
        getApiErrorMessage(error, "This complaint could not be loaded.")
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadComplaint();
  }, [loadComplaint]);

  const closeDialog = () => {
    setDialogAction(null);
    setReason("");
    setReasonError("");
    setActionError("");
  };

  const completeVerification = async () => {
    const reopening = dialogAction?.type === "reopen";
    const cleanReason = reason.trim();

    if (reopening && cleanReason.length < 10) {
      setReasonError("Explain what remains unresolved using at least 10 characters.");
      return;
    }

    try {
      setActionLoading(true);
      setActionError("");
      const nextComplaint = await verifyComplaint(complaint.id, {
        action: reopening ? "reopen" : "close",
        ...(cleanReason ? { reason: cleanReason } : {}),
      });
      setComplaint(nextComplaint);
      closeDialog();
      showToast({
        tone: "success",
        title: reopening ? "Complaint reopened" : "Complaint closed",
        message: reopening
          ? "The assigned technician can continue working on the complaint."
          : "The maintenance resolution has been confirmed.",
      });
    } catch (error) {
      setActionError(
        getApiErrorMessage(error, "The complaint status could not be changed.")
      );
    } finally {
      setActionLoading(false);
    }
  };

  const uploadAttachment = async (event) => {
    const input = event.target;
    const file = input.files?.[0];
    const error = validateComplaintImage(file);

    if (error) {
      setFileError(error);
      input.value = "";
      return;
    }

    try {
      setUploading(true);
      setFileError("");
      const attachment = await addComplaintAttachment(complaint.id, file);
      setAttachments((current) => [...current, attachment]);
      showToast({
        tone: "success",
        title: "Image added",
        message: "The private evidence is now attached to this complaint.",
      });
    } catch (uploadError) {
      setFileError(
        getApiErrorMessage(uploadError, "The image could not be uploaded.")
      );
    } finally {
      setUploading(false);
      input.value = "";
    }
  };

  const openAttachment = async (attachment) => {
    try {
      setBusyAttachmentId(attachment.id);
      const blob = await getComplaintAttachmentBlob(
        complaint.id,
        attachment.id
      );
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      showToast({
        tone: "danger",
        title: "Image unavailable",
        message: getApiErrorMessage(error, "The private image could not be opened."),
      });
    } finally {
      setBusyAttachmentId(null);
    }
  };

  const deleteAttachment = async () => {
    const attachment = dialogAction?.attachment;
    if (!attachment) return;

    try {
      setActionLoading(true);
      setActionError("");
      await removeComplaintAttachment(complaint.id, attachment.id);
      setAttachments((current) =>
        current.filter((item) => item.id !== attachment.id)
      );
      closeDialog();
      showToast({
        tone: "success",
        title: "Image removed",
        message: "The submission evidence was removed from this complaint.",
      });
    } catch (error) {
      setActionError(
        getApiErrorMessage(error, "The image could not be removed.")
      );
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <LoadingState label="Loading complaint details" rows={5} />;
  }

  if (loadError || !complaint) {
    return (
      <ErrorState
        title="Complaint unavailable"
        description={loadError}
        onRetry={loadComplaint}
      />
    );
  }

  const sla = getSlaPresentation(complaint.sla);
  const resolved = complaint.status === "resolved";
  const canAddEvidence = complaint.status === "created";
  const dialogIsDelete = dialogAction?.type === "delete-attachment";
  const dialogIsReopen = dialogAction?.type === "reopen";

  return (
    <div className="hm-page-stack hm-page-stack--medium hm-complaints">
      <Link className="hm-complaints__back" to="/student/complaints">
        <ArrowLeft aria-hidden="true" /> Back to complaints
      </Link>

      <PageHeader
        eyebrow={`Complaint #${complaint.id}`}
        title={complaint.category.name}
        description={`${complaint.hostel.code} · ${complaint.room?.label ?? complaint.location}`}
        actions={
          resolved && (
            <>
              <Button
                variant="primary"
                leadingIcon={<CheckCircle2 aria-hidden="true" />}
                onClick={() => setDialogAction({ type: "close" })}
              >
                Confirm fixed
              </Button>
              <Button
                leadingIcon={<RotateCcw aria-hidden="true" />}
                onClick={() => setDialogAction({ type: "reopen" })}
              >
                Reopen
              </Button>
            </>
          )
        }
      />

      <Panel className="hm-complaint-detail__summary">
        <div className="hm-complaint-detail__status-row">
          <StatusBadge status={complaint.status}>
            {getComplaintStatusLabel(complaint.status)}
          </StatusBadge>
          <Badge tone={getComplaintPriorityTone(complaint.priority)}>
            {getComplaintPriorityLabel(complaint.priority)} priority
          </Badge>
          <Badge tone={sla.tone}>{sla.label}</Badge>
        </div>

        <dl className="hm-complaint-detail__facts">
          <div><dt>Location</dt><dd>{complaint.location}</dd></div>
          <div><dt>Room</dt><dd>{complaint.room?.label ?? "Not linked"}</dd></div>
          <div><dt>Assigned to</dt><dd>{complaint.assignment?.assignee.name ?? "Awaiting assignment"}</dd></div>
          <div><dt>Updated</dt><dd>{formatComplaintDate(complaint.updatedAt)}</dd></div>
        </dl>

        <div className="hm-complaint-detail__description">
          <h2>Reported issue</h2>
          <p>{complaint.description}</p>
        </div>

        {complaint.resolutionNote && (
          <div className="hm-complaint-detail__resolution">
            <h2>Resolution note</h2>
            <p>{complaint.resolutionNote}</p>
          </div>
        )}
      </Panel>

      <Panel className="hm-complaint-detail__section">
        <div className="hm-complaint-detail__section-heading">
          <div><h2>Evidence</h2><p>Images are private and require your signed-in session.</p></div>
        </div>
        <ComplaintAttachments
          attachments={attachments}
          canAdd={canAddEvidence}
          busyAttachmentId={busyAttachmentId}
          uploading={uploading}
          fileError={fileError}
          onFileChange={uploadAttachment}
          onOpen={openAttachment}
          onRemove={(attachment) =>
            setDialogAction({ type: "delete-attachment", attachment })
          }
        />
      </Panel>

      <Panel className="hm-complaint-detail__section">
        <div className="hm-complaint-detail__section-heading">
          <div><h2>Timeline</h2><p>Newest update first.</p></div>
        </div>
        <ComplaintTimeline events={complaint.timeline} />
      </Panel>

      <ConfirmationDialog
        open={Boolean(dialogAction)}
        title={
          dialogIsDelete
            ? "Remove this image?"
            : dialogIsReopen
              ? "Reopen this complaint?"
              : "Confirm this repair?"
        }
        description={
          dialogIsDelete
            ? "The submission image will be permanently removed."
            : dialogIsReopen
              ? "The complaint will return to the assigned technician for more work."
              : "The complaint will be closed and removed from the technician's active queue."
        }
        confirmLabel={dialogIsDelete ? "Remove image" : dialogIsReopen ? "Reopen complaint" : "Confirm fixed"}
        loadingLabel={dialogIsDelete ? "Removing image" : "Updating complaint"}
        tone={dialogIsDelete ? "danger" : "default"}
        loading={actionLoading}
        onConfirm={dialogIsDelete ? deleteAttachment : completeVerification}
        onDismiss={closeDialog}
      >
        {dialogIsReopen && (
          <Textarea
            label="Reason for reopening"
            required
            rows={4}
            maxLength={1000}
            placeholder="Explain what is still unresolved."
            value={reason}
            error={reasonError}
            onChange={(event) => {
              setReason(event.target.value);
              setReasonError("");
              setActionError("");
            }}
          />
        )}
        {actionError && <p className="hm-complaints__form-error" role="alert">{actionError}</p>}
      </ConfirmationDialog>
    </div>
  );
};

export default ComplaintDetail;
