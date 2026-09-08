import { useState } from "react";
import { UserRoundPlus } from "lucide-react";
import { getApiErrorMessage } from "../api/errors.js";
import {
  Badge,
  Button,
  Drawer,
  ErrorState,
  LoadingState,
  StatusBadge,
} from "../components/ui/index.js";
import { useToast } from "../feedback/toastContext.js";
import { ComplaintAttachments } from "./ComplaintAttachments.jsx";
import { getComplaintAttachmentBlob } from "./complaintApi.js";
import { ComplaintTimeline } from "./ComplaintTimeline.jsx";
import {
  formatComplaintDate,
  getComplaintPriorityLabel,
  getComplaintPriorityTone,
  getComplaintStatusLabel,
  getSlaPresentation,
} from "./complaintView.js";

export const ManagedComplaintDrawer = ({
  open,
  complaint,
  attachments,
  loading,
  error,
  onAssign,
  onDismiss,
  onRetry,
}) => {
  const { showToast } = useToast();
  const [busyAttachmentId, setBusyAttachmentId] = useState(null);

  const openAttachment = async (attachment) => {
    try {
      setBusyAttachmentId(attachment.id);
      const blob = await getComplaintAttachmentBlob(complaint.id, attachment.id);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (attachmentError) {
      showToast({
        tone: "danger",
        title: "Image unavailable",
        message: getApiErrorMessage(
          attachmentError,
          "The private image could not be opened."
        ),
      });
    } finally {
      setBusyAttachmentId(null);
    }
  };

  const canAssign = complaint && ["created", "assigned", "in_progress"].includes(complaint.status);
  const sla = complaint ? getSlaPresentation(complaint.sla) : null;

  return (
    <Drawer
      open={open}
      title={complaint ? `Complaint #${complaint.id}` : "Complaint details"}
      description={complaint ? `${complaint.category.name} · ${complaint.hostel.code}` : "Operational record"}
      onDismiss={onDismiss}
      className="hm-managed-complaint-drawer"
    >
      {loading ? (
        <LoadingState label="Loading complaint details" rows={5} />
      ) : error || !complaint ? (
        <ErrorState
          title="Complaint unavailable"
          description={error || "The complaint response was empty."}
          onRetry={onRetry}
        />
      ) : (
        <div className="hm-managed-complaint-detail">
          <div className="hm-managed-complaint-detail__actions">
            <div className="hm-managed-complaints__badges">
              <StatusBadge status={complaint.status}>
                {getComplaintStatusLabel(complaint.status)}
              </StatusBadge>
              <Badge tone={getComplaintPriorityTone(complaint.priority)}>
                {getComplaintPriorityLabel(complaint.priority)} priority
              </Badge>
              <Badge tone={sla.tone}>{sla.label}</Badge>
            </div>
            {canAssign && (
              <Button
                variant="primary"
                leadingIcon={<UserRoundPlus aria-hidden="true" />}
                onClick={() => onAssign(complaint)}
              >
                {complaint.assignment ? "Reassign technician" : "Assign technician"}
              </Button>
            )}
          </div>

          <dl className="hm-managed-complaint-detail__facts">
            <div><dt>Student</dt><dd>{complaint.reportedBy.name}</dd></div>
            <div><dt>Hostel</dt><dd>{complaint.hostel.name} ({complaint.hostel.code})</dd></div>
            <div><dt>Room</dt><dd>{complaint.room?.label ?? "Not linked"}</dd></div>
            <div><dt>Location</dt><dd>{complaint.location}</dd></div>
            <div><dt>Assigned to</dt><dd>{complaint.assignment?.assignee.name ?? "Awaiting assignment"}</dd></div>
            <div><dt>Reported</dt><dd>{formatComplaintDate(complaint.createdAt)}</dd></div>
          </dl>

          <section>
            <h3>Reported issue</h3>
            <p>{complaint.description}</p>
          </section>

          {complaint.resolutionNote && (
            <section className="hm-managed-complaint-detail__resolution">
              <h3>Resolution note</h3>
              <p>{complaint.resolutionNote}</p>
            </section>
          )}

          <section>
            <div className="hm-managed-complaint-detail__section-heading">
              <h3>Evidence</h3>
              <p>Images remain private and require an active session.</p>
            </div>
            <ComplaintAttachments
              attachments={attachments}
              canAdd={false}
              busyAttachmentId={busyAttachmentId}
              onOpen={openAttachment}
            />
          </section>

          <section>
            <div className="hm-managed-complaint-detail__section-heading">
              <h3>Timeline</h3>
              <p>Newest update first.</p>
            </div>
            <ComplaintTimeline events={complaint.timeline} />
          </section>
        </div>
      )}
    </Drawer>
  );
};
