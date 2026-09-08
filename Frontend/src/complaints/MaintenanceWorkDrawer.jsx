import { useState } from "react";
import { CheckCircle2, Play } from "lucide-react";
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

export const MaintenanceWorkDrawer = ({
  open,
  complaint,
  attachments,
  loading,
  error,
  onDismiss,
  onResolve,
  onRetry,
  onStart,
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

  const sla = complaint ? getSlaPresentation(complaint.sla) : null;

  return (
    <Drawer
      open={open}
      title={complaint ? `Work order #${complaint.id}` : "Work order details"}
      description={complaint ? `${complaint.category.name} · ${complaint.hostel.code}` : "Assigned maintenance work"}
      onDismiss={onDismiss}
      className="hm-work-order-drawer"
    >
      {loading ? (
        <LoadingState label="Loading work order details" rows={5} />
      ) : error || !complaint ? (
        <ErrorState
          title="Work order unavailable"
          description={error || "The work order response was empty."}
          onRetry={onRetry}
        />
      ) : (
        <div className="hm-work-order-detail">
          <div className="hm-work-order-detail__header">
            <div className="hm-work-order__badges">
              <StatusBadge status={complaint.status}>
                {getComplaintStatusLabel(complaint.status)}
              </StatusBadge>
              <Badge tone={getComplaintPriorityTone(complaint.priority)}>
                {getComplaintPriorityLabel(complaint.priority)} priority
              </Badge>
              <Badge tone={sla.tone}>{sla.label}</Badge>
            </div>
            {complaint.status === "assigned" && (
              <Button
                variant="primary"
                leadingIcon={<Play aria-hidden="true" />}
                onClick={() => onStart(complaint)}
              >
                Start work
              </Button>
            )}
            {complaint.status === "in_progress" && (
              <Button
                variant="primary"
                leadingIcon={<CheckCircle2 aria-hidden="true" />}
                onClick={() => onResolve(complaint)}
              >
                Resolve work
              </Button>
            )}
          </div>

          <dl className="hm-work-order-detail__facts">
            <div><dt>Student</dt><dd>{complaint.reportedBy.name}</dd></div>
            <div><dt>Hostel</dt><dd>{complaint.hostel.name} ({complaint.hostel.code})</dd></div>
            <div><dt>Room</dt><dd>{complaint.room?.label ?? "Not linked"}</dd></div>
            <div><dt>Location</dt><dd>{complaint.location}</dd></div>
            <div><dt>Assigned</dt><dd>{formatComplaintDate(complaint.assignment?.assignedAt)}</dd></div>
            <div><dt>Updated</dt><dd>{formatComplaintDate(complaint.updatedAt)}</dd></div>
          </dl>

          <section>
            <h3>Reported issue</h3>
            <p>{complaint.description}</p>
          </section>

          {complaint.resolutionNote && (
            <section className="hm-work-order-detail__resolution">
              <h3>Submitted resolution</h3>
              <p>{complaint.resolutionNote}</p>
            </section>
          )}

          <section>
            <div className="hm-work-order-detail__section-heading">
              <h3>Evidence</h3>
              <p>Submission and resolution images are private.</p>
            </div>
            <ComplaintAttachments
              attachments={attachments}
              canAdd={false}
              busyAttachmentId={busyAttachmentId}
              onOpen={openAttachment}
            />
          </section>

          <section>
            <div className="hm-work-order-detail__section-heading">
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
